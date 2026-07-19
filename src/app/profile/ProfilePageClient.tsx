'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

function validateIndianPhone(phone: string): { valid: boolean; message: string } {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length !== 10)
    return { valid: false, message: 'Phone number must be exactly 10 digits' };
  if (!/^[6-9]/.test(cleaned))
    return { valid: false, message: 'Indian mobile numbers must start with 6, 7, 8, or 9' };
  if (/^(\d)\1{9}$/.test(cleaned))
    return { valid: false, message: 'Please enter a valid phone number' };
  return { valid: true, message: '' };
}

const indianStates = [
  'Andhra Pradesh',
  'Gujarat',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'West Bengal',
  'Delhi',
  'Haryana',
  'Bihar',
];

type ProfileTab = 'personal' | 'business' | 'address' | 'activity' | 'security';

const profileTabs: ProfileTab[] = ['personal', 'business', 'address', 'activity', 'security'];

const getValidProfileTab = (tab: string | null): ProfileTab =>
  profileTabs.includes(tab as ProfileTab) ? (tab as ProfileTab) : 'personal';

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, refreshProfile, isDemoAccount } = useAuth();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<ProfileTab>(() =>
    getValidProfileTab(searchParams?.get('tab') || null)
  );
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
  }, [user, loading, router]);

  useEffect(() => {
    setActiveTab(getValidProfileTab(searchParams?.get('tab') || null));
  }, [searchParams]);

  useEffect(() => {
    if (profile) {
      setPersonalForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        business_name: (profile as any).business_name || '',
        gstin: (profile as any).gstin || '',
      });
      setAddressForm({
        line1: (profile as any).address_line1 || '',
        line2: (profile as any).address_line2 || '',
        city: (profile as any).city || '',
        state: (profile as any).state || '',
        pin: (profile as any).pincode || '',
        country: 'India',
      });
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (isDemoAccount) {
      setErrorMsg('');
      setSuccessMsg('Demo profile photo preview acknowledged. Demo accounts do not save files.');
      setTimeout(() => setSuccessMsg(''), 3000);
      return;
    }

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

    if (!personalForm.phone) {
      setErrorMsg('Phone number is mandatory for buyer and seller accounts');
      setSaving(false);
      return;
    }

    const { valid, message } = validateIndianPhone(personalForm.phone);
    if (!valid) {
      setErrorMsg(message);
      setSaving(false);
      return;
    }

    try {
      if (isDemoAccount) {
        setSuccessMsg('Demo personal details checked. Demo accounts do not update live records.');
        setTimeout(() => setSuccessMsg(''), 3000);
        return;
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: personalForm.full_name,
          phone: personalForm.phone,
          business_name: personalForm.business_name || null,
          gstin: personalForm.gstin || null,
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
      if (isDemoAccount) {
        setSuccessMsg('Demo address checked. Demo accounts do not update live records.');
        setTimeout(() => setSuccessMsg(''), 3000);
        return;
      }

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
      if (isDemoAccount) {
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setSuccessMsg('Demo password flow checked. Demo credentials stay fixed.');
        setTimeout(() => setSuccessMsg(''), 3000);
        return;
      }

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

  const isSeller = profile?.role === 'seller';
  const isAdmin = profile?.role === 'admin_staff' || profile?.role === 'super_admin';
  const dashboardLink = isAdmin
    ? '/admin-portal'
    : isSeller
      ? '/seller-dashboard'
      : '/buyer-dashboard';
  const roleLabel = isAdmin ? 'Admin' : isSeller ? 'Seller' : 'Buyer';
  const handleProfileTabChange = (tab: ProfileTab) => {
    setActiveTab(tab);
    router.replace(tab === 'personal' ? '/profile' : `/profile?tab=${tab}`, { scroll: false });
  };
  const accountId = profile?.id
    ? `FT-${isAdmin ? 'ADM' : isSeller ? 'SLR' : 'BYR'}-${profile.id.slice(0, 6).toUpperCase()}`
    : `FT-${isAdmin ? 'ADM' : isSeller ? 'SLR' : 'BYR'}`;
  const activityCards = isAdmin
    ? [
        {
          title: 'Payments',
          value: 'Review transactions',
          href: '/admin-portal?tab=payments',
          icon: 'CreditCardIcon',
        },
        {
          title: 'Orders',
          value: 'Platform orders',
          href: '/admin-portal?tab=orders',
          icon: 'ClipboardDocumentListIcon',
        },
        {
          title: 'Sellers',
          value: 'Verify sellers',
          href: '/admin-portal?tab=sellers',
          icon: 'BuildingStorefrontIcon',
        },
        {
          title: 'Listings',
          value: 'Review catalog',
          href: '/admin-portal?tab=listings',
          icon: 'ArchiveBoxIcon',
        },
        {
          title: 'Errors',
          value: 'Monitor issues',
          href: '/admin-portal?tab=errors',
          icon: 'ExclamationTriangleIcon',
        },
        {
          title: 'Settings',
          value: 'Platform config',
          href: '/admin-portal?tab=settings',
          icon: 'CogIcon',
        },
      ]
    : isSeller
      ? [
          {
            title: 'Orders',
            value: 'Open order queue',
            href: '/seller-dashboard?tab=orders',
            icon: 'ClipboardDocumentListIcon',
          },
          {
            title: 'Listings',
            value: 'Manage catalog',
            href: '/seller-dashboard?tab=inventory',
            icon: 'ArchiveBoxIcon',
          },
          {
            title: 'Earnings',
            value: 'View payouts',
            href: '/seller-dashboard?tab=earnings',
            icon: 'BanknotesIcon',
          },
          {
            title: 'Buyer Inbox',
            value: 'Open messages',
            href: '/seller-dashboard?tab=inbox',
            icon: 'ChatBubbleLeftRightIcon',
          },
          {
            title: 'Shipping',
            value: 'Track fulfilment',
            href: '/seller-dashboard?tab=fulfillment',
            icon: 'TruckIcon',
          },
          {
            title: 'Analytics',
            value: 'View trends',
            href: '/seller-dashboard?tab=analytics',
            icon: 'ChartBarIcon',
          },
        ]
      : [
          {
            title: 'Purchases',
            value: 'Open orders',
            href: '/buyer-dashboard?tab=orders',
            icon: 'ShoppingBagIcon',
          },
          {
            title: 'History',
            value: 'Track shipments',
            href: '/buyer-dashboard?tab=tracking',
            icon: 'ClockIcon',
          },
          {
            title: 'Wishlist',
            value: 'Saved fabrics',
            href: '/buyer-dashboard?tab=wishlist',
            icon: 'HeartIcon',
          },
          {
            title: 'Requirements',
            value: 'Post or review',
            href: '/buyer-dashboard?tab=requirements',
            icon: 'MegaphoneIcon',
          },
          {
            title: 'Messages',
            value: 'Open disputes',
            href: '/buyer-dashboard?tab=disputes',
            icon: 'ChatBubbleLeftRightIcon',
          },
          {
            title: 'AI Drape',
            value: 'Try fabrics',
            href: '/product-detail#drape-on',
            icon: 'SparklesIcon',
          },
        ];

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href={dashboardLink} className="p-2 hover:bg-muted rounded-xl transition-colors">
            <Icon name="ArrowLeftIcon" size={18} className="text-muted-foreground" />
          </Link>
          <div className="flex items-center gap-2">
            <AppLogo size={32} />
            <span className="font-display font-800 text-lg text-secondary">FabricTrad</span>
          </div>
          <span
            className={`ml-auto text-xs font-700 px-3 py-1 rounded-full border ${
              profile?.role === 'seller'
                ? 'bg-secondary/10 text-secondary border-secondary/20'
                : 'bg-primary/10 text-primary border-primary/20'
            }`}
          >
            {roleLabel} Account
          </span>
        </div>

        {/* Profile Photo Card */}
        <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 card-shadow mb-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-muted border-2 border-border">
                {avatarUrl ? (
                  <AppImage
                    src={avatarUrl}
                    alt={`${profile?.full_name || 'User'} profile photo`}
                    width={80}
                    height={80}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                    <span className="text-2xl font-800 text-primary">
                      {profile?.full_name?.charAt(0)?.toUpperCase() ||
                        user?.email?.charAt(0)?.toUpperCase() ||
                        '?'}
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-800 text-foreground">
                {profile?.full_name || 'Your Name'}
              </h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {profile?.phone ? `+91 ${profile.phone}` : 'No phone number added'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="mono-id rounded-full bg-muted px-2.5 py-1">{accountId}</span>
                <span className="badge-verified">{profile?.is_active ? 'Active' : 'Pending'}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-800 ${
                    isSeller ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'
                  }`}
                >
                  {roleLabel}
                </span>
              </div>
            </div>
            <Link
              href={dashboardLink}
              className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm"
            >
              <Icon name="Squares2X2Icon" size={16} />
              Open Dashboard
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {activityCards.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Icon name={item.icon} size={18} className="text-primary" />
              </div>
              <p className="text-sm font-800 text-foreground">{item.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.value}</p>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
          <div className="space-y-3">
            <div className="bg-card rounded-xl border border-border p-3">
              {[
                { key: 'personal', label: 'Personal Details', icon: 'UserIcon' },
                {
                  key: 'business',
                  label: isSeller ? 'Business Details' : 'Buyer Details',
                  icon: isSeller ? 'BuildingOfficeIcon' : 'ShoppingBagIcon',
                },
                {
                  key: 'address',
                  label: isSeller ? 'Pickup Address' : 'Delivery Address',
                  icon: 'MapPinIcon',
                },
                {
                  key: 'activity',
                  label: isSeller ? 'Store Activity' : 'Purchase Activity',
                  icon: 'ClockIcon',
                },
                { key: 'security', label: 'Security', icon: 'LockClosedIcon' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleProfileTabChange(tab.key as ProfileTab)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-700 transition-colors ${
                    activeTab === tab.key
                      ? 'bg-primary text-white'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon name={tab.icon} size={17} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0">
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

            {/* Personal Details Tab */}
            {activeTab === 'personal' && (
              <div className="bg-card rounded-2xl border border-border p-6 card-shadow">
                <h2 className="text-base font-800 text-foreground mb-5">Personal Details</h2>
                <form onSubmit={handleSavePersonal} className="space-y-4">
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={personalForm.full_name}
                      onChange={(e) =>
                        setPersonalForm({ ...personalForm, full_name: e.target.value })
                      }
                      placeholder="Your full name"
                      className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="input-base w-full px-4 py-3 text-sm rounded-xl bg-muted opacity-60 cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">
                      Phone Number (India) *
                    </label>
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
                    <p className="text-xs text-muted-foreground mt-1">
                      Mandatory for buyer and seller accounts
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-700 text-foreground mb-1.5">
                        {isSeller ? 'Business Name' : 'Company / Store Name'}
                      </label>
                      <input
                        type="text"
                        value={personalForm.business_name}
                        onChange={(e) =>
                          setPersonalForm({ ...personalForm, business_name: e.target.value })
                        }
                        placeholder={isSeller ? 'Your textile business' : 'Your buying company'}
                        className="input-base w-full px-4 py-3 text-sm rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-700 text-foreground mb-1.5">GSTIN</label>
                      <input
                        type="text"
                        value={personalForm.gstin}
                        onChange={(e) =>
                          setPersonalForm({ ...personalForm, gstin: e.target.value.toUpperCase() })
                        }
                        placeholder="24AAAPL1234Z1Z5"
                        className="input-base w-full px-4 py-3 text-sm rounded-xl uppercase"
                      />
                    </div>
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
                    ) : (
                      'Save Personal Details'
                    )}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'business' && (
              <div className="bg-card rounded-2xl border border-border p-6 card-shadow">
                <h2 className="text-base font-800 text-foreground mb-5">
                  {isSeller ? 'Business Details' : 'Buyer Details'}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Account ID', value: accountId, icon: 'IdentificationIcon' },
                    {
                      label: 'Role',
                      value: roleLabel,
                      icon: isSeller ? 'BuildingOfficeIcon' : 'ShoppingBagIcon',
                    },
                    {
                      label: 'Business Name',
                      value: personalForm.business_name || 'Not added',
                      icon: 'BriefcaseIcon',
                    },
                    {
                      label: 'GSTIN',
                      value: personalForm.gstin || 'Not added',
                      icon: 'DocumentCheckIcon',
                    },
                    { label: 'Email', value: user?.email || 'Not available', icon: 'EnvelopeIcon' },
                    {
                      label: 'Mobile',
                      value: personalForm.phone ? `+91 ${personalForm.phone}` : 'Required',
                      icon: 'PhoneIcon',
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-border bg-muted/40 p-4"
                    >
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-card">
                        <Icon name={item.icon} size={18} className="text-primary" />
                      </div>
                      <p className="text-xs font-700 uppercase text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="mt-1 break-words text-sm font-800 text-foreground">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-800 text-foreground">
                    {isSeller ? 'Seller storefront options' : 'Buyer account options'}
                  </p>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(isSeller
                      ? [
                          ['Catalog', '/seller-dashboard?tab=inventory'],
                          ['Payouts', '/seller-dashboard?tab=earnings'],
                          ['Courier', '/seller-dashboard?tab=courier'],
                        ]
                      : [
                          ['Purchases', '/buyer-dashboard?tab=orders'],
                          ['Wishlist', '/buyer-dashboard?tab=wishlist'],
                          ['Requirements', '/buyer-dashboard?tab=requirements'],
                        ]
                    ).map(([label, href]) => (
                      <Link
                        key={label}
                        href={href}
                        className="rounded-lg bg-card px-3 py-2 text-center text-xs font-800 text-foreground hover:text-primary"
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Address Tab */}
            {activeTab === 'address' && (
              <div className="bg-card rounded-2xl border border-border p-6 card-shadow">
                <h2 className="text-base font-800 text-foreground mb-5">
                  {isSeller ? 'Pickup Address' : 'Delivery Address'}
                </h2>
                <form onSubmit={handleSaveAddress} className="space-y-4">
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={addressForm.line1}
                      onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                      placeholder="Shop No. / Building Name / Street"
                      className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">
                      Address Line 2
                    </label>
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
                      <label className="block text-sm font-700 text-foreground mb-1.5">
                        PIN Code
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={addressForm.pin}
                        onChange={(e) =>
                          setAddressForm({ ...addressForm, pin: e.target.value.replace(/\D/g, '') })
                        }
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
                      {indianStates.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
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
                    ) : (
                      'Save Address'
                    )}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-4">
                <div className="bg-card rounded-2xl border border-border p-6 card-shadow">
                  <h2 className="text-base font-800 text-foreground mb-5">
                    {isSeller ? 'Store Activity' : 'Purchase Activity'}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activityCards.map((item) => (
                      <Link
                        key={item.title}
                        href={item.href}
                        className="flex items-center gap-3 rounded-xl border border-border p-4 hover:border-primary/40 hover:bg-muted/50"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Icon name={item.icon} size={18} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-800 text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.value}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="bg-card rounded-2xl border border-border p-6 card-shadow">
                <h2 className="text-base font-800 text-foreground mb-5">Security Settings</h2>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl mb-2">
                    <Icon
                      name="InformationCircleIcon"
                      size={14}
                      className="text-primary shrink-0 mt-0.5"
                    />
                    <p className="text-xs text-primary">
                      If you signed in with Google, you may not have a password. You can set one
                      here.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                      }
                      placeholder="Min. 8 characters"
                      className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                      }
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
                      <span className="text-sm font-600 text-foreground capitalize">
                        {profile?.role || '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Account Status</span>
                      <span
                        className={`text-xs font-700 px-2 py-0.5 rounded-full ${profile?.is_active ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}
                      >
                        {profile?.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Email Verified</span>
                      <span
                        className={`text-xs font-700 px-2 py-0.5 rounded-full ${user?.email_confirmed_at ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}
                      >
                        {user?.email_confirmed_at ? 'Verified' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
