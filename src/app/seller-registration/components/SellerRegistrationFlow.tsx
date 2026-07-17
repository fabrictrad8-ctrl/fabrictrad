'use client';
import React, { useState, useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 'phone' | 'otp' | 'business' | 'gstin' | 'bank' | 'documents' | 'done';

interface SellerForm {
  phone: string;
  otp: string[];
  businessName: string;
  businessType: string;
  ownerName: string;
  email: string;
  city: string;
  state: string;
  pincode: string;
  address: string;
  categories: string[];
  monthlyCapacity: string;
  gstin: string;
  pan: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankAccountName: string;
  bankName: string;
}

interface GstinValidation {
  status: 'idle' | 'validating' | 'valid' | 'invalid';
  message: string;
  details?: { legalName: string; state: string; status: string };
}

interface BankVerification {
  status: 'idle' | 'verifying' | 'verified' | 'failed';
  message: string;
  linkedAccountId?: string;
}

interface DocumentUpload {
  file: File | null;
  status: 'idle' | 'uploading' | 'uploaded' | 'approved' | 'rejected';
  url?: string;
  name: string;
  required: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: 'phone', label: 'Phone', icon: 'DevicePhoneMobileIcon' },
  { key: 'otp', label: 'Verify', icon: 'KeyIcon' },
  { key: 'business', label: 'Business', icon: 'BuildingOfficeIcon' },
  { key: 'gstin', label: 'GSTIN', icon: 'IdentificationIcon' },
  { key: 'bank', label: 'Bank', icon: 'BanknotesIcon' },
  { key: 'documents', label: 'Documents', icon: 'DocumentCheckIcon' },
  { key: 'done', label: 'Done', icon: 'CheckCircleIcon' },
];

const STEP_ORDER: Step[] = ['phone', 'otp', 'business', 'gstin', 'bank', 'documents', 'done'];

const BUSINESS_TYPES = ['Manufacturer', 'Wholesaler', 'Trader', 'Exporter', 'Weaver', 'Processor'];
const CATEGORIES = ['Silk Fabrics', 'Cotton & Linen', 'Net & Embroidered', 'Georgette', 'Polyester', 'Handloom', 'Synthetic Blends', 'Woollen'];
const INDIAN_STATES = ['Gujarat', 'Maharashtra', 'Rajasthan', 'Tamil Nadu', 'Karnataka', 'Uttar Pradesh', 'West Bengal', 'Punjab', 'Haryana', 'Madhya Pradesh', 'Telangana', 'Andhra Pradesh', 'Delhi', 'Kerala', 'Bihar'];

const REQUIRED_DOCS: { key: string; label: string; hint: string; required: boolean }[] = [
  { key: 'gst_certificate', label: 'GST Registration Certificate', hint: 'PDF or image of your GST certificate', required: true },
  { key: 'pan_card', label: 'PAN Card', hint: 'Clear scan of business/personal PAN', required: true },
  { key: 'cancelled_cheque', label: 'Cancelled Cheque / Bank Statement', hint: 'For bank account verification', required: true },
  { key: 'business_proof', label: 'Business Registration Proof', hint: 'Udyam / MSME / Incorporation certificate', required: false },
  { key: 'address_proof', label: 'Address Proof', hint: 'Utility bill or rent agreement', required: false },
];

// ─── GSTIN Validator ──────────────────────────────────────────────────────────
function validateGstinFormat(gstin: string): boolean {
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return regex.test(gstin.toUpperCase());
}

function extractStateFromGstin(gstin: string): string {
  const stateCode: Record<string, string> = {
    '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
    '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
    '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
    '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
    '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
    '24': 'Gujarat', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '32': 'Kerala',
    '33': 'Tamil Nadu', '36': 'Telangana', '37': 'Andhra Pradesh',
  };
  return stateCode[gstin.slice(0, 2)] || 'Unknown State';
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SellerRegistrationFlow() {
  const [currentStep, setCurrentStep] = useState<Step>('phone');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sellerId] = useState(`FT-SLR-${Math.floor(100000 + Math.random() * 900000)}`);

  const [form, setForm] = useState<SellerForm>({
    phone: '', otp: ['', '', '', '', '', ''],
    businessName: '', businessType: '', ownerName: '', email: '',
    city: '', state: '', pincode: '', address: '', categories: [],
    monthlyCapacity: '', gstin: '', pan: '',
    bankAccountNumber: '', bankIfsc: '', bankAccountName: '', bankName: '',
  });

  const [gstinValidation, setGstinValidation] = useState<GstinValidation>({ status: 'idle', message: '' });
  const [bankVerification, setBankVerification] = useState<BankVerification>({ status: 'idle', message: '' });
  const [documents, setDocuments] = useState<Record<string, DocumentUpload>>(
    Object.fromEntries(REQUIRED_DOCS.map((d) => [d.key, { file: null, status: 'idle', name: d.label, required: d.required }]))
  );

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const currentIndex = STEP_ORDER.indexOf(currentStep);

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const setField = (key: keyof SellerForm, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSendOtp = () => {
    if (form.phone.length === 10) {
      setResendCooldown(30);
      const interval = setInterval(() => {
        setResendCooldown((prev) => { if (prev <= 1) { clearInterval(interval); return 0; } return prev - 1; });
      }, 1000);
      setCurrentStep('otp');
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) return;
    const newOtp = [...form.otp];
    newOtp[index] = val;
    setField('otp', newOtp);
    if (val && index < 5) document.getElementById(`sotp-${index + 1}`)?.focus();
  };

  const handleGstinValidate = async () => {
    const gstin = form.gstin.toUpperCase().trim();
    if (!validateGstinFormat(gstin)) {
      setGstinValidation({ status: 'invalid', message: 'Invalid GSTIN format. Expected: 22AAAAA0000A1Z5' });
      return;
    }
    setGstinValidation({ status: 'validating', message: 'Verifying with GST portal…' });
    // Simulate API call (real integration: GST Suvidha Provider API)
    await new Promise((r) => setTimeout(r, 1500));
    const state = extractStateFromGstin(gstin);
    const pan = gstin.slice(2, 12);
    setField('pan', pan);
    setGstinValidation({
      status: 'valid',
      message: 'GSTIN verified successfully',
      details: { legalName: form.businessName || 'Business Entity', state, status: 'Active' },
    });
  };

  const handleBankVerify = async () => {
    if (!form.bankAccountNumber || !form.bankIfsc || !form.bankAccountName) {
      setBankVerification({ status: 'failed', message: 'Please fill all bank details before verifying.' });
      return;
    }
    setBankVerification({ status: 'verifying', message: 'Creating Razorpay Route linked account…' });
    // Simulate Razorpay Route linked account creation
    await new Promise((r) => setTimeout(r, 2000));
    const mockLinkedAccountId = `acc_${Math.random().toString(36).slice(2, 14)}`;
    setBankVerification({
      status: 'verified',
      message: 'Bank account verified & linked to Razorpay Route',
      linkedAccountId: mockLinkedAccountId,
    });
  };

  const handleFileSelect = async (docKey: string, file: File) => {
    setDocuments((prev) => ({ ...prev, [docKey]: { ...prev[docKey], file, status: 'uploading' } }));
    // Simulate upload
    await new Promise((r) => setTimeout(r, 1200));
    const mockUrl = `https://storage.fabrictrad.com/docs/${docKey}_${Date.now()}.${file.name.split('.').pop()}`;
    setDocuments((prev) => ({ ...prev, [docKey]: { ...prev[docKey], status: 'uploaded', url: mockUrl } }));
    // Simulate real-time approval (admin review)
    setTimeout(() => {
      setDocuments((prev) => ({ ...prev, [docKey]: { ...prev[docKey], status: 'approved' } }));
    }, 3000);
  };

  const canProceedToNext = (): boolean => {
    switch (currentStep) {
      case 'phone': return form.phone.length === 10;
      case 'otp': return form.otp.every((d) => d !== '');
      case 'business': return !!(form.businessName && form.businessType && form.ownerName && form.email && form.state && form.city);
      case 'gstin': return gstinValidation.status === 'valid';
      case 'bank': return bankVerification.status === 'verified';
      case 'documents': return REQUIRED_DOCS.filter((d) => d.required).every((d) => ['uploaded', 'approved'].includes(documents[d.key]?.status));
      default: return true;
    }
  };

  const goNext = () => {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx < STEP_ORDER.length - 1) setCurrentStep(STEP_ORDER[idx + 1]);
  };

  const goBack = () => {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx > 0) setCurrentStep(STEP_ORDER[idx - 1]);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen gradient-hero py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-800 text-foreground mb-1">Become a FabricTrad Seller</h1>
          <p className="text-sm text-muted-foreground">Reach 45,000+ verified B2B buyers across India</p>
        </div>

        {/* Step Progress */}
        <div className="flex items-center justify-between mb-8 relative px-2">
          <div className="absolute top-5 left-2 right-2 h-0.5 bg-border z-0" />
          <div
            className="absolute top-5 left-2 h-0.5 bg-secondary z-0 transition-all duration-500"
            style={{ width: `${(currentIndex / (STEP_ORDER.length - 1)) * 100}%` }}
          />
          {STEPS.map((step, i) => {
            const isCompleted = i < currentIndex;
            const isActive = step.key === currentStep;
            return (
              <div key={step.key} className="flex flex-col items-center gap-1.5 relative z-10">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  isCompleted ? 'bg-success border-success' : isActive ? 'bg-secondary border-secondary' : 'bg-background border-border'
                }`}>
                  {isCompleted
                    ? <Icon name="CheckIcon" size={16} className="text-white" />
                    : <Icon name={step.icon as 'KeyIcon'} size={16} className={isActive ? 'text-white' : 'text-muted-foreground'} />
                  }
                </div>
                <span className={`text-xs font-600 hidden sm:block ${isActive ? 'text-secondary' : isCompleted ? 'text-success' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step Card */}
        <div className="bg-card rounded-2xl border border-border p-6 md:p-8 shadow-sm">

          {/* ── Step 1: Phone ── */}
          {currentStep === 'phone' && (
            <div>
              <h2 className="text-xl font-800 text-foreground mb-1">Enter your mobile number</h2>
              <p className="text-sm text-muted-foreground mb-6">We'll send a 6-digit OTP to verify</p>
              <label className="block text-sm font-700 text-foreground mb-2">Mobile Number</label>
              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-3 py-3 shrink-0">
                  <span className="text-lg">🇮🇳</span>
                  <span className="text-sm font-600 text-foreground">+91</span>
                </div>
                <input
                  type="tel" maxLength={10} value={form.phone}
                  onChange={(e) => setField('phone', e.target.value.replace(/\D/g, ''))}
                  placeholder="98765 43210"
                  className="input-base flex-1 px-4 py-3 text-lg font-600 rounded-xl tracking-widest"
                />
              </div>
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-5">
                <Icon name="BeakerIcon" size={14} className="text-warning shrink-0" />
                <p className="text-xs text-warning"><span className="font-700">DEV MODE:</span> OTP shown in console. Real SMS disabled.</p>
              </div>
              <button onClick={handleSendOtp} disabled={form.phone.length !== 10}
                className="btn-primary w-full py-3 text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed">
                Send OTP
              </button>
              <p className="text-xs text-muted-foreground text-center mt-4">
                Already a seller?{' '}
                <Link href="/seller-dashboard" className="text-secondary font-600 hover:underline">Login here</Link>
              </p>
            </div>
          )}

          {/* ── Step 2: OTP ── */}
          {currentStep === 'otp' && (
            <div>
              <h2 className="text-xl font-800 text-foreground mb-1">Verify your number</h2>
              <p className="text-sm text-muted-foreground mb-6">OTP sent to +91 {form.phone.slice(0, 5)}*****</p>
              <div className="flex justify-center gap-2 sm:gap-3 mb-6">
                {form.otp.map((digit, i) => (
                  <input key={i} id={`sotp-${i}`} type="text" inputMode="numeric" maxLength={1} value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    className="w-11 h-14 text-center text-xl font-800 input-base rounded-xl" />
                ))}
              </div>
              <button onClick={goNext} disabled={!canProceedToNext()}
                className="btn-primary w-full py-3 text-sm rounded-xl mb-3 disabled:opacity-50">
                Verify OTP
              </button>
              <div className="text-center">
                {resendCooldown > 0
                  ? <p className="text-xs text-muted-foreground">Resend in {resendCooldown}s</p>
                  : <button onClick={handleSendOtp} className="text-xs text-secondary font-600 hover:underline">Resend OTP</button>
                }
              </div>
              <button onClick={goBack} className="mt-4 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto">
                <Icon name="ArrowLeftIcon" size={12} /> Change number
              </button>
            </div>
          )}

          {/* ── Step 3: Business Details ── */}
          {currentStep === 'business' && (
            <div>
              <h2 className="text-xl font-800 text-foreground mb-1">Business Details</h2>
              <p className="text-sm text-muted-foreground mb-6">Tell us about your textile business</p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">Owner / Contact Name *</label>
                    <input type="text" value={form.ownerName} onChange={(e) => setField('ownerName', e.target.value)}
                      placeholder="Arjun Mehta" className="input-base w-full px-4 py-3 text-sm rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">Email Address *</label>
                    <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)}
                      placeholder="arjun@textiles.com" className="input-base w-full px-4 py-3 text-sm rounded-xl" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-700 text-foreground mb-1.5">Business / Company Name *</label>
                  <input type="text" value={form.businessName} onChange={(e) => setField('businessName', e.target.value)}
                    placeholder="Mehta Textiles Pvt Ltd" className="input-base w-full px-4 py-3 text-sm rounded-xl" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">Business Type *</label>
                    <select value={form.businessType} onChange={(e) => setField('businessType', e.target.value)}
                      className="input-base w-full px-4 py-3 text-sm rounded-xl">
                      <option value="">Select type</option>
                      {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">State *</label>
                    <select value={form.state} onChange={(e) => setField('state', e.target.value)}
                      className="input-base w-full px-4 py-3 text-sm rounded-xl">
                      <option value="">Select state</option>
                      {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">City *</label>
                    <input type="text" value={form.city} onChange={(e) => setField('city', e.target.value)}
                      placeholder="Surat" className="input-base w-full px-4 py-3 text-sm rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">Monthly Capacity (metres)</label>
                    <input type="text" value={form.monthlyCapacity} onChange={(e) => setField('monthlyCapacity', e.target.value)}
                      placeholder="50,000" className="input-base w-full px-4 py-3 text-sm rounded-xl" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-700 text-foreground mb-2">Product Categories</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => {
                      const selected = form.categories.includes(cat);
                      return (
                        <button key={cat} type="button"
                          onClick={() => setField('categories', selected ? form.categories.filter((c) => c !== cat) : [...form.categories, cat])}
                          className={`px-3 py-1.5 rounded-xl text-xs font-600 border transition-all ${selected ? 'bg-secondary text-white border-secondary' : 'bg-card border-border text-muted-foreground hover:border-secondary'}`}>
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: GSTIN Validation ── */}
          {currentStep === 'gstin' && (
            <div>
              <h2 className="text-xl font-800 text-foreground mb-1">GSTIN Verification</h2>
              <p className="text-sm text-muted-foreground mb-6">Your GST number is required for B2B invoicing</p>
              <div className="mb-4">
                <label className="block text-sm font-700 text-foreground mb-1.5">GSTIN *</label>
                <div className="flex gap-2">
                  <input
                    type="text" maxLength={15} value={form.gstin}
                    onChange={(e) => {
                      setField('gstin', e.target.value.toUpperCase());
                      setGstinValidation({ status: 'idle', message: '' });
                    }}
                    placeholder="24AAAPL1234Z1Z5"
                    className={`input-base flex-1 px-4 py-3 text-sm rounded-xl font-mono tracking-wider uppercase ${
                      gstinValidation.status === 'valid' ? 'border-success' : gstinValidation.status === 'invalid' ? 'border-error' : ''
                    }`}
                  />
                  <button onClick={handleGstinValidate}
                    disabled={form.gstin.length < 15 || gstinValidation.status === 'validating'}
                    className="btn-secondary px-4 py-3 text-sm rounded-xl disabled:opacity-50 shrink-0">
                    {gstinValidation.status === 'validating' ? 'Checking…' : 'Verify'}
                  </button>
                </div>
                {/* Inline validation feedback */}
                {gstinValidation.status !== 'idle' && (
                  <div className={`mt-2 flex items-start gap-2 p-3 rounded-xl text-xs ${
                    gstinValidation.status === 'valid' ? 'bg-success/10 border border-success/20 text-success'
                    : gstinValidation.status === 'invalid'? 'bg-error/10 border border-error/20 text-error' :'bg-muted border border-border text-muted-foreground'
                  }`}>
                    <Icon name={gstinValidation.status === 'valid' ? 'CheckCircleIcon' : gstinValidation.status === 'invalid' ? 'XCircleIcon' : 'ArrowPathIcon'} size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-600">{gstinValidation.message}</p>
                      {gstinValidation.details && (
                        <div className="mt-1.5 space-y-0.5 text-foreground/70">
                          <p>Legal Name: <span className="font-600">{gstinValidation.details.legalName}</span></p>
                          <p>State: <span className="font-600">{gstinValidation.details.state}</span></p>
                          <p>Status: <span className="font-600 text-success">{gstinValidation.details.status}</span></p>
                          <p>PAN auto-filled: <span className="font-600 font-mono">{form.pan}</span></p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* GSTIN format guide */}
              <div className="p-4 bg-muted/50 rounded-xl border border-border">
                <p className="text-xs font-700 text-foreground mb-2">GSTIN Format Guide</p>
                <div className="font-mono text-xs text-muted-foreground space-y-1">
                  <p><span className="text-secondary font-700">24</span> — State code (Gujarat)</p>
                  <p><span className="text-secondary font-700">AAAPL</span> — PAN first 5 chars</p>
                  <p><span className="text-secondary font-700">1234</span> — PAN digits</p>
                  <p><span className="text-secondary font-700">Z</span> — PAN last char</p>
                  <p><span className="text-secondary font-700">1Z5</span> — Entity/check digits</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 5: Bank Account Verification ── */}
          {currentStep === 'bank' && (
            <div>
              <h2 className="text-xl font-800 text-foreground mb-1">Bank Account Verification</h2>
              <p className="text-sm text-muted-foreground mb-2">Your account will be linked to Razorpay Route for automatic payouts</p>
              <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl mb-5">
                <Icon name="ShieldCheckIcon" size={14} className="text-primary shrink-0" />
                <p className="text-xs text-primary font-500">Payouts are processed via Razorpay Route — secure, instant, and traceable</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-700 text-foreground mb-1.5">Account Holder Name *</label>
                  <input type="text" value={form.bankAccountName} onChange={(e) => setField('bankAccountName', e.target.value)}
                    placeholder="Mehta Textiles Pvt Ltd" className="input-base w-full px-4 py-3 text-sm rounded-xl" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">Account Number *</label>
                    <input type="text" value={form.bankAccountNumber} onChange={(e) => setField('bankAccountNumber', e.target.value.replace(/\D/g, ''))}
                      placeholder="1234567890123456" className="input-base w-full px-4 py-3 text-sm rounded-xl font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">IFSC Code *</label>
                    <input type="text" value={form.bankIfsc} onChange={(e) => setField('bankIfsc', e.target.value.toUpperCase())}
                      placeholder="HDFC0001234" className="input-base w-full px-4 py-3 text-sm rounded-xl font-mono uppercase" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-700 text-foreground mb-1.5">Bank Name</label>
                  <input type="text" value={form.bankName} onChange={(e) => setField('bankName', e.target.value)}
                    placeholder="HDFC Bank" className="input-base w-full px-4 py-3 text-sm rounded-xl" />
                </div>
                <button onClick={handleBankVerify}
                  disabled={bankVerification.status === 'verifying' || bankVerification.status === 'verified'}
                  className={`w-full py-3 text-sm rounded-xl font-700 transition-all ${
                    bankVerification.status === 'verified' ? 'bg-success/10 text-success border border-success/30 cursor-default'
                    : 'btn-secondary disabled:opacity-50'
                  }`}>
                  {bankVerification.status === 'verifying' ? (
                    <span className="flex items-center justify-center gap-2">
                      <Icon name="ArrowPathIcon" size={14} className="animate-spin" /> Verifying via Razorpay Route…
                    </span>
                  ) : bankVerification.status === 'verified' ? (
                    <span className="flex items-center justify-center gap-2">
                      <Icon name="CheckCircleIcon" size={14} /> Account Verified & Linked
                    </span>
                  ) : 'Verify Bank Account'}
                </button>
                {bankVerification.message && (
                  <div className={`flex items-start gap-2 p-3 rounded-xl text-xs ${
                    bankVerification.status === 'verified' ? 'bg-success/10 border border-success/20 text-success'
                    : bankVerification.status === 'failed'? 'bg-error/10 border border-error/20 text-error' :'bg-muted border border-border text-muted-foreground'
                  }`}>
                    <Icon name={bankVerification.status === 'verified' ? 'CheckCircleIcon' : 'ExclamationCircleIcon'} size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-600">{bankVerification.message}</p>
                      {bankVerification.linkedAccountId && (
                        <p className="mt-1 font-mono text-foreground/60">Linked Account ID: {bankVerification.linkedAccountId}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 6: Document Upload ── */}
          {currentStep === 'documents' && (
            <div>
              <h2 className="text-xl font-800 text-foreground mb-1">Document Upload</h2>
              <p className="text-sm text-muted-foreground mb-5">Upload required documents for seller verification. Approval status updates in real-time.</p>
              <div className="space-y-3">
                {REQUIRED_DOCS.map((doc) => {
                  const docState = documents[doc.key];
                  const statusConfig = {
                    idle: { color: 'border-border', bg: 'bg-card', icon: 'ArrowUpTrayIcon', iconColor: 'text-muted-foreground', label: 'Upload' },
                    uploading: { color: 'border-secondary/40', bg: 'bg-secondary/5', icon: 'ArrowPathIcon', iconColor: 'text-secondary', label: 'Uploading…' },
                    uploaded: { color: 'border-warning/40', bg: 'bg-warning/5', icon: 'ClockIcon', iconColor: 'text-warning', label: 'Pending Review' },
                    approved: { color: 'border-success/40', bg: 'bg-success/5', icon: 'CheckCircleIcon', iconColor: 'text-success', label: 'Approved' },
                    rejected: { color: 'border-error/40', bg: 'bg-error/5', icon: 'XCircleIcon', iconColor: 'text-error', label: 'Rejected — Re-upload' },
                  }[docState.status];

                  return (
                    <div key={doc.key} className={`border rounded-xl p-4 transition-all ${statusConfig.color} ${statusConfig.bg}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-700 text-foreground">{doc.label}</p>
                            {doc.required && <span className="text-xs text-error font-600">Required</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">{doc.hint}</p>
                          {docState.file && (
                            <p className="text-xs font-mono text-muted-foreground mt-1 truncate">{docState.file.name}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`flex items-center gap-1 text-xs font-600 ${statusConfig.iconColor}`}>
                            <Icon name={statusConfig.icon as 'CheckCircleIcon'} size={14}
                              className={docState.status === 'uploading' ? 'animate-spin' : ''} />
                            {statusConfig.label}
                          </span>
                          {(docState.status === 'idle' || docState.status === 'rejected') && (
                            <button
                              onClick={() => fileInputRefs.current[doc.key]?.click()}
                              className="btn-secondary px-3 py-1.5 text-xs rounded-lg">
                              {docState.status === 'rejected' ? 'Re-upload' : 'Choose File'}
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        ref={(el) => { fileInputRefs.current[doc.key] = el; }}
                        type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(doc.key, f); }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 p-3 bg-muted/50 rounded-xl border border-border">
                <p className="text-xs text-muted-foreground">
                  <span className="font-700 text-foreground">Real-time approval:</span> Documents are reviewed by our team within 2–4 business hours. You'll receive an SMS/email notification when approved.
                </p>
              </div>
            </div>
          )}

          {/* ── Step 7: Done ── */}
          {currentStep === 'done' && (
            <div className="text-center py-4">
              <div className="w-20 h-20 rounded-full bg-success/10 border-2 border-success/30 flex items-center justify-center mx-auto mb-5">
                <Icon name="CheckCircleIcon" size={40} className="text-success" />
              </div>
              <h2 className="text-2xl font-800 text-foreground mb-2">Application Submitted!</h2>
              <p className="text-sm text-muted-foreground mb-1">Your seller application is under review</p>
              <p className="mono-id mb-6">{sellerId}</p>
              <div className="bg-muted/50 rounded-xl border border-border p-4 text-left mb-6 space-y-2">
                {[
                  { label: 'Business', value: form.businessName },
                  { label: 'GSTIN', value: form.gstin },
                  { label: 'Bank', value: form.bankAccountNumber ? `****${form.bankAccountNumber.slice(-4)}` : '—' },
                  { label: 'Linked Account', value: bankVerification.linkedAccountId || '—' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className="text-xs font-600 text-foreground font-mono">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/seller-dashboard" className="btn-primary flex-1 py-3 text-sm rounded-xl text-center">
                  Go to Seller Dashboard
                </Link>
                <Link href="/marketplace" className="btn-secondary flex-1 py-3 text-sm rounded-xl text-center">
                  Browse Marketplace
                </Link>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          {currentStep !== 'phone' && currentStep !== 'otp' && currentStep !== 'done' && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
              <button onClick={goBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Icon name="ArrowLeftIcon" size={16} /> Back
              </button>
              <button onClick={goNext} disabled={!canProceedToNext()}
                className="btn-primary px-6 py-2.5 text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {currentStep === 'documents' ? 'Submit Application' : 'Continue'}
                <Icon name="ArrowRightIcon" size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Progress indicator */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Step {currentIndex + 1} of {STEP_ORDER.length} · {Math.round((currentIndex / (STEP_ORDER.length - 1)) * 100)}% complete
        </p>
      </div>
    </div>
  );
}
