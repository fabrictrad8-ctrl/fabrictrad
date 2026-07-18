'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

function validateIndianPhone(phone: string): { valid: boolean; message: string } {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length !== 10) return { valid: false, message: 'Phone number must be exactly 10 digits' };
  if (!/^[6-9]/.test(cleaned)) return { valid: false, message: 'Indian mobile numbers must start with 6, 7, 8, or 9' };
  if (/^(\d)\1{9}$/.test(cleaned)) return { valid: false, message: 'Please enter a valid phone number' };
  return { valid: true, message: '' };
}

const indianStates = [
  'Andhra Pradesh', 'Gujarat', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
  'Uttar Pradesh', 'West Bengal', 'Delhi', 'Haryana', 'Bihar',
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'personal' | 'address' | 'security'>('personal');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [personalForm, setPersonalForm] = useState({
    full_name: '',
    phone: '',
    business_name: '',
    gstin: '',
  });

  const [addressForm, setAddressForm] = useState({
    line1: '',
    line2: '',
    city: '',
    state: '',
    pin: '',
    country: 'India',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [phoneValidation, setPhoneValidation] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading]);

  useEffect(() => {
    if (profile) {
      setPersonalForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        business_name: (profile as any).business_name || '',
        gstin: (profile as any).gstin || '',
      });
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingPhoto(true);
    setErrorMsg('');
    try {
      const ext = file.name.split('.').pop();
      const filePath = `avatars/${user.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      await refreshProfile();
      setSuccessMsg('Profile photo updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMsg('');
    setSaving(true);

    if (personalForm.phone) {
      const { valid, message } = validateIndianPhone(personalForm.phone);
      if (!valid) {
        setErrorMsg(message);
        setSaving(false);
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: personalForm.full_name,
          phone: personalForm.phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      setSuccessMsg('Personal details saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save details');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMsg('');
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          address_line1: addressForm.line1,
          address_line2: addressForm.line2,
          city: addressForm.city,
          state: addressForm.state,
          pincode: addressForm.pin,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      setSuccessMsg('Address saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (passwordForm.newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
      if (error) throw error;
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccessMsg('Password updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const dashboardLink = profile?.role === 'seller' ? '/seller-dashboard' : '/buyer-dashboard';
  const roleLabel = profile?.role === 'seller' ? 'Seller' : 'Buyer';

  return (
    <div className="min-h-screen gradient-hero py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href={dashboardLink} className="p-2 hover:bg-muted rounded-xl transition-colors">
            <Icon name="ArrowLeftIcon" size={18} className="text-muted-foreground" />
          </Link>
          <div className="flex items-center gap-2">
            <AppLogo size={32} />
            <span className="font-display font-800 text-lg text-secondary">FabricTrad</span>
          </div>
          <span className={`ml-auto text-xs font-700 px-3 py-1 rounded-full border ${
            profile?.role === 'seller' ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-primary/10 text-primary border-primary/20'
          }`}>
            {roleLabel} Account
          </span>
        </div>

        {/* Profile Photo Card */}
        <div className="bg-card rounded-2xl border border-border p-6 card-shadow-lg mb-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-muted border-2 border-border">
                {avatarUrl ? (
                  <AppImage src={avatarUrl} alt={`${profile?.full_name || 'User'} profile photo`} width={80} height={80} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                    <span className="text-2xl font-800 text-primary">
                      {profile?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {uploadingPhoto ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon name="CameraIcon" size={14} />
                )}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </div>
            <div>
              <h1 className="text-xl font-800 text-foreground">{profile?.full_name || 'Your Name'}</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {profile?.phone ? `+91 ${profile.phone}` : 'No phone number added'}
              </p>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {successMsg && (
          <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-xl mb-4">
            <Icon name="CheckCircleIcon" size={14} className="text-success" />
            <p className="text-xs text-success font-600">{successMsg}</p>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 bg-error/10 border border-error/20 rounded-xl mb-4">
            <Icon name="ExclamationTriangleIcon" size={14} className="text-error" />
            <p className="text-xs text-error">{errorMsg}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex rounded-xl border border-border overflow-hidden mb-6 bg-card">
          {[
            { key: 'personal', label: 'Personal Details', icon: 'UserIcon' },
            { key: 'address', label: 'Address', icon: 'MapPinIcon' },
            { key: 'security', label: 'Security', icon: 'LockClosedIcon' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-600 transition-colors ${
                activeTab === tab.key ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon name={tab.icon as 'UserIcon'} size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Personal Details Tab */}
        {activeTab === 'personal' && (
          <div className="bg-card rounded-2xl border border-border p-6 card-shadow-lg">
            <h2 className="text-base font-800 text-foreground mb-5">Personal Details</h2>
            <form onSubmit={handleSavePersonal} className="space-y-4">
              <div>
                <label className="block text-sm font-700 text-foreground mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={personalForm.full_name}
                  onChange={(e) => setPersonalForm({ ...personalForm, full_name: e.target.value })}
                  placeholder="Your full name"
                  className="input-base w-full px-4 py-3 text-sm rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-700 text-foreground mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="input-base w-full px-4 py-3 text-sm rounded-xl bg-muted opacity-60 cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm font-700 text-foreground mb-1.5">Phone Number (India)</label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-3 py-3 shrink-0">
                    <span className="text-lg">🇮🇳</span>
                    <span className="text-sm font-600 text-foreground">+91</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    value={personalForm.phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setPersonalForm({ ...personalForm, phone: val });
                      if (val.length === 10) {
                        const { valid, message } = validateIndianPhone(val);
                        setPhoneValidation(valid ? '' : message);
                      } else {
                        setPhoneValidation('');
                      }
                    }}
                    placeholder="98765 43210"
                    className={`input-base flex-1 px-4 py-3 text-sm rounded-xl ${phoneValidation ? 'border-error' : ''}`}
                  />
                </div>
                {phoneValidation && (
                  <p className="text-xs text-error mt-1 flex items-center gap-1">
                    <Icon name="ExclamationCircleIcon" size={12} />
                    {phoneValidation}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Phone number is validated but no OTP verification required</p>
              </div>
              <button
                type="submit"
                disabled={saving || !!phoneValidation}
                className="btn-primary w-full py-3 text-sm rounded-xl disabled:opacity-50"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : 'Save Personal Details'}
              </button>
            </form>
          </div>
        )}

        {/* Address Tab */}
        {activeTab === 'address' && (
          <div className="bg-card rounded-2xl border border-border p-6 card-shadow-lg">
            <h2 className="text-base font-800 text-foreground mb-5">Shipping Address</h2>
            <form onSubmit={handleSaveAddress} className="space-y-4">
              <div>
                <label className="block text-sm font-700 text-foreground mb-1.5">Address Line 1</label>
                <input
                  type="text"
                  value={addressForm.line1}
                  onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                  placeholder="Shop No. / Building Name / Street"
                  className="input-base w-full px-4 py-3 text-sm rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-700 text-foreground mb-1.5">Address Line 2</label>
                <input
                  type="text"
                  value={addressForm.line2}
                  onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })}
                  placeholder="Area / Colony"
                  className="input-base w-full px-4 py-3 text-sm rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-700 text-foreground mb-1.5">PIN Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={addressForm.pin}
                    onChange={(e) => setAddressForm({ ...addressForm, pin: e.target.value.replace(/\D/g, '') })}
                    placeholder="400001"
                    className="input-base w-full px-4 py-3 text-sm rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-700 text-foreground mb-1.5">City</label>
                  <input
                    type="text"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    placeholder="Mumbai"
                    className="input-base w-full px-4 py-3 text-sm rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-700 text-foreground mb-1.5">State</label>
                <select
                  value={addressForm.state}
                  onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                  className="input-base w-full px-4 py-3 text-sm rounded-xl"
                >
                  <option value="">Select state</option>
                  {indianStates.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full py-3 text-sm rounded-xl disabled:opacity-50"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : 'Save Address'}
              </button>
            </form>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="bg-card rounded-2xl border border-border p-6 card-shadow-lg">
            <h2 className="text-base font-800 text-foreground mb-5">Security Settings</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl mb-2">
                <Icon name="InformationCircleIcon" size={14} className="text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-primary">If you signed in with Google, you may not have a password. You can set one here.</p>
              </div>
              <div>
                <label className="block text-sm font-700 text-foreground mb-1.5">New Password</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Min. 8 characters"
                  className="input-base w-full px-4 py-3 text-sm rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-700 text-foreground mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Repeat new password"
                  className="input-base w-full px-4 py-3 text-sm rounded-xl"
                />
              </div>
              <button
                type="submit"
                disabled={saving || !passwordForm.newPassword}
                className="btn-primary w-full py-3 text-sm rounded-xl disabled:opacity-50"
              >
                {saving ? 'Updating...' : 'Update Password'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-border">
              <h3 className="text-sm font-700 text-foreground mb-3">Account Info</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Account Role</span>
                  <span className="text-sm font-600 text-foreground capitalize">{profile?.role || '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Account Status</span>
                  <span className={`text-xs font-700 px-2 py-0.5 rounded-full ${profile?.is_active ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                    {profile?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Email Verified</span>
                  <span className={`text-xs font-700 px-2 py-0.5 rounded-full ${user?.email_confirmed_at ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                    {user?.email_confirmed_at ? 'Verified' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
