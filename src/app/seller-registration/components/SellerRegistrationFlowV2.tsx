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
import { OFFICIAL_GST_PORTAL_REFERENCE } from '@/lib/gstVerification';
import { normalizeEmail, normalizeIndianPhone, validateIndianPhone } from '@/lib/authValidation';
import { useOnboardingDraft } from '@/lib/hooks/useOnboardingDraft';

type Step = 'account' | 'business' | 'bank' | 'documents' | 'done';
type GstStatus = 'idle' | 'checking' | 'active' | 'manual_review' | 'inactive' | 'cancelled' | 'invalid';
type DocumentKey = 'gst_certificate' | 'pan_card' | 'cancelled_cheque' | 'business_proof' | 'address_proof';

type FormState = {
  ownerName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  businessName: string;
  businessType: string;
  gstin: string;
  pan: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  categories: string[];
  monthlyCapacity: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankAccountName: string;
  bankName: string;
};

type SellerDraft = {
  form?: Partial<Omit<FormState, 'password' | 'confirmPassword' | 'bankAccountNumber'>>;
  gstStatus?: GstStatus;
  gstMessage?: string;
  gstNames?: { legalName: string; tradeName: string };
};

type SellerStatus = {
  applicationSubmitted?: boolean;
  profileComplete?: boolean;
  bankDetailsPresent?: boolean;
  gstinStatus?: string;
  application?: {
    ownerName?: string | null;
    businessName?: string | null;
    businessType?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    address?: string | null;
    categories?: string[];
    monthlyCapacity?: string | null;
    gstin?: string | null;
    pan?: string | null;
    bankIfsc?: string | null;
    bankAccountName?: string | null;
    bankName?: string | null;
  };
  documents?: Array<{
    document_type: string;
    file_name: string | null;
    upload_status: string;
  }>;
};

type SavedDocument = { fileName: string; status: string };

type SaveResponse = {
  error?: string;
  warning?: string;
  message?: string;
  applicationSubmitted?: boolean;
  missingDocuments?: string[];
};

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

const initialForm: FormState = {
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
  categories: [],
  monthlyCapacity: '',
  bankAccountNumber: '',
  bankIfsc: '',
  bankAccountName: '',
  bankName: '',
};

const fileAllowed = (file: File) =>
  file.size > 0 &&
  file.size <= 10 * 1024 * 1024 &&
  (file.type === 'application/pdf' || file.type.startsWith('image/'));

const validStep = (value: string): value is Step =>
  ['account', 'business', 'bank', 'documents', 'done'].includes(value);

const validGstStatus = (value: unknown): value is GstStatus =>
  ['idle', 'checking', 'active', 'manual_review', 'inactive', 'cancelled', 'invalid'].includes(
    String(value)
  );

export default function SellerRegistrationFlowV2() {
  const { user, profile, signUp, checkEmailUnique, checkPhoneUnique, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>(user ? 'business' : 'account');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [progressMessage, setProgressMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [gstStatus, setGstStatus] = useState<GstStatus>('idle');
  const [gstMessage, setGstMessage] = useState('');
  const [gstNames, setGstNames] = useState({ legalName: '', tradeName: '' });
  const [documents, setDocuments] = useState<Partial<Record<DocumentKey, File>>>({});
  const [savedDocuments, setSavedDocuments] = useState<Partial<Record<DocumentKey, SavedDocument>>>({});
  const [uploadingDocuments, setUploadingDocuments] = useState<Partial<Record<DocumentKey, boolean>>>({});
  const [form, setForm] = useState<FormState>(initialForm);

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

  const draftPayload = useMemo<SellerDraft>(
    () => ({
      form: {
        ownerName: form.ownerName,
        email: form.email,
        phone: form.phone,
        businessName: form.businessName,
        businessType: form.businessType,
        gstin: form.gstin,
        pan: form.pan,
        address: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        categories: form.categories,
        monthlyCapacity: form.monthlyCapacity,
        bankIfsc: form.bankIfsc,
        bankAccountName: form.bankAccountName,
        bankName: form.bankName,
      },
      gstStatus,
      gstMessage,
      gstNames,
    }),
    [form, gstMessage, gstNames, gstStatus]
  );

  const { savedAt, clearDraft, saveNow } = useOnboardingDraft<SellerDraft>({
    flow: 'seller',
    userId: user?.id,
    step,
    payload: draftPayload,
    onRestore: (draft) => {
      if (draft.payload.form) {
        setForm((current) => ({
          ...current,
          ...draft.payload.form,
          password: '',
          confirmPassword: '',
          bankAccountNumber: '',
        }));
      }
      if (validGstStatus(draft.payload.gstStatus)) setGstStatus(draft.payload.gstStatus);
      if (typeof draft.payload.gstMessage === 'string') setGstMessage(draft.payload.gstMessage);
      if (draft.payload.gstNames) setGstNames(draft.payload.gstNames);
      if (validStep(draft.step) && draft.step !== 'done' && (user || draft.step === 'account')) {
        setStep(draft.step);
      }
      setProgressMessage('Your saved seller application was restored.');
    },
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const restoreServerProgress = async () => {
      try {
        const response = await fetch('/api/seller/verification-status', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const status = (await response.json().catch(() => ({}))) as SellerStatus & { error?: string };
        if (!response.ok || cancelled) return;

        const application = status.application || {};
        setForm((current) => ({
          ...current,
          ownerName: current.ownerName || application.ownerName || profile?.full_name || '',
          email: current.email || user.email || '',
          phone: current.phone || profile?.phone || '',
          businessName: current.businessName || application.businessName || profile?.business_name || '',
          businessType: current.businessType || application.businessType || '',
          gstin: current.gstin || application.gstin || profile?.gstin || '',
          pan:
            current.pan ||
            application.pan ||
            (application.gstin?.length === 15 ? panFromGstin(application.gstin) : ''),
          address: current.address || application.address || profile?.address_line1 || '',
          city: current.city || application.city || profile?.city || '',
          state: current.state || application.state || profile?.state || '',
          pincode: current.pincode || application.pincode || profile?.pincode || '',
          categories: current.categories.length ? current.categories : application.categories || [],
          monthlyCapacity: current.monthlyCapacity || application.monthlyCapacity || '',
          bankIfsc: current.bankIfsc || application.bankIfsc || '',
          bankAccountName: current.bankAccountName || application.bankAccountName || '',
          bankName: current.bankName || application.bankName || '',
        }));

        if (validGstStatus(status.gstinStatus) && status.gstinStatus !== 'idle') {
          setGstStatus(status.gstinStatus);
        } else if (application.gstin) {
          setGstStatus((current) => (current === 'idle' ? 'manual_review' : current));
        }

        const restoredDocuments: Partial<Record<DocumentKey, SavedDocument>> = {};
        for (const document of status.documents || []) {
          if (
            Object.prototype.hasOwnProperty.call(documentLabels, document.document_type) &&
            ['uploaded', 'under_review', 'approved'].includes(document.upload_status)
          ) {
            restoredDocuments[document.document_type as DocumentKey] = {
              fileName: document.file_name || documentLabels[document.document_type as DocumentKey],
              status: document.upload_status,
            };
          }
        }
        setSavedDocuments(restoredDocuments);

        if (!status.applicationSubmitted) {
          setStep((current) => {
            if (current !== 'business') return current;
            if (status.bankDetailsPresent || Object.keys(restoredDocuments).length > 0) return 'documents';
            if (status.profileComplete) return 'bank';
            return current;
          });
        }
      } catch {
        // The local/server onboarding draft remains the fallback.
      }
    };

    void restoreServerProgress();
    return () => {
      cancelled = true;
    };
  }, [profile, user]);

  const goTo = (next: Step) => {
    setError('');
    saveNow(true);
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const buildApplication = (
    source: FormState,
    files: Partial<Record<DocumentKey, File>> = {},
    draftOnly = false
  ) => {
    const application = new FormData();
    if (draftOnly) application.set('draftOnly', '1');
    application.set(
      'payload',
      JSON.stringify({
        ownerName: source.ownerName,
        phone: normalizeIndianPhone(source.phone),
        businessName: source.businessName,
        businessType: source.businessType,
        city: source.city,
        state: source.state,
        pincode: source.pincode,
        address: source.address,
        categories: source.categories,
        monthlyCapacity: source.monthlyCapacity,
        gstin: normalizeGstin(source.gstin),
        pan: normalizePan(source.pan),
        bankAccountNumber: source.bankAccountNumber,
        bankIfsc: source.bankIfsc,
        bankAccountName: source.bankAccountName,
        bankName: source.bankName,
      })
    );
    Object.entries(files).forEach(([key, file]) => {
      if (file) application.set(`document_${key}`, file);
    });
    return application;
  };

  const persistApplication = async (
    source: FormState,
    files: Partial<Record<DocumentKey, File>> = {},
    draftOnly = false
  ) => {
    const response = await fetch('/api/account/enable-selling', {
      method: 'POST',
      credentials: 'same-origin',
      body: buildApplication(source, files, draftOnly),
    });
    const payload = (await response.json().catch(() => ({}))) as SaveResponse;
    if (response.status === 207) {
      throw new Error(payload.warning || payload.error || 'Your progress was only partially saved. Please retry.');
    }
    if (!response.ok) throw new Error(payload.error || 'Seller onboarding progress could not be saved.');
    return payload;
  };

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
    setError('');
    if (!validateGstinFormat(gstin) || !validateGstinChecksum(gstin)) {
      setGstStatus('invalid');
      setGstMessage('The GSTIN format or check digit is invalid. Recheck the GST certificate.');
      return;
    }
    update('pan', panFromGstin(gstin));
    setGstStatus('checking');
    setGstMessage('Checking the configured authorised GST verification service…');
    try {
      const response = await fetch('/api/gstin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
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
      setGstMessage(payload.message || 'Open the free official GST Portal to confirm the registration status.');
      setGstNames({ legalName: payload.legalName || '', tradeName: payload.tradeName || '' });
      if (nextStatus === 'active' && payload.legalName && !form.businessName.trim()) {
        update('businessName', payload.legalName);
      }
    } catch (caught) {
      setGstStatus('manual_review');
      setGstMessage(`${caught instanceof Error ? caught.message : 'The authorised provider is unavailable.'} Use the free official GST Portal reference below. The application can be saved, but live publishing stays locked until Active status is confirmed.`);
    }
  };

  const continueBusiness = () => {
    setError('');
    const gstin = normalizeGstin(form.gstin);
    const pan = normalizePan(form.pan);
    if (!form.businessName.trim()) return setError('Enter the legal business name exactly as shown on the GST certificate.');
    if (!form.businessType) return setError('Select the business type before continuing.');
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

  const continueBank = async () => {
    setError('');
    setProgressMessage('');
    const accountNumber = form.bankAccountNumber.replace(/\D/g, '');
    const ifsc = form.bankIfsc.toUpperCase().trim();
    if (!/^\d{9,18}$/.test(accountNumber)) return setError('Enter a valid bank account number.');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return setError('Enter a valid IFSC code.');
    if (!form.bankAccountName.trim() || !form.bankName.trim()) return setError('Enter the account-holder and bank names.');

    const nextForm = { ...form, bankAccountNumber: accountNumber, bankIfsc: ifsc };
    setForm(nextForm);
    setSubmitting(true);
    try {
      if (user) {
        await persistApplication(nextForm, {}, true);
        setProgressMessage('Business and settlement details saved. You can safely leave and return to this application.');
      }
      goTo('documents');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Settlement details could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectDocument = async (key: DocumentKey, file: File | undefined) => {
    if (!file) return;
    if (!fileAllowed(file)) {
      setError('Documents must be PDF or image files up to 10 MB.');
      return;
    }
    setError('');
    setProgressMessage('');
    setDocuments((current) => ({ ...current, [key]: file }));

    if (!user) return;
    setUploadingDocuments((current) => ({ ...current, [key]: true }));
    try {
      await persistApplication(form, { [key]: file }, true);
      setSavedDocuments((current) => ({
        ...current,
        [key]: { fileName: file.name, status: 'uploaded' },
      }));
      setDocuments((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setProgressMessage(`${documentLabels[key]} saved securely. It will still be here when you return.`);
      saveNow(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `${documentLabels[key]} could not be saved.`);
    } finally {
      setUploadingDocuments((current) => ({ ...current, [key]: false }));
    }
  };

  const submit = async () => {
    setError('');
    setProgressMessage('');
    const missing = requiredDocuments.find((key) => !documents[key] && !savedDocuments[key]);
    if (missing) return setError(`Upload the ${documentLabels[missing]}.`);

    setSubmitting(true);
    try {
      let source = form;
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
        source = form;
      }

      const payload = user
        ? await persistApplication(source, documents, false)
        : await (async () => {
            const application = buildApplication(source, documents, false);
            const response = await fetch('/api/registration/seller/finalize', {
              method: 'POST',
              credentials: 'same-origin',
              body: application,
            });
            const result = (await response.json().catch(() => ({}))) as SaveResponse;
            if (!response.ok && response.status !== 207) {
              throw new Error(result.error || 'Seller onboarding could not be submitted.');
            }
            return result;
          })();

      if (user) {
        await fetch('/api/gstin/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
          body: JSON.stringify({ gstin: normalizeGstin(form.gstin), subjectType: 'seller', persist: true }),
        }).catch(() => undefined);
        await refreshProfile().catch(() => undefined);
      }

      await clearDraft();
      setDocuments({});
      setResultMessage(
        payload.message ||
          (gstStatus === 'active'
            ? 'GSTIN and seller application submitted. Document and bank review will determine settlement eligibility.'
            : 'Seller application submitted for official GST, document and bank review.')
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
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">A live seller needs an active GSTIN, matching PAN, settlement details and private supporting documents. Your progress is saved as you move through the process.</p>
          {savedAt && step !== 'done' && (
            <p className="mt-2 text-xs font-700 text-success">Progress saved automatically</p>
          )}
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
          {error && <div role="alert" className="mb-5 flex gap-2 rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error"><Icon name="ExclamationTriangleIcon" size={17} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
          {progressMessage && <div aria-live="polite" className="mb-5 flex gap-2 rounded-xl border border-success/20 bg-success/10 p-3 text-sm text-success"><Icon name="CheckCircleIcon" size={17} className="mt-0.5 shrink-0" /><span>{progressMessage}</span></div>}

          {step === 'account' && !user && (
            <form onSubmit={continueAccount} className="space-y-4">
              <div><h2 className="text-xl font-800 text-foreground">Account details</h2><p className="mt-1 text-sm text-muted-foreground">Already buying on FabricTrad? Sign in instead and activate selling on the same account.</p></div>
              <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-700 text-foreground">Owner / contact name *<input value={form.ownerName} onChange={(event) => update('ownerName', event.target.value)} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label><label className="text-sm font-700 text-foreground">Mobile number *<input value={form.phone} onChange={(event) => update('phone', normalizeIndianPhone(event.target.value))} className="input-base mt-1.5 w-full px-4 py-3 font-400" inputMode="numeric" maxLength={10} /></label></div>
              <label className="block text-sm font-700 text-foreground">Email address *<input type="email" value={form.email} onChange={(event) => update('email', normalizeEmail(event.target.value))} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label>
              <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-700 text-foreground">Password *<span className="relative mt-1.5 block"><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => update('password', event.target.value)} className="input-base w-full px-4 py-3 pr-11 font-400" /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPassword ? 'Hide password' : 'Show password'}><Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={17} /></button></span></label><label className="text-sm font-700 text-foreground">Confirm password *<input type="password" value={form.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label></div>
              <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-sm disabled:opacity-50">{submitting ? 'Checking…' : 'Continue'}</button>
              <p className="text-center text-xs text-muted-foreground">Existing account? <Link href="/login?next=/seller-registration" className="font-800 text-primary">Sign in and activate selling</Link></p>
            </form>
          )}

          {step === 'business' && (
            <div className="space-y-5">
              <div><h2 className="text-xl font-800 text-foreground">GST business identity</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">FabricTrad checks an authorised GST API when configured. Otherwise, use the free official GST Portal search below.</p></div>
              <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-700 text-foreground">Legal business name *<input value={form.businessName} onChange={(event) => update('businessName', event.target.value)} className="input-base mt-1.5 w-full px-4 py-3 font-400" required /></label><label className="text-sm font-700 text-foreground">Business type *<select value={form.businessType} onChange={(event) => update('businessType', event.target.value)} className="input-base mt-1.5 w-full px-3 py-3 font-400" required><option value="">Select business type</option>{businessTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>
              <label className="block text-sm font-700 text-foreground">GSTIN *<div className="mt-1.5 flex flex-col gap-2 sm:flex-row"><input value={form.gstin} onChange={(event) => { update('gstin', normalizeGstin(event.target.value)); setGstStatus('idle'); setGstMessage(''); setGstNames({ legalName: '', tradeName: '' }); }} className="input-base min-w-0 flex-1 px-4 py-3 font-mono uppercase" maxLength={15} placeholder="27AAPFU0939F1ZV" autoComplete="off" /><button type="button" onClick={checkGstin} disabled={gstStatus === 'checking'} className="btn-secondary px-5 py-3 text-sm disabled:opacity-50">{gstStatus === 'checking' ? 'Checking…' : 'Check GSTIN'}</button></div></label>
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span><strong className="text-foreground">Free official reference:</strong> paste the GSTIN into GST Portal Search Taxpayer and complete its captcha.</span><a href={OFFICIAL_GST_PORTAL_REFERENCE.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-card px-3 py-2 font-800 text-primary hover:bg-primary/5"><Icon name="ArrowTopRightOnSquareIcon" size={15} />Open official GST Portal</a></div>
              {gstMessage && <div aria-live="polite" className={`rounded-xl border p-3 text-xs leading-5 ${gstStatus === 'active' ? 'border-success/30 bg-success/10 text-success' : gstStatus === 'invalid' || gstStatus === 'inactive' || gstStatus === 'cancelled' ? 'border-error/30 bg-error/10 text-error' : 'border-amber-300 bg-amber-50 text-amber-900'}`}><p className="font-800">{gstMessage}</p>{(gstNames.legalName || gstNames.tradeName) && <p className="mt-1">{gstNames.legalName}{gstNames.tradeName ? ` · ${gstNames.tradeName}` : ''}</p>}</div>}
              <label className="block text-sm font-700 text-foreground">PAN embedded in GSTIN *<input value={form.pan} onChange={(event) => update('pan', normalizePan(event.target.value))} className="input-base mt-1.5 w-full px-4 py-3 font-mono uppercase" maxLength={10} readOnly /></label>
              <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-700 text-foreground">Registered / pickup address *<textarea value={form.address} onChange={(event) => update('address', event.target.value)} rows={3} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label><div className="space-y-4"><label className="block text-sm font-700 text-foreground">City *<input value={form.city} onChange={(event) => update('city', event.target.value)} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-700 text-foreground">State *<select value={form.state} onChange={(event) => update('state', event.target.value)} className="input-base mt-1.5 w-full px-2 py-3 font-400"><option value="">Select</option>{INDIAN_STATES_AND_UTS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="text-sm font-700 text-foreground">PIN *<input value={form.pincode} onChange={(event) => update('pincode', event.target.value.replace(/\D/g, '').slice(0, 6))} className="input-base mt-1.5 w-full px-3 py-3 font-mono font-400" inputMode="numeric" /></label></div></div></div>
              <div><p className="text-sm font-700 text-foreground">Product categories *</p><div className="mt-2 flex flex-wrap gap-2">{categories.map((category) => { const selected = form.categories.includes(category); return <button key={category} type="button" onClick={() => update('categories', selected ? form.categories.filter((item) => item !== category) : [...form.categories, category])} className={`rounded-full border px-3 py-2 text-xs font-700 ${selected ? 'border-primary bg-primary text-white' : 'border-border text-muted-foreground'}`}>{category}</button>; })}</div></div>
              <label className="block text-sm font-700 text-foreground">Approximate monthly capacity<input value={form.monthlyCapacity} onChange={(event) => update('monthlyCapacity', event.target.value)} className="input-base mt-1.5 w-full px-4 py-3 font-400" placeholder="e.g. 2,000 metres" /></label>
              <div className="flex gap-3">{!user && <button type="button" onClick={() => goTo('account')} className="btn-secondary flex-1 py-3 text-sm">Back</button>}<button type="button" onClick={continueBusiness} className="btn-primary flex-1 py-3 text-sm">Continue</button></div>
            </div>
          )}

          {step === 'bank' && (
            <div className="space-y-4">
              <div><h2 className="text-xl font-800 text-foreground">Settlement account</h2><p className="mt-1 text-sm text-muted-foreground">Once you continue, the settlement details are saved securely so returning to the site does not reset this step.</p></div>
              <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-700 text-foreground">Account holder name *<input value={form.bankAccountName} onChange={(event) => update('bankAccountName', event.target.value)} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label><label className="text-sm font-700 text-foreground">Bank name *<input value={form.bankName} onChange={(event) => update('bankName', event.target.value)} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label></div>
              <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-700 text-foreground">Account number *<input value={form.bankAccountNumber} onChange={(event) => update('bankAccountNumber', event.target.value.replace(/\D/g, '').slice(0, 18))} className="input-base mt-1.5 w-full px-4 py-3 font-mono font-400" inputMode="numeric" /></label><label className="text-sm font-700 text-foreground">IFSC *<input value={form.bankIfsc} onChange={(event) => update('bankIfsc', event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))} className="input-base mt-1.5 w-full px-4 py-3 font-mono uppercase font-400" /></label></div>
              <div className="flex gap-3"><button type="button" onClick={() => goTo('business')} className="btn-secondary flex-1 py-3 text-sm">Back</button><button type="button" onClick={() => void continueBank()} disabled={submitting} className="btn-primary flex-1 py-3 text-sm disabled:opacity-50">{submitting ? 'Saving…' : 'Save & continue'}</button></div>
            </div>
          )}

          {step === 'documents' && (
            <div className="space-y-4">
              <div><h2 className="text-xl font-800 text-foreground">Private verification documents</h2><p className="mt-1 text-sm text-muted-foreground">Each file is uploaded securely as soon as you select it. Leaving, refreshing or returning later will not remove a successfully saved document.</p></div>
              {(Object.keys(documentLabels) as DocumentKey[]).map((key) => {
                const selectedFile = documents[key];
                const savedFile = savedDocuments[key];
                const uploading = uploadingDocuments[key];
                const displayName = savedFile?.fileName || selectedFile?.name;
                const complete = Boolean(savedFile || selectedFile);
                return (
                  <label key={key} className="block rounded-2xl border border-dashed border-border p-4 hover:border-primary/50">
                    <span className="flex items-start justify-between gap-3"><span><span className="block text-sm font-800 text-foreground">{documentLabels[key]}</span><span className="mt-1 block text-xs text-muted-foreground">{requiredDocuments.includes(key) ? 'Required' : 'Optional'} · PDF/image · 10 MB maximum</span></span><Icon name={complete ? 'CheckCircleIcon' : 'ArrowUpTrayIcon'} size={20} className={complete ? 'text-success' : 'text-primary'} /></span>
                    <input type="file" accept="application/pdf,image/*" className="sr-only" disabled={Boolean(uploading)} onChange={(event) => void selectDocument(key, event.target.files?.[0])} />
                    {uploading && <span className="mt-2 block text-xs font-700 text-primary">Saving securely…</span>}
                    {!uploading && displayName && <span className="mt-2 block truncate text-xs font-700 text-success">{displayName}{savedFile ? ' · saved' : ''}</span>}
                  </label>
                );
              })}
              <div className="flex gap-3"><button type="button" onClick={() => goTo('bank')} className="btn-secondary flex-1 py-3 text-sm">Back</button><button type="button" onClick={() => void submit()} disabled={submitting || Object.values(uploadingDocuments).some(Boolean)} className="btn-primary flex-1 py-3 text-sm disabled:opacity-50">{submitting ? 'Submitting securely…' : 'Submit seller application'}</button></div>
            </div>
          )}

          {step === 'done' && (
            <div className="py-4 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success"><Icon name="CheckCircleIcon" size={34} /></div><h2 className="mt-5 text-2xl font-800 text-foreground">Application submitted</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{resultMessage}</p><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/seller-dashboard" className="btn-primary px-6 py-3 text-sm">Open seller workspace</Link><Link href="/marketplace" className="btn-secondary px-6 py-3 text-sm">View marketplace</Link></div></div>
          )}
        </div>
      </div>
    </section>
  );
}
