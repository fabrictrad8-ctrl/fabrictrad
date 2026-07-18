'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

type Step = 'phone' | 'otp' | 'profile' | 'address' | 'done';

const steps = [
  { key: 'phone', label: 'Phone', icon: 'DevicePhoneMobileIcon' },
  { key: 'otp', label: 'Verify OTP', icon: 'KeyIcon' },
  { key: 'profile', label: 'Business Profile', icon: 'BuildingOfficeIcon' },
  { key: 'address', label: 'Address', icon: 'MapPinIcon' },
  { key: 'done', label: 'Done', icon: 'CheckCircleIcon' },
];

const stepOrder: Step[] = ['phone', 'otp', 'profile', 'address', 'done'];

export default function BuyerRegistrationFlow() {
  const [currentStep, setCurrentStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [phoneConflictError, setPhoneConflictError] = useState('');
  const [form, setForm] = useState({
    fullName: '', email: '', businessName: '', businessType: '',
    gstin: '', category: '', volume: '',
  });
  const [address, setAddress] = useState({
    line1: '', line2: '', landmark: '', city: '', district: '', state: '', pin: '', country: 'India',
    recipientName: '', recipientPhone: '',
  });
  const [agreed, setAgreed] = useState(false);
  const [buyerId] = useState('FT-BYR-007842');

  const currentIndex = stepOrder.indexOf(currentStep);

  const handleSendOtp = () => {
    if (phone.length === 10) {
      // Check if this number is already registered as a seller
      const sellerNumbers: string[] = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('ft_seller_phones') || '[]' : '[]');
      if (sellerNumbers.includes(phone)) {
        setPhoneConflictError('This mobile number is already registered as a Seller. A person cannot be both a buyer and seller with the same number. Please use a different mobile number for your buyer account.');
        return;
      }
      setPhoneConflictError('');
      // Save buyer phone
      if (typeof window !== 'undefined') {
        const existing: string[] = JSON.parse(localStorage.getItem('ft_buyer_phones') || '[]');
        if (!existing.includes(phone)) {
          localStorage.setItem('ft_buyer_phones', JSON.stringify([...existing, phone]));
        }
      }
      setOtpSent(true);
      setResendCooldown(30);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
      setCurrentStep('otp');
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);
    if (val && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`);
      next?.focus();
    }
  };

  const handleVerifyOtp = () => {
    setCurrentStep('profile');
  };

  const indianStates = [
    'Andhra Pradesh', 'Gujarat', 'Karnataka', 'Kerala', 'Madhya Pradesh',
    'Maharashtra', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
    'Uttar Pradesh', 'West Bengal', 'Delhi', 'Haryana', 'Bihar',
  ];

  const businessTypes = ['Retailer', 'Wholesaler', 'Manufacturer', 'Designer', 'Exporter', 'Other'];
  const categories = ['Silk Fabrics', 'Cotton & Linen', 'Net & Embroidered', 'Georgette', 'Polyester', 'Handloom', 'All Categories'];

  return (
    <div className="min-h-screen gradient-hero py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-800 text-foreground mb-1">Create Buyer Account</h1>
          <p className="text-sm text-muted-foreground">Join 45,000+ businesses sourcing on FabricTrad</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 relative">
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-border z-0" />
          <div
            className="absolute top-5 left-0 h-0.5 bg-primary z-0 transition-all duration-500"
            style={{ width: `${(currentIndex / (stepOrder.length - 1)) * 100}%` }}
          />
          {steps.map((step, i) => {
            const isCompleted = i < currentIndex;
            const isActive = step.key === currentStep;
            return (
              <div key={step.key} className="flex flex-col items-center gap-1.5 relative z-10">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  isCompleted ? 'bg-success border-success' : isActive ?'bg-primary border-primary': 'bg-background border-border'
                }`}>
                  {isCompleted ? (
                    <Icon name="CheckIcon" size={16} className="text-white" />
                  ) : (
                    <Icon name={step.icon as 'KeyIcon'} size={16} className={isActive ? 'text-white' : 'text-muted-foreground'} />
                  )}
                </div>
                <span className={`text-xs font-600 hidden sm:block ${isActive ? 'text-primary' : isCompleted ? 'text-success' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="bg-card rounded-2xl border border-border p-6 md:p-8 card-shadow-lg">

          {/* Step 1: Phone */}
          {currentStep === 'phone' && (
            <div>
              <h2 className="text-xl font-800 text-foreground mb-1">Enter your mobile number</h2>
              <p className="text-sm text-muted-foreground mb-6">We'll send a 6-digit OTP to verify your number</p>

              <div className="mb-4">
                <label className="block text-sm font-700 text-foreground mb-2">Mobile Number</label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-3 py-3 shrink-0">
                    <span className="text-lg">🇮🇳</span>
                    <span className="text-sm font-600 text-foreground">+91</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); setPhoneConflictError(''); }}
                    placeholder="98765 43210"
                    className={`input-base flex-1 px-4 py-3 text-lg font-600 rounded-xl tracking-widest ${phoneConflictError ? 'border-error' : ''}`}
                  />
                </div>
              </div>

              {phoneConflictError && (
                <div className="flex items-start gap-2 p-3 bg-error/10 border border-error/20 rounded-xl mb-4">
                  <span className="text-error text-sm shrink-0">⚠️</span>
                  <p className="text-xs text-error">{phoneConflictError}</p>
                </div>
              )}

              {/* Unique number notice */}
              <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl mb-4">
                <Icon name="InformationCircleIcon" size={14} className="text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-primary">
                  If you are also a seller on FabricTrad, you must use a <strong>different mobile number</strong> for your buyer account. The same number cannot be used for both accounts.
                </p>
              </div>

              {/* Dev mode notice */}
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-5">
                <Icon name="BeakerIcon" size={14} className="text-warning shrink-0" />
                <p className="text-xs text-warning"><span className="font-700">DEV MODE:</span> OTP will be shown in console. Real SMS disabled.</p>
              </div>

              <button
                onClick={handleSendOtp}
                disabled={phone.length !== 10}
                className="btn-primary w-full py-3 text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send OTP
              </button>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Already have an account?{' '}
                <Link href="/buyer-dashboard" className="text-primary font-600 hover:underline">Login here</Link>
              </p>
            </div>
          )}

          {/* Step 2: OTP */}
          {currentStep === 'otp' && (
            <div>
              <h2 className="text-xl font-800 text-foreground mb-1">Verify your number</h2>
              <p className="text-sm text-muted-foreground mb-6">
                OTP sent to +91 {phone.slice(0, 5)}*****
              </p>

              <div className="flex justify-center gap-2 sm:gap-3 mb-6">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    className="w-11 h-14 text-center text-xl font-800 input-base rounded-xl"
                  />
                ))}
              </div>

              <button onClick={handleVerifyOtp} className="btn-primary w-full py-3 text-sm rounded-xl mb-3">
                Verify OTP
              </button>

              <div className="text-center">
                {resendCooldown > 0 ? (
                  <p className="text-xs text-muted-foreground">Resend OTP in {resendCooldown}s</p>
                ) : (
                  <button onClick={handleSendOtp} className="text-xs text-primary font-600 hover:underline">
                    Resend OTP
                  </button>
                )}
              </div>

              <button onClick={() => setCurrentStep('phone')} className="mt-4 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto">
                <Icon name="ArrowLeftIcon" size={12} />
                Change number
              </button>
            </div>
          )}

          {/* Step 3: Business Profile */}
          {currentStep === 'profile' && (
            <div>
              <h2 className="text-xl font-800 text-foreground mb-1">Business Profile</h2>
              <p className="text-sm text-muted-foreground mb-6">Tell us about your business</p>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">Full Name *</label>
                    <input
                      type="text"
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      placeholder="Rajesh Kumar"
                      className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">Email Address *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="rajesh@business.com"
                      className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-700 text-foreground mb-1.5">Business Name</label>
                  <input
                    type="text"
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    placeholder="Rajesh Garments Pvt Ltd"
                    className="input-base w-full px-4 py-3 text-sm rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">Business Type</label>
                    <select
                      value={form.businessType}
                      onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                      className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    >
                      <option value="">Select type</option>
                      {businessTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">Primary Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    >
                      <option value="">Select category</option>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-700 text-foreground mb-1.5">
                    GSTIN <span className="text-xs text-muted-foreground font-400">(optional — required for GST invoices)</span>
                  </label>
                  <input
                    type="text"
                    value={form.gstin}
                    onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                    placeholder="27AAAPL1234Z1Z5"
                    maxLength={15}
                    className="input-base w-full px-4 py-3 text-sm rounded-xl font-mono tracking-wider"
                  />
                </div>

                <div>
                  <label className="block text-sm font-700 text-foreground mb-1.5">Monthly Sourcing Volume</label>
                  <select
                    value={form.volume}
                    onChange={(e) => setForm({ ...form, volume: e.target.value })}
                    className="input-base w-full px-4 py-3 text-sm rounded-xl"
                  >
                    <option value="">Select range</option>
                    <option>₹1L - ₹5L / month</option>
                    <option>₹5L - ₹25L / month</option>
                    <option>₹25L - ₹1Cr / month</option>
                    <option>₹1Cr+ / month</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => setCurrentStep('address')}
                className="btn-primary w-full py-3 text-sm rounded-xl mt-6"
              >
                Continue to Address
              </button>
            </div>
          )}

          {/* Step 4: Address */}
          {currentStep === 'address' && (
            <div>
              <h2 className="text-xl font-800 text-foreground mb-1">Shipping Address</h2>
              <p className="text-sm text-muted-foreground mb-6">Primary delivery address for your orders</p>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">Recipient Name *</label>
                    <input
                      type="text"
                      value={address.recipientName}
                      onChange={(e) => setAddress({ ...address, recipientName: e.target.value })}
                      placeholder="Rajesh Kumar"
                      className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">Recipient Phone *</label>
                    <input
                      type="tel"
                      value={address.recipientPhone}
                      onChange={(e) => setAddress({ ...address, recipientPhone: e.target.value })}
                      placeholder="98765 43210"
                      className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-700 text-foreground mb-1.5">Address Line 1 *</label>
                  <input
                    type="text"
                    value={address.line1}
                    onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                    placeholder="Shop No. / Building Name / Street"
                    className="input-base w-full px-4 py-3 text-sm rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-700 text-foreground mb-1.5">Address Line 2</label>
                  <input
                    type="text"
                    value={address.line2}
                    onChange={(e) => setAddress({ ...address, line2: e.target.value })}
                    placeholder="Area / Colony"
                    className="input-base w-full px-4 py-3 text-sm rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-700 text-foreground mb-1.5">Landmark</label>
                  <input
                    type="text"
                    value={address.landmark}
                    onChange={(e) => setAddress({ ...address, landmark: e.target.value })}
                    placeholder="Near Textile Market / Opposite Bank"
                    className="input-base w-full px-4 py-3 text-sm rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-700 text-foreground mb-1.5">PIN Code *</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={address.pin}
                      onChange={(e) => setAddress({ ...address, pin: e.target.value.replace(/\D/g, '') })}
                      placeholder="400001"
                      className="input-base w-full px-4 py-3 text-sm rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">City *</label>
                    <input
                      type="text"
                      value={address.city}
                      onChange={(e) => setAddress({ ...address, city: e.target.value })}
                      placeholder="Mumbai"
                      className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">District</label>
                    <input
                      type="text"
                      value={address.district}
                      onChange={(e) => setAddress({ ...address, district: e.target.value })}
                      placeholder="Mumbai"
                      className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">State *</label>
                    <select
                      value={address.state}
                      onChange={(e) => setAddress({ ...address, state: e.target.value })}
                      className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    >
                      <option value="">State</option>
                      {indianStates.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* T&C */}
                <div
                  className="flex items-start gap-3 p-4 bg-muted rounded-xl cursor-pointer"
                  onClick={() => setAgreed(!agreed)}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${agreed ? 'bg-primary border-primary' : 'border-border bg-card'}`}>
                    {agreed && <Icon name="CheckIcon" size={12} className="text-white" />}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    I agree to FabricTrad's{' '}
                    <span className="text-primary font-600">Buyer User Agreement</span>,{' '}
                    <span className="text-primary font-600">Terms of Use</span>, and{' '}
                    <span className="text-primary font-600">Privacy Policy</span>.
                    I understand the No Return / Exchange-only policy with unboxing video within 24 hours.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCurrentStep('done')}
                disabled={!agreed}
                className="btn-primary w-full py-3 text-sm rounded-xl mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Complete Registration
              </button>
            </div>
          )}

          {/* Step 5: Done */}
          {currentStep === 'done' && (
            <div className="text-center py-6">
              <div className="w-20 h-20 rounded-full bg-success/10 border-2 border-success flex items-center justify-center mx-auto mb-5">
                <Icon name="CheckCircleIcon" size={40} className="text-success" />
              </div>

              <h2 className="text-2xl font-800 text-foreground mb-2">Welcome to FabricTrad!</h2>
              <p className="text-muted-foreground text-sm mb-5">Your buyer account has been created successfully.</p>

              <div className="bg-muted rounded-2xl p-4 mb-6 inline-block">
                <p className="text-xs text-muted-foreground mb-1">Your Buyer ID</p>
                <p className="font-mono text-xl font-800 text-primary">{buyerId}</p>
              </div>

              <div className="space-y-2 text-left mb-6 bg-muted rounded-xl p-4">
                {[
                  '✅ Phone number verified',
                  '✅ Business profile saved',
                  '✅ Shipping address saved',
                  '📧 Welcome email sent',
                  '🔔 Notifications enabled',
                ].map((item) => (
                  <p key={item} className="text-sm text-foreground">{item}</p>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/marketplace" className="btn-primary flex-1 py-3 text-sm rounded-xl text-center">
                  Start Shopping
                </Link>
                <Link href="/buyer-dashboard" className="btn-secondary flex-1 py-3 text-sm rounded-xl text-center">
                  Go to Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Trust badges */}
        {currentStep !== 'done' && (
          <div className="flex items-center justify-center gap-6 mt-6">
            {[
              { icon: 'LockClosedIcon', label: 'Secure & Encrypted' },
              { icon: 'ShieldCheckIcon', label: 'DPDP Compliant' },
              { icon: 'NoSymbolIcon', label: 'No Spam' },
            ].map((b) => (
              <div key={b.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon name={b.icon as 'LockClosedIcon'} size={12} />
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}