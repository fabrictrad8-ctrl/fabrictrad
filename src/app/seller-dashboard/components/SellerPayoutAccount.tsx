'use client';

import { useCallback, useEffect, useState } from 'react';
import { PAYOUT_BUSINESS_TYPES } from '@/lib/sellerPayoutValidation';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';
import { pillClassForStatus } from '@/lib/statusPill';
import { focusTarget } from '@/lib/focusTarget';

type Account = { connected: boolean; activationStatus: string; setupState: string; bankLast4?: string; bankIfsc?: string; bankName?: string; checkedAt?: string; requirements: { field: string; reason: string; status: string }[] };
const COPY = {
  en: { title: 'Payout account', intro: 'You receive 90% of each buyer payment. FabricTrad’s 10% share includes its commission tax and payment processing costs.', refresh: 'Refresh verification', connect: 'Connect bank with Razorpay', ready: 'Razorpay verified · checkout enabled', waiting: 'Complete verification to enable checkout', note: 'Your full bank number and representative’s PAN are sent securely to Razorpay. FabricTrad stores only the bank’s last four digits and verification references.', submit: 'Submit to Razorpay', submitting: 'Submitting securely…', terms: 'I am authorised to represent this business. I accept Razorpay’s terms, authorise bank/KYC verification and accept FabricTrad’s 90% seller / 10% platform payment split.', reenter: 'Enter your full bank account number again; the number entered during registration was masked and cannot be reused.', legal: 'Legal business type', name: 'Representative’s full name (as on PAN)', pan: 'Representative’s individual PAN', address: 'Representative’s residential address', businessAddress: 'Registered business address', street: 'Street address', city: 'City', state: 'State', pin: 'PIN code', holder: 'Bank account holder name', account: 'Full bank account number', confirm: 'Confirm account number', ifsc: 'IFSC', original: 'Razorpay terms', needsHelp: 'Contact FabricTrad to reconcile the earlier setup request before submitting again.', activeHelp: 'For changes to an active bank account, contact FabricTrad. Bank settlement follows Razorpay’s applicable settlement schedule.', noAccount: 'No payout bank connected', close: 'Close form' },
  hi: { title: 'भुगतान प्राप्त करने का बैंक खाता', intro: 'खरीदार के हर भुगतान का 90% आपको मिलता है। FabricTrad के 10% हिस्से में कमीशन का कर और भुगतान प्रक्रिया का खर्च शामिल है।', refresh: 'सत्यापन की स्थिति देखें', connect: 'Razorpay से बैंक जोड़ें', ready: 'Razorpay ने सत्यापित किया · भुगतान चालू', waiting: 'भुगतान चालू करने के लिए सत्यापन पूरा करें', note: 'पूरा बैंक खाता नंबर और प्रतिनिधि का PAN सुरक्षित रूप से Razorpay को भेजा जाता है। FabricTrad केवल अंतिम चार अंक और सत्यापन के संदर्भ सहेजता है।', submit: 'Razorpay को भेजें', submitting: 'सुरक्षित रूप से भेजा जा रहा है…', terms: 'मैं इस व्यवसाय का अधिकृत प्रतिनिधि हूँ। मैं Razorpay की शर्तें, बैंक/KYC सत्यापन और FabricTrad का 90% विक्रेता / 10% प्लेटफ़ॉर्म भुगतान विभाजन स्वीकार करता/करती हूँ।', reenter: 'पूरा बैंक खाता नंबर फिर से दर्ज करें। पंजीकरण के समय दर्ज नंबर को छिपाकर सहेजा गया था, इसलिए उसे दोबारा उपयोग नहीं किया जा सकता।', legal: 'व्यवसाय का कानूनी प्रकार', name: 'प्रतिनिधि का पूरा नाम (PAN के अनुसार)', pan: 'प्रतिनिधि का व्यक्तिगत PAN', address: 'प्रतिनिधि का निवास पता', businessAddress: 'व्यवसाय का पंजीकृत पता', street: 'पूरा पता', city: 'शहर', state: 'राज्य', pin: 'पिन कोड', holder: 'बैंक खाताधारक का नाम', account: 'पूरा बैंक खाता नंबर', confirm: 'खाता नंबर फिर दर्ज करें', ifsc: 'IFSC', original: 'Razorpay की शर्तें', needsHelp: 'फिर से भेजने से पहले पिछले अनुरोध की जाँच के लिए FabricTrad से संपर्क करें।', activeHelp: 'सक्रिय बैंक खाता बदलने के लिए FabricTrad से संपर्क करें। बैंक में राशि Razorpay के लागू सेटलमेंट समय के अनुसार आती है।', noAccount: 'भुगतान के लिए बैंक खाता नहीं जुड़ा है', close: 'फ़ॉर्म बंद करें' },
  gu: { title: 'ચુકવણી મેળવવાનું બેંક ખાતું', intro: 'ખરીદદારની દરેક ચુકવણીનો 90% ભાગ તમને મળે છે. FabricTradના 10% ભાગમાં કમિશનનો કર અને ચુકવણી પ્રક્રિયાનો ખર્ચ સામેલ છે.', refresh: 'ચકાસણીની સ્થિતિ જુઓ', connect: 'Razorpay સાથે બેંક જોડો', ready: 'Razorpay દ્વારા ચકાસાયેલ · ચુકવણી ચાલુ', waiting: 'ચુકવણી શરૂ કરવા ચકાસણી પૂર્ણ કરો', note: 'સંપૂર્ણ બેંક ખાતા નંબર અને પ્રતિનિધિનો PAN સુરક્ષિત રીતે Razorpayને મોકલાય છે. FabricTrad માત્ર છેલ્લા ચાર અંક અને ચકાસણીના સંદર્ભો સાચવે છે.', submit: 'Razorpayને મોકલો', submitting: 'સુરક્ષિત રીતે મોકલાઈ રહ્યું છે…', terms: 'હું આ વ્યવસાયનો અધિકૃત પ્રતિનિધિ છું. હું Razorpayની શરતો, બેંક/KYC ચકાસણી અને FabricTradનું 90% વિક્રેતા / 10% પ્લેટફોર્મ ચુકવણી વિભાજન સ્વીકારું છું.', reenter: 'સંપૂર્ણ બેંક ખાતા નંબર ફરી દાખલ કરો. નોંધણી વખતે આપેલો નંબર ઢાંકીને સાચવ્યો હતો, તેથી તેનો ફરી ઉપયોગ થઈ શકતો નથી.', legal: 'વ્યવસાયનો કાનૂની પ્રકાર', name: 'પ્રતિનિધિનું પૂરું નામ (PAN મુજબ)', pan: 'પ્રતિનિધિનો વ્યક્તિગત PAN', address: 'પ્રતિનિધિનું રહેણાંક સરનામું', businessAddress: 'વ્યવસાયનું નોંધાયેલ સરનામું', street: 'પૂરું સરનામું', city: 'શહેર', state: 'રાજ્ય', pin: 'પિન કોડ', holder: 'બેંક ખાતાધારકનું નામ', account: 'સંપૂર્ણ બેંક ખાતા નંબર', confirm: 'ખાતા નંબર ફરી દાખલ કરો', ifsc: 'IFSC', original: 'Razorpayની શરતો', needsHelp: 'ફરી મોકલતા પહેલાં અગાઉની વિનંતીની તપાસ માટે FabricTradનો સંપર્ક કરો.', activeHelp: 'સક્રિય બેંક ખાતું બદલવા FabricTradનો સંપર્ક કરો. બેંકમાં રકમ Razorpayના લાગુ સેટલમેન્ટ સમય મુજબ જમા થાય છે.', noAccount: 'ચુકવણી માટે બેંક ખાતું જોડાયેલું નથી', close: 'ફોર્મ બંધ કરો' },
};

export default function SellerPayoutAccount() {
  const { language } = useAppPreferences();
  const copy = COPY[language as keyof typeof COPY] || COPY.en;
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/seller/payout-account', { cache: 'no-store', credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Payout status is unavailable.');
      setAccount(data.account); setReady(data.ready === true); setLoaded(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Payout status is unavailable.'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const needsHelp = account?.setupState?.startsWith('creating_') || account?.setupState === 'needs_reconciliation';
  // Razorpay's stakeholder is a person, and kyc.pan there must be an individual
  // PAN. The business's own PAN already travels separately as legal_info.pan,
  // taken from the seller profile. With the legal type set to LLP or company it
  // is a natural mistake to type the business's PAN here, and the fourth
  // character is what gives it away: P is an individual, F a firm or LLP, C a
  // company. Saying so while it is being typed beats failing on submit.
  const [panHint, setPanHint] = useState<{ tone: 'bad' | 'ok'; text: string } | null>(null);
  const PAN_HOLDER: Record<string, string> = {
    F: 'a firm or LLP', C: 'a company', H: 'a Hindu undivided family', A: 'an association',
    T: 'a trust', B: 'a body of individuals', L: 'a local authority', G: 'a government body',
    J: 'an artificial juridical person',
  };
  const checkPan = (raw: string) => {
    const value = raw.trim().toUpperCase();
    if (value.length < 4) return setPanHint(null);
    const holder = value[3];
    if (holder === 'P') {
      return setPanHint(
        value.length === 10 && /^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$/.test(value)
          ? { tone: 'ok', text: 'Individual PAN — this is the right one.' }
          : null
      );
    }
    const what = PAN_HOLDER[holder];
    setPanHint({
      tone: 'bad',
      text: what
        ? `That looks like the PAN of ${what}, not a person. Enter the authorised person's own PAN — the business's PAN is already on file from registration.`
        : "The fourth character of a personal PAN is P. Enter the authorised person's own PAN.",
    });
  };

  const clearSensitive = (form: HTMLFormElement) => {
    for (const name of ['accountNumber', 'confirmAccountNumber', 'contactPan']) {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement) field.value = '';
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/seller/payout-account', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, termsAccepted: values.termsAccepted === 'on' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Payout setup failed.');
      setAccount(data.account); setReady(data.ready === true); setMessage(data.message || ''); setShowForm(false);
      // Cleared on success only. This used to sit in `finally`, so a rejected
      // submission also blanked the account number, its confirmation and the PAN
      // -- the three hardest fields to retype -- leaving the reader to enter all
      // of them again for every validation error, without being able to see what
      // was wrong with the last attempt. Keeping them after a failure exposes
      // nothing new: the values are already in the form the reader is looking at.
      // After a success they have served their purpose and should not linger.
      clearSensitive(form);
    } catch (e) { setError(e instanceof Error ? e.message : 'Payout setup failed.'); }
    finally { setBusy(false); }
  };
  const input = (name: string, label: string, options: { maxLength?: number; pattern?: string; sensitive?: boolean; numeric?: boolean; help?: string; onValue?: (value: string) => void; hint?: { tone: 'bad' | 'ok'; text: string } | null } = {}) => (
    <label className="block text-sm font-600" key={name}>{label}
      {options.help && <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">{options.help}</span>}
      <input name={name} required disabled={busy} maxLength={options.maxLength || 100} pattern={options.pattern} autoComplete={options.sensitive ? 'off' : undefined} type={options.sensitive ? 'password' : 'text'} inputMode={options.numeric ? 'numeric' : 'text'} onChange={options.onValue ? (event) => options.onValue?.(event.target.value) : undefined} className="mt-2 block min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base font-normal" />
      {options.hint && <span className={`mt-1.5 block text-xs font-normal leading-relaxed ${options.hint.tone === 'bad' ? 'text-warning' : 'text-success'}`}>{options.hint.text}</span>}
    </label>
  );
  return <section aria-label={copy.title} className="mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-800">{copy.title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{copy.intro}</p></div><button type="button" onClick={() => void load()} disabled={busy} className="min-h-11 rounded-xl border border-border px-4 text-sm font-700 disabled:opacity-50">{copy.refresh}</button></div>
    {loaded && <div className={`mt-4 rounded-xl p-4 ${ready ? 'bg-success/10 text-success' : 'bg-muted text-foreground'}`}><p className="font-700">{ready ? copy.ready : copy.waiting}</p><p className="mt-1 text-sm">{account?.bankLast4 ? `${account.bankName || ''} · •••• ${account.bankLast4} · ${account.bankIfsc || ''}` : copy.noAccount}</p>{account?.activationStatus && <p className="mt-1 flex items-center gap-1.5 text-sm">Razorpay: <span className={pillClassForStatus(account.activationStatus)}>{account.activationStatus.replaceAll('_', ' ')}</span></p>}</div>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-error/10 p-4 text-sm text-error">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    {!!account?.requirements?.length && <ul className="mt-3 space-y-1 text-sm text-muted-foreground">{account.requirements.map((r, i) => <li key={i}>{r.field.replaceAll('_', ' ')}: {r.reason.replaceAll('_', ' ')}</li>)}</ul>}
    <p className="mt-4 text-sm leading-6 text-muted-foreground">{ready ? copy.activeHelp : needsHelp ? copy.needsHelp : copy.note}</p>
    {/* data-focus-id: "Connect payout bank" in the attention centre scrolls here
        and flashes this button, so the promised control is the thing you land on
        rather than the top of a long earnings screen. Opening the form then
        carries the reader down to it -- otherwise the form appears below the
        fold and pressing the button looks like it did nothing. */}
    {!ready && !needsHelp && <button type="button" data-focus-id="payout-connect" disabled={busy} onClick={() => { const next = !showForm; setShowForm(next); if (next) void focusTarget('payout-form'); }} className="mt-4 min-h-11 rounded-xl bg-primary px-5 text-sm font-700 text-primary-foreground disabled:opacity-50">{showForm ? copy.close : copy.connect}</button>}
    {showForm && <form onSubmit={submit} data-focus-id="payout-form" autoComplete="off" className="mt-6 space-y-6">
      <p className="rounded-xl bg-muted p-4 text-sm leading-6">{copy.reenter}</p>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-600">{copy.legal}<select name="businessType" required disabled={busy} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base"><option value="">—</option>{PAYOUT_BUSINESS_TYPES.map(t => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}</select></label>{input('contactName', copy.name)}{input('contactPan', copy.pan, { maxLength: 10, sensitive: true, onValue: checkPan, hint: panHint, help: 'The authorised person\u2019s own PAN, not the business\u2019s. Your business PAN is already on file from registration.' })}</div>
      {(['registered', 'residential'] as const).map(kind => <fieldset key={kind} className="rounded-xl border border-border p-4"><legend className="px-2 font-700">{kind === 'registered' ? copy.businessAddress : copy.address}</legend><div className="grid gap-4 sm:grid-cols-2">{input(kind === 'registered' ? 'registeredStreet' : 'street', copy.street)}{input(kind === 'registered' ? 'registeredCity' : 'city', copy.city)}{input(kind === 'registered' ? 'registeredState' : 'state', copy.state, { maxLength: 32 })}{input(kind === 'registered' ? 'registeredPincode' : 'pincode', copy.pin, { maxLength: 6, numeric: true, pattern: '[1-9][0-9]{5}' })}</div></fieldset>)}
      <div className="grid gap-4 sm:grid-cols-2">{input('accountName', copy.holder)}{input('ifsc', copy.ifsc, { maxLength: 11 })}{input('accountNumber', copy.account, { maxLength: 35, sensitive: true, numeric: true, pattern: '[0-9]{5,35}' })}{input('confirmAccountNumber', copy.confirm, { maxLength: 35, sensitive: true, numeric: true, pattern: '[0-9]{5,35}' })}</div>
      <label className="flex items-start gap-3 text-sm leading-6"><input name="termsAccepted" type="checkbox" required disabled={busy} className="mt-1 h-5 w-5 shrink-0" /><span>{copy.terms} <a href="https://razorpay.com/terms/" target="_blank" rel="noreferrer" className="underline">{copy.original}</a></span></label>
      <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-primary px-6 font-700 text-primary-foreground disabled:opacity-50">{busy ? copy.submitting : copy.submit}</button>
    </form>}
  </section>;
}
