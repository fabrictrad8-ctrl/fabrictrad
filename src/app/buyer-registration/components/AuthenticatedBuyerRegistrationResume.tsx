'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { INDIAN_STATES_AND_UTS } from '@/lib/india';
import {
  normalizeGstin,
  normalizePan,
  panFromGstin,
  validateGstinChecksum,
  validateGstinFormat,
  validatePan,
} from '@/lib/commerceIdentifiers';
import { normalizeIndianPhone, validateIndianPhone } from '@/lib/authValidation';

type BuyerType = 'retail_store' | 'end_user';
type IdentityMethod = 'pan' | 'aadhaar_offline';
type GstRegistrationStatus = 'registered' | 'unregistered';
type DocumentKey =
  | 'gst_certificate'
  | 'pan_card' |'aadhaar_offline_ekyc' |'business_proof' |'address_proof';
type Step = 'details' | 'address' | 'documents' | 'done';

type Props = { buyerType: BuyerType };

const documentLabels: Record<DocumentKey, string> = {
  gst_certificate: 'GST registration certificate',
  pan_card: 'PAN card',
  aadhaar_offline_ekyc: 'UIDAI Paperless Offline e-KYC XML/ZIP',
  business_proof: 'Shop or business proof',
  address_proof: 'Business address proof (optional)',
};

const fileOk = (file: File, aadhaarOffline = false) => {
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) return false;
  if (file.type === 'application/pdf' || file.type.startsWith('image/')) return true;
  return (
    aadhaarOffline &&
    ['application/xml', 'text/xml', 'application/zip', 'application/x-zip-compressed'].includes(file.type)
  );
};

const stepLabels: Record<Step, string> = {
  details: 'Details',
  address: 'Address',
  documents: 'Documents',
  done: 'Done',
};

export default function AuthenticatedBuyerRegistrationResume({ buyerType }: Props) {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [supabase] = useState(() => createClient());
  const [step, setStep] = useState<Step>('details');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [gstMessage, setGstMessage] = useState('');
  const [completedMessage, setCompletedMessage] = useState('');
  const [account, setAccount] = useState({ fullName: '', phone: '' });
  const [business, setBusiness] = useState({
    businessName: '',
    gstRegistrationStatus: 'registered' as GstRegistrationStatus,
    gstin: '',
    identityMethod: 'pan' as IdentityMethod,
    pan: '',
  });
  const [address, setAddress] = useState({
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [documents, setDocuments] = useState<Partial<Record<DocumentKey, File>>>({});

  const isRetail = buyerType === 'retail_store';
  const steps = useMemo<Step[]>(
    () => (isRetail ? ['details', 'address', 'documents', 'done'] : ['details', 'address', 'done']),
    [isRetail]
  );
  const requiredDocuments = useMemo<DocumentKey[]>(() => {
    if (!isRetail) return [];
    const required: DocumentKey[] = ['business_proof'];
    required.push(business.identityMethod === 'pan' ? 'pan_card' : 'aadhaar_offline_ekyc');
    if (business.gstRegistrationStatus === 'registered') required.push('gst_certificate');
    return required;
  }, [business.gstRegistrationStatus, business.identityMethod, isRetail]);

  useEffect(() => {
    if (!user) return;
    setAccount((current) => ({
      fullName: current.fullName || profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '',
      phone: current.phone || normalizeIndianPhone(profile?.phone || ''),
    }));
    setBusiness((current) => ({
      ...current,
      businessName: current.businessName || profile?.business_name || '',
      gstin: current.gstin || normalizeGstin(profile?.gstin || ''),
    }));
    setAddress((current) => ({
      ...current,
      line1: current.line1 || profile?.address_line1 || '',
      city: current.city || profile?.city || '',
      state: current.state || profile?.state || '',
      pincode: current.pincode || profile?.pincode || '',
    }));
  }, [profile, user]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=%2Fbuyer-registration%3Fresume%3D1');
  }, [loading, router, user]);

  const goTo = (next: Step) => {
    setError('');
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validateDetails = () => {
    setError('');
    if (!account.fullName.trim()) {
      setError('Enter your full name.');
      return false;
    }
    const phone = normalizeIndianPhone(account.phone);
    if (phone && !validateIndianPhone(phone).valid) {
      setError(validateIndianPhone(phone).message);
      return false;
    }
    if (isRetail && !phone) {
      setError('Add a contact mobile number for your retail-store purchasing profile. No SMS OTP is required.');
      return false;
    }
    if (!isRetail) return true;

    if (!business.businessName.trim()) {
      setError('Enter your shop or legal business name.');
      return false;
    }
    if (business.identityMethod === 'pan' && !validatePan(business.pan)) {
      setError('Enter a valid PAN in the format AAAAA9999A.');
      return false;
    }
    if (business.gstRegistrationStatus === 'registered') {
      const gstin = normalizeGstin(business.gstin);
      if (!validateGstinFormat(gstin) || !validateGstinChecksum(gstin)) {
        setError('Enter the GSTIN exactly as shown on the GST certificate.');
        return false;
      }
      if (business.identityMethod === 'pan' && normalizePan(business.pan) !== panFromGstin(gstin)) {
        setError('The PAN must match characters 3–12 of the GSTIN.');
        return false;
      }
    }
    return true;
  };

  const checkGstin = async () => {
    const gstin = normalizeGstin(business.gstin);
    setBusiness((current) => ({
      ...current,
      gstin,
      pan: current.identityMethod === 'pan' && validateGstinFormat(gstin)
        ? panFromGstin(gstin)
        : current.pan,
    }));
    if (!validateGstinFormat(gstin) || !validateGstinChecksum(gstin)) {
      setGstMessage('GSTIN format or checksum is invalid. Recheck the GST certificate.');
      return;
    }
    setGstMessage('Checking GSTIN…');
    try {
      const response = await fetch('/api/gstin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ gstin, subjectType: 'buyer', persist: true }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string; status?: string };
      setGstMessage(payload.message || payload.error || `GSTIN check status: ${payload.status || 'manual review'}.`);
    } catch {
      setGstMessage('Automatic GSTIN lookup is temporarily unavailable. The uploaded GST certificate can still be reviewed.');
    }
  };

  const saveContactPhone = async () => {
    const normalizedPhone = normalizeIndianPhone(account.phone);
    if (!normalizedPhone || normalizedPhone === normalizeIndianPhone(profile?.phone || '')) return;
    const { error: phoneError } = await supabase.rpc('set_current_account_phone', {
      p_phone: normalizedPhone,
    });
    if (phoneError) {
      if (/already|belongs|duplicate|unique/i.test(phoneError.message || '')) {
        throw new Error(
          isRetail
            ? 'This mobile number is already attached to another FabricTrad login. Use another contact number or sign in to that existing account.' :'This mobile number is already attached to another FabricTrad login. Leave it blank to continue buying, or sign in to the existing account.'
        );
      }
      throw phoneError;
    }
  };

  const continueDetails = async () => {
    if (!validateDetails()) return;
    setSubmitting(true);
    try {
      await saveContactPhone();
      goTo('address');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The contact number could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  const continueAddress = () => {
    setError('');
    if (!address.line1.trim() || !address.city.trim() || !address.state) {
      setError('Enter the complete delivery address, city and state.');
      return;
    }
    if (!/^\d{6}$/.test(address.pincode)) {
      setError('Enter a valid 6-digit PIN code.');
      return;
    }
    if (isRetail) goTo('documents');
    else void completeRegistration();
  };

  const selectDocument = (key: DocumentKey, file: File | undefined) => {
    if (!file) return;
    if (!fileOk(file, key === 'aadhaar_offline_ekyc')) {
      setError('Documents must be supported PDF/image files up to 10 MB. Aadhaar Offline e-KYC may also be XML/ZIP.');
      return;
    }
    setError('');
    setDocuments((current) => ({ ...current, [key]: file }));
  };

  const completeRegistration = async () => {
    setError('');
    if (!user) return;
    if (isRetail) {
      const missing = requiredDocuments.find((key) => !documents[key]);
      if (missing) {
        setError(`Upload the ${documentLabels[missing]} before continuing.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await saveContactPhone();
      const submission = new FormData();
      submission.set('userId', user.id);
      submission.set(
        'payload',
        JSON.stringify({
          buyerType,
          fullName: account.fullName,
          phone: normalizeIndianPhone(account.phone),
          businessName: business.businessName,
          gstRegistrationStatus: business.gstRegistrationStatus,
          gstin: normalizeGstin(business.gstin),
          pan: normalizePan(business.pan),
          identityMethod: business.identityMethod,
          addressLine1: address.line1,
          addressLine2: address.line2,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
        })
      );
      Object.entries(documents).forEach(([key, file]) => {
        if (file) submission.set(`document_${key}`, file);
      });

      const response = await fetch('/api/registration/buyer/finalize', {
        method: 'POST',
        credentials: 'same-origin',
        body: submission,
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error || 'Buyer registration could not be completed.');

      await refreshProfile().catch(() => undefined);
      window.localStorage.removeItem('fabrictrad_buyer_type');
      window.sessionStorage.removeItem('fabrictrad_buyer_type');
      setCompletedMessage(
        payload.message ||
          (isRetail
            ? 'Retail-store profile submitted. Business verification will continue without blocking normal buying.'
            : 'Personal buyer profile completed. No business KYC is required.')
      );
      goTo('done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Buyer registration could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <section className="bg-muted/25 px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-xl sm:p-8">
          <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-800 uppercase tracking-[0.16em] text-primary">Continue your registration</p>
              <h1 className="mt-2 text-2xl font-800 text-foreground sm:text-3xl">
                {isRetail ? 'Finish your Retail Store profile' : 'Finish your personal buyer profile'}
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Signed in as <span className="font-700 text-foreground">{user.email}</span>. Your login is already created, so FabricTrad only asks for the remaining profile details.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-success/20 bg-success/10 px-3 py-1.5 text-xs font-800 text-success">Login secured</span>
          </div>

          <div className="my-6 flex items-center gap-2 overflow-x-auto pb-1">
            {steps.map((item, index) => {
              const currentIndex = steps.indexOf(step);
              const active = item === step;
              const done = index < currentIndex;
              return (
                <div key={item} className={`flex min-w-fit items-center gap-2 rounded-full border px-3 py-2 text-xs font-700 ${active ? 'border-primary/30 bg-primary/10 text-primary' : done ? 'border-success/20 bg-success/10 text-success' : 'border-border bg-muted/40 text-muted-foreground'}`}>
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-current/10">{done ? '✓' : index + 1}</span>
                  {stepLabels[item]}
                </div>
              );
            })}
          </div>

          {error && (
            <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-error/20 bg-error/10 p-3 text-sm leading-5 text-error">
              <Icon name="ExclamationTriangleIcon" size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-700 text-foreground">
                  Full name *
                  <input className="input-base mt-2 w-full rounded-xl px-4 py-3" value={account.fullName} onChange={(event) => setAccount((current) => ({ ...current, fullName: event.target.value }))} />
                </label>
                <label className="text-sm font-700 text-foreground">
                  Mobile number {isRetail ? '*' : <span className="font-500 text-muted-foreground">(optional)</span>}
                  <div className="mt-2 flex gap-2">
                    <span className="grid min-h-12 place-items-center rounded-xl border border-border bg-muted px-3 text-sm font-700">+91</span>
                    <input inputMode="numeric" maxLength={10} className="input-base min-w-0 flex-1 rounded-xl px-4 py-3" value={account.phone} onChange={(event) => setAccount((current) => ({ ...current, phone: normalizeIndianPhone(event.target.value) }))} placeholder="9876543210" />
                  </div>
                </label>
              </div>

              {!isRetail && (
                <div className="rounded-xl border border-success/20 bg-success/5 p-4 text-sm leading-6 text-muted-foreground">
                  <strong className="text-foreground">Buy for me:</strong> no PAN, Aadhaar, GST certificate or business proof is required. The mobile number is only contact information and may be left blank.
                </div>
              )}

              {isRetail && (
                <div className="space-y-4 rounded-2xl border border-border bg-muted/25 p-4 sm:p-5">
                  <label className="block text-sm font-700 text-foreground">Shop / legal business name *
                    <input className="input-base mt-2 w-full rounded-xl px-4 py-3" value={business.businessName} onChange={(event) => setBusiness((current) => ({ ...current, businessName: event.target.value }))} />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-700 text-foreground">GST registration
                      <select className="input-base mt-2 w-full rounded-xl px-4 py-3" value={business.gstRegistrationStatus} onChange={(event) => setBusiness((current) => ({ ...current, gstRegistrationStatus: event.target.value as GstRegistrationStatus }))}>
                        <option value="registered">GST registered</option>
                        <option value="unregistered">Not GST registered</option>
                      </select>
                    </label>
                    <label className="text-sm font-700 text-foreground">Identity document
                      <select className="input-base mt-2 w-full rounded-xl px-4 py-3" value={business.identityMethod} onChange={(event) => setBusiness((current) => ({ ...current, identityMethod: event.target.value as IdentityMethod, pan: '' }))}>
                        <option value="pan">PAN</option>
                        <option value="aadhaar_offline">Aadhaar Offline e-KYC</option>
                      </select>
                    </label>
                  </div>
                  {business.gstRegistrationStatus === 'registered' && (
                    <div>
                      <label className="text-sm font-700 text-foreground">GSTIN *
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <input className="input-base min-h-12 flex-1 rounded-xl px-4 py-3 uppercase" maxLength={15} value={business.gstin} onChange={(event) => { setBusiness((current) => ({ ...current, gstin: normalizeGstin(event.target.value) })); setGstMessage(''); }} placeholder="27AAAAA0000A1Z5" />
                          <button type="button" onClick={() => void checkGstin()} className="min-h-12 rounded-xl border border-primary/30 bg-primary/5 px-4 text-sm font-700 text-primary">Check GSTIN</button>
                        </div>
                      </label>
                      {gstMessage && <p className="mt-2 text-xs leading-5 text-muted-foreground">{gstMessage}</p>}
                    </div>
                  )}
                  {business.identityMethod === 'pan' && (
                    <label className="block text-sm font-700 text-foreground">PAN *
                      <input className="input-base mt-2 w-full rounded-xl px-4 py-3 uppercase" maxLength={10} value={business.pan} onChange={(event) => setBusiness((current) => ({ ...current, pan: normalizePan(event.target.value) }))} placeholder="AAAAA9999A" />
                    </label>
                  )}
                </div>
              )}

              <button type="button" disabled={submitting} onClick={() => void continueDetails()} className="btn-primary min-h-12 w-full rounded-xl px-5 disabled:opacity-60">
                {submitting ? 'Saving details…' : 'Continue to address'}
              </button>
            </div>
          )}

          {step === 'address' && (
            <div className="space-y-4">
              <label className="block text-sm font-700 text-foreground">Address line 1 *
                <input className="input-base mt-2 w-full rounded-xl px-4 py-3" value={address.line1} onChange={(event) => setAddress((current) => ({ ...current, line1: event.target.value }))} />
              </label>
              <label className="block text-sm font-700 text-foreground">Address line 2 <span className="font-500 text-muted-foreground">(optional)</span>
                <input className="input-base mt-2 w-full rounded-xl px-4 py-3" value={address.line2} onChange={(event) => setAddress((current) => ({ ...current, line2: event.target.value }))} />
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-700 text-foreground">City *
                  <input className="input-base mt-2 w-full rounded-xl px-4 py-3" value={address.city} onChange={(event) => setAddress((current) => ({ ...current, city: event.target.value }))} />
                </label>
                <label className="text-sm font-700 text-foreground">State *
                  <select className="input-base mt-2 w-full rounded-xl px-3 py-3" value={address.state} onChange={(event) => setAddress((current) => ({ ...current, state: event.target.value }))}>
                    <option value="">Select</option>
                    {INDIAN_STATES_AND_UTS.map((stateName) => <option key={stateName} value={stateName}>{stateName}</option>)}
                  </select>
                </label>
                <label className="text-sm font-700 text-foreground">PIN code *
                  <input inputMode="numeric" maxLength={6} className="input-base mt-2 w-full rounded-xl px-4 py-3" value={address.pincode} onChange={(event) => setAddress((current) => ({ ...current, pincode: event.target.value.replace(/\D/g, '').slice(0, 6) }))} />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => goTo('details')} className="ft-secondary-action min-h-12 rounded-xl px-5">Back</button>
                <button type="button" disabled={submitting} onClick={continueAddress} className="btn-primary min-h-12 rounded-xl px-5 disabled:opacity-60">
                  {submitting ? 'Completing…' : isRetail ? 'Continue to documents' : 'Complete buyer registration'}
                </button>
              </div>
            </div>
          )}

          {step === 'documents' && isRetail && (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
                Upload only the documents required for this retail-store profile. Files can be PDF or image up to 10 MB; Aadhaar Offline e-KYC may also be XML/ZIP.
              </div>
              {(['gst_certificate', 'pan_card', 'aadhaar_offline_ekyc', 'business_proof', 'address_proof'] as DocumentKey[])
                .filter((key) => requiredDocuments.includes(key) || key === 'address_proof')
                .map((key) => (
                  <label key={key} className="block rounded-xl border border-border bg-muted/20 p-4">
                    <span className="text-sm font-700 text-foreground">{documentLabels[key]} {requiredDocuments.includes(key) ? '*' : ''}</span>
                    <input type="file" className="mt-3 block w-full text-xs text-muted-foreground" accept={key === 'aadhaar_offline_ekyc' ? '.xml,.zip,.pdf,image/*' : '.pdf,image/*'} onChange={(event) => selectDocument(key, event.target.files?.[0])} />
                    {documents[key] && <span className="mt-2 block text-xs font-700 text-success">Selected: {documents[key]?.name}</span>}
                  </label>
                ))}
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => goTo('address')} className="ft-secondary-action min-h-12 rounded-xl px-5">Back</button>
                <button type="button" disabled={submitting} onClick={() => void completeRegistration()} className="btn-primary min-h-12 rounded-xl px-5 disabled:opacity-60">
                  {submitting ? 'Submitting profile…' : 'Submit retail-store profile'}
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="py-4 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-success/10 text-success">
                <Icon name="CheckCircleIcon" size={32} />
              </div>
              <h2 className="mt-5 text-2xl font-800 text-foreground">Buyer profile ready</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{completedMessage}</p>
              <button type="button" onClick={() => router.replace('/marketplace')} className="btn-primary mt-6 min-h-12 w-full rounded-xl px-5 sm:w-auto">Open marketplace</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
