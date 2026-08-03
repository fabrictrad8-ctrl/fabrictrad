'use client';

import { useMemo, useState, type FormEvent } from 'react';
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
import { OFFICIAL_GST_PORTAL_REFERENCE } from '@/lib/gstVerification';
import { normalizeEmail, normalizeIndianPhone, validateIndianPhone } from '@/lib/authValidation';
import { saveOnboardingDraftLocally, useOnboardingDraft } from '@/lib/hooks/useOnboardingDraft';

type BuyerType = 'retail_store' | 'end_user';
type Step = 'account' | 'business' | 'address' | 'documents' | 'done';
type IdentityMethod = 'pan' | 'aadhaar_offline';
type GstRegistrationStatus = 'registered' | 'unregistered';
type GstCheck = {
  status: 'idle' | 'checking' | 'active' | 'manual_review' | 'inactive' | 'cancelled' | 'invalid';
  message: string;
  legalName?: string | null;
  tradeName?: string | null;
};
type DocumentKey =
  | 'gst_certificate'
  | 'pan_card'
  | 'aadhaar_offline_ekyc'
  | 'business_proof'
  | 'address_proof';

type Props = { buyerType: BuyerType };

const labels: Record<DocumentKey, string> = {
  gst_certificate: 'GST registration certificate',
  pan_card: 'PAN card',
  aadhaar_offline_ekyc: 'UIDAI Paperless Offline e-KYC XML/ZIP',
  business_proof: 'Shop or business proof',
  address_proof: 'Business address proof (optional)',
};

const stepMeta: Record<Step, { label: string; icon: string }> = {
  account: { label: 'Account', icon: 'UserIcon' },
  business: { label: 'Business', icon: 'BuildingStorefrontIcon' },
  address: { label: 'Address', icon: 'MapPinIcon' },
  documents: { label: 'Documents', icon: 'DocumentCheckIcon' },
  done: { label: 'Done', icon: 'CheckCircleIcon' },
};

const fileOk = (file: File, aadhaarOffline = false) => {
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) return false;
  if (file.type === 'application/pdf' || file.type.startsWith('image/')) return true;
  return (
    aadhaarOffline &&
    ['application/xml', 'text/xml', 'application/zip', 'application/x-zip-compressed'].includes(file.type)
  );
};

export default function BuyerRegistrationFlowV2({ buyerType }: Props) {
  const { user, signUp, signInWithGoogle, googleAuthEnabled, checkEmailUnique, checkPhoneUnique } = useAuth();
  const steps = useMemo<Step[]>(
    () =>
      buyerType === 'retail_store'
        ? ['account', 'business', 'address', 'documents', 'done']
        : ['account', 'address', 'done'],
    [buyerType]
  );
  const [step, setStep] = useState<Step>('account');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [account, setAccount] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
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
  const [gstCheck, setGstCheck] = useState<GstCheck>({ status: 'idle', message: '' });

const draftPayload = useMemo(
  () => ({
    buyerType,
    account: { ...account, password: '', confirmPassword: '' },
    business,
    address,
    gstCheck,
  }),
  [account, address, business, buyerType, gstCheck]
);
const { clearDraft } = useOnboardingDraft({
  flow: 'buyer',
  userId: user?.id,
  step,
  payload: draftPayload,
  onRestore: (draft) => {
    if (draft.payload.account) setAccount((current) => ({ ...current, ...draft.payload.account, password: '', confirmPassword: '' }));
    if (draft.payload.business) setBusiness((current) => ({ ...current, ...draft.payload.business }));
    if (draft.payload.address) setAddress((current) => ({ ...current, ...draft.payload.address }));
    if (draft.payload.gstCheck) setGstCheck(draft.payload.gstCheck);
    if (steps.includes(draft.step as Step) && draft.step !== 'done') setStep(draft.step as Step);
    setResultMessage('Your saved registration draft was restored. Document files must be selected again for security.');
  },
});

const currentIndex = steps.indexOf(step);
  const requiredDocuments = useMemo<DocumentKey[]>(() => {
    if (buyerType !== 'retail_store') return [];
    const required: DocumentKey[] = ['business_proof'];
    required.push(business.identityMethod === 'pan' ? 'pan_card' : 'aadhaar_offline_ekyc');
    if (business.gstRegistrationStatus === 'registered') required.push('gst_certificate');
    return required;
  }, [business.gstRegistrationStatus, business.identityMethod, buyerType]);

  const goTo = (next: Step) => {
    setError('');
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const continueAccount = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const email = normalizeEmail(account.email);
    const phone = normalizeIndianPhone(account.phone);
    if (!account.fullName.trim()) return setError('Enter your full name.');
    if (!email) return setError('Enter your email address.');
    const phoneCheck = validateIndianPhone(phone);
    if (!phoneCheck.valid) return setError(phoneCheck.message);
    if (account.password.length < 8) return setError('Password must be at least 8 characters.');
    if (account.password !== account.confirmPassword) return setError('Passwords do not match.');

    setSubmitting(true);
    try {
      const [emailResult, phoneResult] = await Promise.all([
        checkEmailUnique(email),
        checkPhoneUnique(phone),
      ]);
      if (!emailResult.unique) {
        saveOnboardingDraftLocally('buyer', buyerType === 'retail_store' ? 'business' : 'address', {
          ...draftPayload,
          account: { ...draftPayload.account, email, phone },
        });
        const loginResponse = await fetch('/api/auth/password-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
          body: JSON.stringify({ email, password: account.password, next: '/buyer-registration?resume=1' }),
        });
        const loginPayload = (await loginResponse.json().catch(() => ({}))) as { error?: string };
        if (loginResponse.ok) {
          window.location.replace('/buyer-registration?resume=1');
          return;
        }
        setError(loginPayload.error || 'This account already exists. Use the correct password or reset it, then continue the saved registration.');
        return;
      }
      if (!phoneResult.unique) {
        setError('This mobile number belongs to another FabricTrad account. Sign in to that account instead of creating a duplicate.');
        return;
      }
      setAccount((current) => ({ ...current, email, phone }));
      goTo(buyerType === 'retail_store' ? 'business' : 'address');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not check the account details.');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyGstin = async () => {
    const gstin = normalizeGstin(business.gstin);
    setError('');
    setBusiness((current) => ({
      ...current,
      gstin,
      pan: current.identityMethod === 'pan' && validateGstinFormat(gstin) ? panFromGstin(gstin) : current.pan,
    }));
    if (!validateGstinFormat(gstin) || !validateGstinChecksum(gstin)) {
      setGstCheck({ status: 'invalid', message: 'The GSTIN format or check digit is invalid. Recheck the GST certificate.' });
      return;
    }
    setGstCheck({ status: 'checking', message: 'Checking the configured authorised GST verification service…' });
    try {
      const response = await fetch('/api/gstin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ gstin, subjectType: 'buyer', persist: false }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        status?: GstCheck['status'];
        message?: string;
        legalName?: string | null;
        tradeName?: string | null;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || payload.message || 'GSTIN could not be checked.');
      const status = payload.status || 'manual_review';
      setGstCheck({
        status,
        message: payload.message || 'Open the free official GST Portal to confirm the registration status.',
        legalName: payload.legalName,
        tradeName: payload.tradeName,
      });
      if (status === 'active' && payload.legalName && !business.businessName.trim()) {
        setBusiness((current) => ({ ...current, businessName: payload.legalName || current.businessName }));
      }
    } catch (caught) {
      setGstCheck({
        status: 'manual_review',
        message: `${caught instanceof Error ? caught.message : 'The authorised provider is unavailable.'} Use the free official GST Portal reference below and upload the GST certificate for review.`,
      });
    }
  };

  const continueBusiness = () => {
    setError('');
    if (!business.businessName.trim()) return setError('Enter your shop or legal business name.');
    if (business.identityMethod === 'pan' && !validatePan(business.pan)) {
      return setError('Enter a valid PAN in the format AAAAA9999A.');
    }
    if (business.gstRegistrationStatus === 'registered') {
      const gstin = normalizeGstin(business.gstin);
      if (!validateGstinFormat(gstin) || !validateGstinChecksum(gstin)) {
        return setError('Enter and check the GSTIN shown on the GST certificate.');
      }
      if (business.identityMethod === 'pan' && normalizePan(business.pan) !== gstin.slice(2, 12)) {
        return setError('The PAN must match characters 3–12 of the GSTIN.');
      }
      if (['idle', 'checking', 'invalid', 'inactive', 'cancelled'].includes(gstCheck.status)) {
        return setError('Complete the GSTIN check before continuing.');
      }
    }
    goTo('address');
  };

  const continueAddress = () => {
    setError('');
    if (!address.line1.trim() || !address.city.trim() || !address.state) {
      return setError('Enter the complete delivery address, city and state.');
    }
    if (!/^\d{6}$/.test(address.pincode)) return setError('Enter a valid 6-digit PIN code.');
    if (buyerType === 'retail_store') goTo('documents');
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
    if (buyerType === 'retail_store') {
      const missing = requiredDocuments.find((key) => !documents[key]);
      if (missing) return setError(`Upload the ${labels[missing]}.`);
    }

    setSubmitting(true);
    try {
      const signup = user ? { user, session: null, registrationNonce: '' } : await signUp(account.email, account.password, {
        fullName: account.fullName,
        phone: account.phone,
        role: 'buyer',
        businessName: buyerType === 'retail_store' ? business.businessName : '',
        gstin:
          buyerType === 'retail_store' && business.gstRegistrationStatus === 'registered'
            ? normalizeGstin(business.gstin)
            : '',
        pan:
          buyerType === 'retail_store' && business.identityMethod === 'pan'
            ? normalizePan(business.pan)
            : '',
        verificationMethod: buyerType === 'retail_store' ? business.identityMethod : 'none',
        identityReferenceLast4:
          buyerType === 'retail_store' && business.identityMethod === 'pan'
            ? normalizePan(business.pan).slice(-4)
            : '',
        addressLine1: address.line1,
        addressLine2: address.line2,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
      });
      if (!signup?.user?.id) throw new Error('The buyer login could not be created.');

      if (
        signup.session?.access_token &&
        buyerType === 'retail_store' &&
        business.gstRegistrationStatus === 'registered'
      ) {
        await fetch('/api/gstin/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${signup.session.access_token}`,
          },
          cache: 'no-store',
          body: JSON.stringify({
            gstin: normalizeGstin(business.gstin),
            subjectType: 'buyer',
            persist: true,
          }),
        }).catch(() => undefined);
      }

      const submission = new FormData();
      submission.set('userId', signup.user.id);
      submission.set('registrationNonce', signup.registrationNonce || '');
      submission.set(
        'payload',
        JSON.stringify({
          buyerType,
          fullName: account.fullName,
          phone: account.phone,
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
        headers: signup.session?.access_token
          ? { Authorization: `Bearer ${signup.session.access_token}` }
          : undefined,
        credentials: 'same-origin',
        body: submission,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'Buyer profile could not be completed.');
      await clearDraft();
      window.localStorage.removeItem('fabrictrad_buyer_type');
      window.sessionStorage.removeItem('fabrictrad_buyer_type');
      setResultMessage(payload.message || 'Your FabricTrad buyer account is ready.');
      goTo('done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle('buyer');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Google sign-up failed.');
      setSubmitting(false);
    }
  };

  return (
    <section className="min-h-screen bg-muted/30 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-7 text-center">
          <p className="text-xs font-800 uppercase tracking-[0.16em] text-primary">
            {buyerType === 'retail_store' ? 'Verified business buyer' : 'Personal buyer'}
          </p>
          <h1 className="mt-2 text-2xl font-800 text-foreground sm:text-3xl">
            {buyerType === 'retail_store' ? 'Create your Retail Store profile' : 'Create your Buy for me account'}
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {buyerType === 'retail_store'
              ? 'Business documents are kept private and reviewed for wholesale access and B2B invoicing.'
              : 'No PAN, Aadhaar, GST certificate or business documents are required for personal purchases.'}
          </p>
        </div>

        <div className="mb-7 flex items-start justify-between gap-2">
          {steps.map((item, index) => {
            const active = item === step;
            const complete = index < currentIndex;
            return (
              <div key={item} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                    complete
                      ? 'border-success bg-success text-white'
                      : active
                        ? 'border-primary bg-primary text-white'
                        : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  <Icon name={(complete ? 'CheckIcon' : stepMeta[item].icon) as 'UserIcon'} size={17} />
                </div>
                <span className={`hidden text-xs font-700 sm:block ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                  {stepMeta[item].label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
          {error && (
            <div role="alert" className="mb-5 flex gap-2 rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">
              <Icon name="ExclamationTriangleIcon" size={17} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'account' && (
            <form onSubmit={continueAccount} className="space-y-4">
              <div>
                <h2 className="text-xl font-800 text-foreground">Account details</h2>
                <p className="mt-1 text-sm text-muted-foreground">One email and mobile number can later be used for both buying and selling.</p>
              </div>
              {buyerType === 'end_user' && googleAuthEnabled && (
                <button type="button" onClick={handleGoogle} disabled={submitting} className="btn-secondary w-full py-3 text-sm disabled:opacity-50">
                  Continue with Google
                </button>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-700 text-foreground">Full name *
                  <input value={account.fullName} onChange={(event) => setAccount({ ...account, fullName: event.target.value })} className="input-base mt-1.5 w-full px-4 py-3 font-400" autoComplete="name" />
                </label>
                <label className="text-sm font-700 text-foreground">Mobile number *
                  <input value={account.phone} onChange={(event) => setAccount({ ...account, phone: normalizeIndianPhone(event.target.value) })} className="input-base mt-1.5 w-full px-4 py-3 font-400" inputMode="numeric" maxLength={10} placeholder="9876543210" autoComplete="tel" />
                </label>
              </div>
              <label className="block text-sm font-700 text-foreground">Email address *
                <input type="email" value={account.email} onChange={(event) => setAccount({ ...account, email: normalizeEmail(event.target.value) })} className="input-base mt-1.5 w-full px-4 py-3 font-400" autoComplete="email" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-700 text-foreground">Password *
                  <span className="relative mt-1.5 block">
                    <input type={showPassword ? 'text' : 'password'} value={account.password} onChange={(event) => setAccount({ ...account, password: event.target.value })} className="input-base w-full px-4 py-3 pr-11 font-400" autoComplete="new-password" />
                    <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={17} />
                    </button>
                  </span>
                </label>
                <label className="text-sm font-700 text-foreground">Confirm password *
                  <input type="password" value={account.confirmPassword} onChange={(event) => setAccount({ ...account, confirmPassword: event.target.value })} className="input-base mt-1.5 w-full px-4 py-3 font-400" autoComplete="new-password" />
                </label>
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-sm disabled:opacity-50">
                {submitting ? 'Checking details…' : 'Continue'}
              </button>
              <p className="text-center text-xs text-muted-foreground">Already registered? <Link href="/login" className="font-800 text-primary">Sign in</Link></p>
            </form>
          )}

          {step === 'business' && buyerType === 'retail_store' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-800 text-foreground">Business and tax identity</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">GST registration is not mandatory for every small shop. Tell us the correct status; do not enter somebody else’s GSTIN.</p>
              </div>
              <label className="block text-sm font-700 text-foreground">Shop / legal business name *
                <input value={business.businessName} onChange={(event) => setBusiness({ ...business, businessName: event.target.value })} className="input-base mt-1.5 w-full px-4 py-3 font-400" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                {(['registered', 'unregistered'] as GstRegistrationStatus[]).map((status) => (
                  <button key={status} type="button" onClick={() => { setBusiness({ ...business, gstRegistrationStatus: status }); setGstCheck({ status: 'idle', message: '' }); }} className={`rounded-2xl border p-4 text-left ${business.gstRegistrationStatus === status ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <p className="font-800 text-foreground">{status === 'registered' ? 'GST registered' : 'Not GST registered'}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{status === 'registered' ? 'GSTIN will be checked for B2B tax invoices.' : 'Business KYC is still required, but no GSTIN or ITC claim is shown.'}</p>
                  </button>
                ))}
              </div>
              {business.gstRegistrationStatus === 'registered' && (
                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <label className="block text-sm font-700 text-foreground">GSTIN *
                    <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                      <input value={business.gstin} onChange={(event) => { setBusiness({ ...business, gstin: normalizeGstin(event.target.value) }); setGstCheck({ status: 'idle', message: '' }); }} className="input-base min-w-0 flex-1 px-4 py-3 font-mono uppercase" maxLength={15} placeholder="27AAPFU0939F1ZV" autoComplete="off" />
                      <button type="button" onClick={verifyGstin} disabled={gstCheck.status === 'checking'} className="btn-secondary px-5 py-3 text-sm disabled:opacity-50">{gstCheck.status === 'checking' ? 'Checking…' : 'Check GSTIN'}</button>
                    </div>
                  </label>
                  <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-xs leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span><strong className="text-foreground">Free official reference:</strong> GST Portal Search Taxpayer requires the GSTIN and a captcha. It is not a payment-gateway service.</span><a href={OFFICIAL_GST_PORTAL_REFERENCE.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-primary/30 px-3 py-2 font-800 text-primary hover:bg-primary/5"><Icon name="ArrowTopRightOnSquareIcon" size={15} />Open official GST Portal</a></div>
                  {gstCheck.message && (
                    <div aria-live="polite" className={`mt-3 rounded-xl border p-3 text-xs leading-5 ${gstCheck.status === 'active' ? 'border-success/30 bg-success/10 text-success' : gstCheck.status === 'invalid' || gstCheck.status === 'cancelled' || gstCheck.status === 'inactive' ? 'border-error/30 bg-error/10 text-error' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
                      <p className="font-800">{gstCheck.message}</p>
                      {(gstCheck.legalName || gstCheck.tradeName) && <p className="mt-1">{gstCheck.legalName}{gstCheck.tradeName ? ` · ${gstCheck.tradeName}` : ''}</p>}
                      {gstCheck.status === 'manual_review' && <p className="mt-2">Confirm that the portal shows <strong>Active</strong>, then continue and upload the GST registration certificate.</p>}
                    </div>
                  )}
                  <p className="mt-3 text-xs leading-5 text-muted-foreground"><strong>Tax note:</strong> GST is still charged. A verified GSTIN is printed on the B2B invoice and may support eligible input tax credit.</p>
                </div>
              )}
              <div>
                <p className="text-sm font-700 text-foreground">Identity verification *</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setBusiness({ ...business, identityMethod: 'pan', pan: validateGstinFormat(business.gstin) ? panFromGstin(business.gstin) : business.pan })} className={`rounded-xl border p-3 text-left ${business.identityMethod === 'pan' ? 'border-primary bg-primary/5' : 'border-border'}`}><p className="font-800 text-foreground">PAN</p><p className="mt-1 text-xs text-muted-foreground">Business/proprietor PAN plus card document.</p></button>
                  <button type="button" onClick={() => setBusiness({ ...business, identityMethod: 'aadhaar_offline', pan: '' })} className={`rounded-xl border p-3 text-left ${business.identityMethod === 'aadhaar_offline' ? 'border-primary bg-primary/5' : 'border-border'}`}><p className="font-800 text-foreground">Aadhaar Offline e-KYC</p><p className="mt-1 text-xs text-muted-foreground">Voluntary UIDAI XML/ZIP. The full Aadhaar number is not requested or stored.</p></button>
                </div>
              </div>
              {business.identityMethod === 'pan' && (
                <label className="block text-sm font-700 text-foreground">PAN number *
                  <input value={business.pan} onChange={(event) => setBusiness({ ...business, pan: normalizePan(event.target.value) })} className="input-base mt-1.5 w-full px-4 py-3 font-mono uppercase" maxLength={10} placeholder="AAAAA9999A" />
                </label>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => goTo('account')} className="btn-secondary flex-1 py-3 text-sm">Back</button>
                <button type="button" onClick={continueBusiness} className="btn-primary flex-1 py-3 text-sm">Continue</button>
              </div>
            </div>
          )}

          {step === 'address' && (
            <div className="space-y-4">
              <div><h2 className="text-xl font-800 text-foreground">Delivery address</h2><p className="mt-1 text-sm text-muted-foreground">Used for shipping and place-of-supply tax calculation.</p></div>
              <label className="block text-sm font-700 text-foreground">Address line 1 *<input value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label>
              <label className="block text-sm font-700 text-foreground">Address line 2<input value={address.line2} onChange={(event) => setAddress({ ...address, line2: event.target.value })} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-700 text-foreground">City *<input value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label>
                <label className="text-sm font-700 text-foreground">State *<select value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value })} className="input-base mt-1.5 w-full px-3 py-3 font-400"><option value="">Select</option>{INDIAN_STATES_AND_UTS.map((stateName) => <option key={stateName} value={stateName}>{stateName}</option>)}</select></label>
                <label className="text-sm font-700 text-foreground">PIN code *<input value={address.pincode} onChange={(event) => setAddress({ ...address, pincode: event.target.value.replace(/\D/g, '').slice(0, 6) })} className="input-base mt-1.5 w-full px-4 py-3 font-mono font-400" inputMode="numeric" /></label>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => goTo(buyerType === 'retail_store' ? 'business' : 'account')} className="btn-secondary flex-1 py-3 text-sm">Back</button>
                <button type="button" onClick={continueAddress} disabled={submitting} className="btn-primary flex-1 py-3 text-sm disabled:opacity-50">{submitting ? 'Creating account…' : buyerType === 'retail_store' ? 'Continue' : 'Create account'}</button>
              </div>
            </div>
          )}

          {step === 'documents' && buyerType === 'retail_store' && (
            <div className="space-y-5">
              <div><h2 className="text-xl font-800 text-foreground">Private business documents</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Files are stored in a private bucket and are visible only to your account and authorised FabricTrad reviewers.</p></div>
              {requiredDocuments.concat(['address_proof']).filter((value, index, list) => list.indexOf(value) === index).map((key) => (
                <label key={key} className="block rounded-2xl border border-dashed border-border p-4 hover:border-primary/50">
                  <span className="flex items-start justify-between gap-3"><span><span className="block text-sm font-800 text-foreground">{labels[key]}</span><span className="mt-1 block text-xs text-muted-foreground">{requiredDocuments.includes(key) ? 'Required' : 'Optional'} · PDF/image up to 10 MB{key === 'aadhaar_offline_ekyc' ? ' · XML/ZIP accepted' : ''}</span></span><Icon name={documents[key] ? 'CheckCircleIcon' : 'ArrowUpTrayIcon'} size={20} className={documents[key] ? 'text-success' : 'text-primary'} /></span>
                  <input type="file" className="sr-only" accept={key === 'aadhaar_offline_ekyc' ? '.xml,.zip,application/xml,text/xml,application/zip,application/pdf,image/*' : 'application/pdf,image/*'} onChange={(event) => selectDocument(key, event.target.files?.[0])} />
                  {documents[key] && <span className="mt-2 block truncate text-xs font-700 text-success">{documents[key]?.name}</span>}
                </label>
              ))}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Aadhaar privacy:</strong> FabricTrad does not ask for the 12-digit Aadhaar number. Use UIDAI Paperless Offline e-KYC only; do not upload an ordinary Aadhaar photocopy.</div>
              <div className="flex gap-3"><button type="button" onClick={() => goTo('address')} className="btn-secondary flex-1 py-3 text-sm">Back</button><button type="button" onClick={completeRegistration} disabled={submitting} className="btn-primary flex-1 py-3 text-sm disabled:opacity-50">{submitting ? 'Submitting securely…' : 'Create business buyer account'}</button></div>
            </div>
          )}

          {step === 'done' && (
            <div className="py-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success"><Icon name="CheckCircleIcon" size={34} /></div>
              <h2 className="mt-5 text-2xl font-800 text-foreground">Account created</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{resultMessage}</p>
              {buyerType === 'retail_store' && <div className="mx-auto mt-5 max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-3 text-left text-xs leading-5 text-amber-900">Business purchases are available while review is pending. GSTIN-based B2B invoice details and eligible ITC messaging appear only after the GSTIN is confirmed Active.</div>}
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/login" className="btn-primary px-6 py-3 text-sm">Sign in</Link><Link href="/marketplace" className="btn-secondary px-6 py-3 text-sm">Browse marketplace</Link></div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
