'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { INDIAN_STATES_AND_UTS } from '@/lib/india';
import {
  normalizeGstin,
  normalizePan,
  panFromGstin,
  validateGstinChecksum,
  validateGstinFormat,
  validatePan,
} from '@/lib/commerceIdentifiers';
import { normalizeEmail, normalizeIndianPhone, validateIndianPhone } from '@/lib/authValidation';

type Step = 'account' | 'business' | 'bank' | 'documents' | 'done';
type GstStatus = 'idle' | 'checking' | 'active' | 'manual_review' | 'inactive' | 'cancelled' | 'invalid';
type DocumentKey = 'gst_certificate' | 'pan_card' | 'cancelled_cheque' | 'business_proof' | 'address_proof';

const documentLabels: Record<DocumentKey, string> = {
  gst_certificate: 'GST registration certificate',
  pan_card: 'Business / proprietor PAN card',
  cancelled_cheque: 'Cancelled cheque or bank statement',
  business_proof: 'Udyam, incorporation or business proof (optional)',
  address_proof: 'Business address proof (optional)',
};

const steps: Array<{ key: Step; label: string; icon: string }> = [
  { key: 'account', label: 'Account', icon: 'UserIcon' },
  { key: 'business', label: 'GST business', icon: 'BuildingOfficeIcon' },
  { key: 'bank', label: 'Settlement', icon: 'BanknotesIcon' },
  { key: 'documents', label: 'Documents', icon: 'DocumentCheckIcon' },
  { key: 'done', label: 'Done', icon: 'CheckCircleIcon' },
];

const requiredDocuments: DocumentKey[] = ['gst_certificate', 'pan_card', 'cancelled_cheque'];
const businessTypes = ['Manufacturer', 'Wholesaler', 'Trader', 'Exporter', 'Weaver', 'Processor', 'Retailer'];
const categories = ['Silk Fabrics', 'Cotton & Linen', 'Net & Embroidered', 'Georgette', 'Polyester', 'Handloom', 'Synthetic Blends', 'Woollen'];

const fileAllowed = (file: File) =>
  file.size > 0 &&
  file.size <= 10 * 1024 * 1024 &&
  (file.type === 'application/pdf' || file.type.startsWith('image/'));

export default function SellerRegistrationFlowV2() {
  const { user, profile, signUp, checkEmailUnique, checkPhoneUnique, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>(user ? 'business' : 'account');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [gstStatus, setGstStatus] = useState<GstStatus>('idle');
  const [gstMessage, setGstMessage] = useState('');
  const [gstNames, setGstNames] = useState({ legalName: '', tradeName: '' });
  const [documents, setDocuments] = useState<Partial<Record<DocumentKey, File>>>({});
  const [form, setForm] = useState({
    ownerName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    businessName: '',
    businessType: '',
    gstin: '',
    pan: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    categories: [] as string[],
    monthlyCapacity: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankAccountName: '',
    bankName: '',
  });

  const visibleSteps = useMemo(() => (user ? steps.filter((item) => item.key !== 'account') : steps), [user]);
  const currentIndex = visibleSteps.findIndex((item) => item.key === step);

  useEffect(() => {
    if (!user) return;
    setForm((current) => ({
      ...current,
      ownerName: current.ownerName || profile?.full_name || '',
      email: current.email || user.email || '',
      phone: current.phone || profile?.phone || '',
      businessName: current.businessName || profile?.business_name || '',
      gstin: current.gstin || profile?.gstin || '',
      address: current.address || profile?.address_line1 || '',
      city: current.city || profile?.city || '',
      state: current.state || profile?.state || '',
      pincode: current.pincode || profile?.pincode || '',
    }));
  }, [profile, user]);

  const goTo = (next: Step) => {
    setError('');
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const continueAccount = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const email = normalizeEmail(form.email);
    const phone = normalizeIndianPhone(form.phone);
    if (!form.ownerName.trim()) return setError('Enter the owner or authorised contact name.');
    if (!email) return setError('Enter the business email address.');
    const phoneResult = validateIndianPhone(phone);
    if (!phoneResult.valid) return setError(phoneResult.message);
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');

    setSubmitting(true);
    try {
      const [emailCheck, phoneCheck] = await Promise.all([
        checkEmailUnique(email),
        checkPhoneUnique(phone),
      ]);
      if (!emailCheck.unique || !phoneCheck.unique) {
        setError('This email or mobile number already belongs to a FabricTrad account. Sign in and activate selling on that account.');
        return;
      }
      setForm((current) => ({ ...current, email, phone }));
      goTo('business');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not check the account details.');
    } finally {
      setSubmitting(false);
    }
  };

  const checkGstin = async () => {
    const gstin = normalizeGstin(form.gstin);
    update('gstin', gstin);
    if (!validateGstinFormat(gstin) || !validateGstinChecksum(gstin)) {
      setGstStatus('invalid');
      setGstMessage('The GSTIN format or check digit is invalid.');
      return;
    }
    update('pan', panFromGstin(gstin));
    setGstStatus('checking');
    setGstMessage('Checking GST registration status…');
    try {
      const response = await fetch('/api/gstin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ gstin, subjectType: 'seller', persist: Boolean(user) }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        status?: GstStatus;
        message?: string;
        legalName?: string | null;
        tradeName?: string | null;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || payload.message || 'GSTIN could not be checked.');
      const nextStatus = payload.status || 'manual_review';
      setGstStatus(nextStatus);
      setGstMessage(payload.message || 'GSTIN queued for official review.');
      setGstNames({ legalName: payload.legalName || '', tradeName: payload.tradeName || '' });
      if (payload.legalName && !form.businessName.trim()) update('businessName', payload.legalName);
    } catch (caught) {
      setGstStatus('manual_review');
      setGstMessage(`${caught instanceof Error ? caught.message : 'Provider unavailable.'} The application may be saved, but live publishing remains locked until official review.`);
    }
  };

  const continueBusiness = () => {
    setError('');
    const gstin = normalizeGstin(form.gstin);
    const pan = normalizePan(form.pan);
    if (!form.businessName.trim() || !form.businessType) return setError('Enter the legal business name and type.');
    if (!form.address.trim() || !form.city.trim() || !form.state || !/^\d{6}$/.test(form.pincode)) {
      return setError('Enter the complete registered or pickup address.');
    }
    if (!validateGstinFormat(gstin) || !validateGstinChecksum(gstin)) return setError('Enter a valid GSTIN.');
    if (!validatePan(pan) || pan !== panFromGstin(gstin)) return setError('The PAN must match characters 3–12 of the GSTIN.');
    if (['idle', 'checking', 'invalid', 'inactive', 'cancelled'].includes(gstStatus)) {
      return setError('Complete the GSTIN check. Cancelled or inactive registrations cannot be onboarded for selling.');
    }
    if (!form.categories.length) return setError('Choose at least one textile category.');
    goTo('bank');
  };

  const continueBank = () => {
    setError('');
    const accountNumber = form.bankAccountNumber.replace(/\D/g, '');
    const ifsc = form.bankIfsc.toUpperCase().trim();
    if (!/^\d{9,18}$/.test(accountNumber)) return setError('Enter a valid bank account number.');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return setError('Enter a valid IFSC code.');
    if (!form.bankAccountName.trim() || !form.bankName.trim()) return setError('Enter the account-holder and bank names.');
    setForm((current) => ({ ...current, bankAccountNumber: accountNumber, bankIfsc: ifsc }));
    goTo('documents');
  };

  const selectDocument = (key: DocumentKey, file: File | undefined) => {
    if (!file) return;
    if (!fileAllowed(file)) return setError('Documents must be PDF or image files up to 10 MB.');
    setError('');
    setDocuments((current) => ({ ...current, [key]: file }));
  };

  const submit = async () => {
    setError('');
    const missing = requiredDocuments.find((key) => !documents[key]);
    if (missing) return setError(`Upload the ${documentLabels[missing]}.`);
    setSubmitting(true);
    try {
      let activeUserId = user?.id || '';
      let registrationNonce = '';
      let accessToken = '';
      if (!user) {
        const signup = await signUp(form.email, form.password, {
          fullName: form.ownerName,
          phone: normalizeIndianPhone(form.phone),
          role: 'seller',
          businessName: form.businessName,
          businessType: form.businessType,
          gstin: normalizeGstin(form.gstin),
          pan: normalizePan(form.pan),
          categories: form.categories,
          monthlyCapacity: form.monthlyCapacity,
          addressLine1: form.address,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
        });
        if (!signup?.user?.id) throw new Error('The seller login could not be created.');
        activeUserId = signup.user.id;
        registrationNonce = signup.registrationNonce || '';
        accessToken = signup.session?.access_token || '';
      }

      const application = new FormData();
      if (activeUserId) application.set('userId', activeUserId);
      if (registrationNonce) application.set('registrationNonce', registrationNonce);
      application.set(
        'payload',
        JSON.stringify({
          ownerName: form.ownerName,
          phone: normalizeIndianPhone(form.phone),
          businessName: form.businessName,
          businessType: form.businessType,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          address: form.address,
          categories: form.categories,
          monthlyCapacity: form.monthlyCapacity,
          gstin: normalizeGstin(form.gstin),
          pan: normalizePan(form.pan),
          bankAccountNumber: form.bankAccountNumber,
          bankIfsc: form.bankIfsc,
          bankAccountName: form.bankAccountName,
          bankName: form.bankName,
        })
      );
      Object.entries(documents).forEach(([key, file]) => {
        if (file) application.set(`document_${key}`, file);
      });

      const endpoint = user ? '/api/account/enable-selling' : '/api/registration/seller/finalize';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        credentials: 'same-origin',
        body: application,
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; warning?: string; message?: string };
      if (!response.ok && response.status !== 207) throw new Error(payload.error || 'Seller onboarding could not be submitted.');

      await fetch('/api/gstin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ gstin: normalizeGstin(form.gstin), subjectType: 'seller', persist: true }),
      }).catch(() => undefined);
      if (user) await refreshProfile().catch(() => undefined);

      setResultMessage(
        gstStatus === 'active'
          ? 'GSTIN and seller application submitted. Document and bank review will determine settlement eligibility.'
          : 'Seller application saved for official GST review. You may prepare drafts, but live publishing and settlements remain locked until the GSTIN is confirmed active.'
      );
      goTo('done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Seller onboarding failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="min-h-screen bg-muted/30 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-7 text-center">
          <p className="text-xs font-800 uppercase tracking-[0.16em] text-primary">Verified seller onboarding</p>
          <h1 className="mt-2 text-2xl font-800 text-foreground sm:text-3xl">{user ? 'Activate selling on this account' : 'Create your FabricTrad seller account'}</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">A live seller needs an active GSTIN, matching PAN, settlement details and private supporting documents. Format-only validation is not treated as verified.</p>
        </div>

        <div className="mb-7 flex items-start justify-between gap-2">
          {visibleSteps.map((item, index) => {
            const active = item.key === step;
            const complete = index < currentIndex;
            return (
              <div key={item.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${complete ? 'border-success bg-success text-white' : active ? 'border-primary bg-primary text-white' : 'border-border bg-card text-muted-foreground'}`}>
                  <Icon name={(complete ? 'CheckIcon' : item.icon) as 'UserIcon'} size={17} />
                </div>
                <span className={`hidden text-xs font-700 sm:block ${active ? 'text-primary' : 'text-muted-foreground'}`}>{item.label}</span>
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
          {error && <div role="alert" className="mb-5 flex gap-2 rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error"><Icon name="ExclamationTriangleIcon" size={17} className="mt-0.5 shrink-0" />{error}</div>}

          {step === 'account' && !user && (
            <form onSubmit={continueAccount} className="space-y-4">
              <div><h2 className="text-xl font-800 text-foreground">Account details</h2><p className="mt-1 text-sm text-muted-foreground">Already buying on FabricTrad? Sign in instead and activate selling on the same account.</p></div>
              <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-700 text-foreground">Owner / contact name *<input value={form.ownerName} onChange={(event) => update('ownerName', event.target.value)} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label><label className="text-sm font-700 text-foreground">Mobile number *<input value={form.phone} onChange={(event) => update('phone', normalizeIndianPhone(event.target.value))} className="input-base mt-1.5 w-full px-4 py-3 font-400" inputMode="numeric" maxLength={10} /></label></div>
              <label className="block text-sm font-700 text-foreground">Email address *<input type="email" value={form.email} onChange={(event) => update('email', normalizeEmail(event.target.value))} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label>
              <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-700 text-foreground">Password *<span className="relative mt-1.5 block"><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => update('password', event.target.value)} className="input-base w-full px-4 py-3 pr-11 font-400" /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={17} /></button></span></label><label className="text-sm font-700 text-foreground">Confirm password *<input type="password" value={form.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label></div>
              <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-sm disabled:opacity-50">{submitting ? 'Checking…' : 'Continue'}</button>
              <p className="text-center text-xs text-muted-foreground">Existing account? <Link href="/login?next=/seller-registration" className="font-800 text-primary">Sign in and activate selling</Link></p>
            </form>
          )}

          {step === 'business' && (
            <div className="space-y-5">
              <div><h2 className="text-xl font-800 text-foreground">GST business identity</h2><p className="mt-1 text-sm text-muted-foreground">The legal name and registration state are checked through a configured authorised provider or queued for official GST portal review.</p></div>
              <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-700 text-foreground">Legal business name *<input value={form.businessName} onChange={(event) => update('businessName', event.target.value)} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label><label className="text-sm font-700 text-foreground">Business type *<select value={form.businessType} onChange={(event) => update('businessType', event.target.value)} className="input-base mt-1.5 w-full px-3 py-3 font-400"><option value="">Select</option>{businessTypes.map((value) => <option key={value}>{value}</option>)}</select></label></div>
              <label className="block text-sm font-700 text-foreground">GSTIN *<div className="mt-1.5 flex flex-col gap-2 sm:flex-row"><input value={form.gstin} onChange={(event) => { update('gstin', normalizeGstin(event.target.value)); setGstStatus('idle'); setGstMessage(''); }} className="input-base min-w-0 flex-1 px-4 py-3 font-mono uppercase" maxLength={15} placeholder="27AAPFU0939F1ZV" /><button type="button" onClick={checkGstin} disabled={gstStatus === 'checking'} className="btn-secondary px-5 py-3 text-sm disabled:opacity-50">{gstStatus === 'checking' ? 'Checking…' : 'Verify GSTIN'}</button></div></label>
              {gstMessage && <div className={`rounded-xl border p-3 text-xs leading-5 ${gstStatus === 'active' ? 'border-success/30 bg-success/10 text-success' : gstStatus === 'invalid' || gstStatus === 'inactive' || gstStatus === 'cancelled' ? 'border-error/30 bg-error/10 text-error' : 'border-amber-300 bg-amber-50 text-amber-900'}`}><p className="font-800">{gstMessage}</p>{(gstNames.legalName || gstNames.tradeName) && <p className="mt-1">{gstNames.legalName}{gstNames.tradeName ? ` · ${gstNames.tradeName}` : ''}</p>}</div>}
              <label className="block text-sm font-700 text-foreground">PAN embedded in GSTIN *<input value={form.pan} onChange={(event) => update('pan', normalizePan(event.target.value))} className="input-base mt-1.5 w-full px-4 py-3 font-mono uppercase" maxLength={10} /></label>
              <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-700 text-foreground">Registered / pickup address *<textarea value={form.address} onChange={(event) => update('address', event.target.value)} rows={3} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label><div className="space-y-4"><label className="block text-sm font-700 text-foreground">City *<input value={form.city} onChange={(event) => update('city', event.target.value)} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-700 text-foreground">State *<select value={form.state} onChange={(event) => update('state', event.target.value)} className="input-base mt-1.5 w-full px-2 py-3 font-400"><option value="">Select</option>{INDIAN_STATES_AND_UTS.map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-sm font-700 text-foreground">PIN *<input value={form.pincode} onChange={(event) => update('pincode', event.target.value.replace(/\D/g, '').slice(0, 6))} className="input-base mt-1.5 w-full px-3 py-3 font-mono font-400" /></label></div></div></div>
              <div><p className="text-sm font-700 text-foreground">Product categories *</p><div className="mt-2 flex flex-wrap gap-2">{categories.map((category) => { const selected = form.categories.includes(category); return <button key={category} type="button" onClick={() => update('categories', selected ? form.categories.filter((item) => item !== category) : [...form.categories, category])} className={`rounded-full border px-3 py-2 text-xs font-700 ${selected ? 'border-primary bg-primary text-white' : 'border-border text-muted-foreground'}`}>{category}</button>; })}</div></div>
              <label className="block text-sm font-700 text-foreground">Approximate monthly capacity<input value={form.monthlyCapacity} onChange={(event) => update('monthlyCapacity', event.target.value)} className="input-base mt-1.5 w-full px-4 py-3 font-400" placeholder="e.g. 2,000 metres" /></label>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Publishing gate:</strong> a valid format alone does not unlock live listings. Until the GST registration is confirmed active, products can only remain drafts.</div>
              <div className="flex gap-3">{!user && <button type="button" onClick={() => goTo('account')} className="btn-secondary flex-1 py-3 text-sm">Back</button>}<button type="button" onClick={continueBusiness} className="btn-primary flex-1 py-3 text-sm">Continue</button></div>
            </div>
          )}

          {step === 'bank' && (
            <div className="space-y-4">
              <div><h2 className="text-xl font-800 text-foreground">Settlement account</h2><p className="mt-1 text-sm text-muted-foreground">The account holder should match the verified business or proprietor. Only a masked account reference is stored in the profile database.</p></div>
              <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-700 text-foreground">Account holder name *<input value={form.bankAccountName} onChange={(event) => update('bankAccountName', event.target.value)} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label><label className="text-sm font-700 text-foreground">Bank name *<input value={form.bankName} onChange={(event) => update('bankName', event.target.value)} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label></div>
              <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-700 text-foreground">Account number *<input value={form.bankAccountNumber} onChange={(event) => update('bankAccountNumber', event.target.value.replace(/\D/g, '').slice(0, 18))} className="input-base mt-1.5 w-full px-4 py-3 font-mono font-400" inputMode="numeric" /></label><label className="text-sm font-700 text-foreground">IFSC *<input value={form.bankIfsc} onChange={(event) => update('bankIfsc', event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))} className="input-base mt-1.5 w-full px-4 py-3 font-mono uppercase font-400" /></label></div>
              <div className="flex gap-3"><button type="button" onClick={() => goTo('business')} className="btn-secondary flex-1 py-3 text-sm">Back</button><button type="button" onClick={continueBank} className="btn-primary flex-1 py-3 text-sm">Continue</button></div>
            </div>
          )}

          {step === 'documents' && (
            <div className="space-y-4">
              <div><h2 className="text-xl font-800 text-foreground">Private verification documents</h2><p className="mt-1 text-sm text-muted-foreground">Required files are stored privately and reviewed before settlement activation.</p></div>
              {(Object.keys(documentLabels) as DocumentKey[]).map((key) => (
                <label key={key} className="block rounded-2xl border border-dashed border-border p-4 hover:border-primary/50"><span className="flex items-start justify-between gap-3"><span><span className="block text-sm font-800 text-foreground">{documentLabels[key]}</span><span className="mt-1 block text-xs text-muted-foreground">{requiredDocuments.includes(key) ? 'Required' : 'Optional'} · PDF/image · 10 MB maximum</span></span><Icon name={documents[key] ? 'CheckCircleIcon' : 'ArrowUpTrayIcon'} size={20} className={documents[key] ? 'text-success' : 'text-primary'} /></span><input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(event) => selectDocument(key, event.target.files?.[0])} />{documents[key] && <span className="mt-2 block truncate text-xs font-700 text-success">{documents[key]?.name}</span>}</label>
              ))}
              <div className="flex gap-3"><button type="button" onClick={() => goTo('bank')} className="btn-secondary flex-1 py-3 text-sm">Back</button><button type="button" onClick={submit} disabled={submitting} className="btn-primary flex-1 py-3 text-sm disabled:opacity-50">{submitting ? 'Submitting securely…' : 'Submit seller application'}</button></div>
            </div>
          )}

          {step === 'done' && (
            <div className="py-4 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success"><Icon name="CheckCircleIcon" size={34} /></div><h2 className="mt-5 text-2xl font-800 text-foreground">Application submitted</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{resultMessage}</p><div className="mx-auto mt-5 max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-3 text-left text-xs leading-5 text-amber-900">GST is not removed for GST-registered transactions. A verified seller issues the applicable tax invoice; registered buyers may claim eligible input tax credit subject to statutory conditions.</div><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/seller-dashboard" className="btn-primary px-6 py-3 text-sm">Open seller workspace</Link><Link href="/marketplace" className="btn-secondary px-6 py-3 text-sm">View marketplace</Link></div></div>
          )}
        </div>
      </div>
    </section>
  );
}
