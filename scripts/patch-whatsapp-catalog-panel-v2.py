from pathlib import Path
import re

path = Path('src/app/seller-dashboard/components/WhatsAppCatalogPanel.tsx')
text = path.read_text()


def replace_once(old: str, new: str, label: str):
    global text
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'Could not patch {label}')
    text = text.replace(old, new, 1)


def regex_once(pattern: str, replacement: str, label: str, marker: str):
    global text
    if marker in text:
        return
    next_text, count = re.subn(pattern, lambda _: replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'Could not patch {label}; matches={count}')
    text = next_text

replace_once(
"""type ParsedDraft = {
  name?: string;
  category?: string;
  pricePerUnit?: number;
  availableQuantity?: number;
  unit?: string;
  moq?: number;
  variants?: ParsedVariant[];
};""",
"""type ParsedDraft = {
  name?: string;
  sku?: string;
  category?: string;
  price?: number;
  pricePerUnit?: number;
  available?: number;
  availableQuantity?: number;
  unit?: string;
  moq?: number;
  status?: string;
  variants?: ParsedVariant[];
};

type SellerIdentityPayload = {
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  whatsappNo?: string;
  ready?: boolean;
  error?: string;
};""",
'ParsedDraft type',
)

money_anchor = """const money = (value: unknown) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0
    ? `₹${amount.toLocaleString('en-IN')}`
    : 'Rate pending';
};
"""
format_block = money_anchor + """
const SELLER_FORMAT = `REQUIRED
name =
sku =
category =
price =
unit = mtr
available =
moq =
sale_channel = b2b | retail | both

OPTIONAL
description =
min_stock = 0
gsm =
width =
work_type = Plain
image_url =
dispatch_days = 3
origin_city =
origin_state =
status = draft
retail_store_min_quantity =
retail_store_max_quantity =
end_user_min_quantity =
end_user_max_quantity =`;
"""
replace_once(money_anchor, format_block, 'strict seller format constant')

replace_once(
"""  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');""",
"""  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [identity, setIdentity] = useState<SellerIdentityPayload | null>(null);
  const [identityForm, setIdentityForm] = useState({ contactName: '', contactEmail: '', contactPhone: '', whatsappNo: '' });
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityMessage, setIdentityMessage] = useState('');""",
'identity state',
)

replace_once(
"""      const [statusResponse, inboxResponse] = await Promise.all([
        fetch('/api/whatsapp/status', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/whatsapp/catalog-inbox', { cache: 'no-store', credentials: 'same-origin' }),
      ]);""",
"""      const [statusResponse, inboxResponse, identityResponse] = await Promise.all([
        fetch('/api/whatsapp/status', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/whatsapp/catalog-inbox', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/seller/contact-identity', { cache: 'no-store', credentials: 'same-origin' }),
      ]);""",
'identity load request',
)

replace_once(
"""      const inboxPayload = (await inboxResponse.json().catch(() => ({}))) as {
        items?: InboxItem[];
        error?: string;
      };
      setStatus(statusPayload);""",
"""      const inboxPayload = (await inboxResponse.json().catch(() => ({}))) as {
        items?: InboxItem[];
        error?: string;
      };
      const identityPayload = (await identityResponse.json().catch(() => ({}))) as SellerIdentityPayload;
      setStatus(statusPayload);
      if (identityResponse.ok) {
        setIdentity(identityPayload);
        setIdentityForm({
          contactName: identityPayload.contactName || '',
          contactEmail: identityPayload.contactEmail || '',
          contactPhone: identityPayload.contactPhone || '',
          whatsappNo: identityPayload.whatsappNo || '',
        });
      }""",
'identity response hydration',
)

whatsapp_block = """  const whatsappUrl = useMemo(() => {
    const number = status?.businessNumber?.replace(/\D/g, '');
    if (!number || !identity?.ready) return null;
    return `https://wa.me/${number}?text=${encodeURIComponent('FORMAT')}`;
  }, [status?.businessNumber, identity?.ready]);

  const saveIdentity = async () => {
    setIdentitySaving(true);
    setIdentityMessage('');
    try {
      const response = await fetch('/api/seller/contact-identity', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(identityForm),
      });
      const payload = (await response.json().catch(() => ({}))) as SellerIdentityPayload;
      if (!response.ok) {
        setIdentityMessage(payload.error || 'Seller WhatsApp identity could not be saved.');
        return;
      }
      setIdentity(payload);
      setIdentityMessage('Saved. Only this seller WhatsApp number can add products to this store.');
    } catch {
      setIdentityMessage('Seller WhatsApp identity could not be saved.');
    } finally {
      setIdentitySaving(false);
    }
  };"""
regex_once(
    r"  const whatsappUrl = useMemo\(\(\) => \{.*?\n  \}, \[status\?\.businessNumber\]\);",
    whatsapp_block,
    'WhatsApp FORMAT deeplink',
    'const saveIdentity = async () =>',
)

replace_once(
"""            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm">
              Send a product description, photos or a short reel from the mobile number linked to your seller account. Keep “SELLER CATALOG UPLOAD” at the start so a dual-role account is routed to seller mode, then FabricTrad receives it privately and organises the details here.
            </p>""",
"""            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm">
              Register a dedicated seller WhatsApp below. That exact number gets seller-catalog priority, even on a dual-workspace login. Send FORMAT first, then one product's strict field template plus its photos/videos. Valid products are added directly to your store and remain editable in Products.
            </p>""",
'panel explanation',
)

replace_once(
"""              <Icon name="PaperAirplaneIcon" size={16} /> Send product on WhatsApp""",
"""              <Icon name="PaperAirplaneIcon" size={16} /> Open WhatsApp with FORMAT""",
'WhatsApp button label',
)

replace_once(
"""              Meta business number not connected yet""",
"""              {status?.businessNumber ? 'Save seller WhatsApp identity first' : 'Gupshup business number not connected yet'}""",
'disabled WhatsApp explanation',
)

identity_section = """      <div className="border-b border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-800 uppercase tracking-[0.14em] text-[#128C7E]">Seller identity for WhatsApp catalogue</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Seller name, email, phone and WhatsApp must be different from buyer/account identity. FabricTrad rejects duplicates at the API and database levels.
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-800 text-foreground">Seller name<input value={identityForm.contactName} onChange={(e) => setIdentityForm((v) => ({ ...v, contactName: e.target.value }))} className="input-base mt-1.5 w-full px-3 py-2.5 font-400" placeholder="Seller contact/display name" /></label>
          <label className="text-xs font-800 text-foreground">Seller email<input type="email" value={identityForm.contactEmail} onChange={(e) => setIdentityForm((v) => ({ ...v, contactEmail: e.target.value }))} className="input-base mt-1.5 w-full px-3 py-2.5 font-400" placeholder="seller@business.com" /></label>
          <label className="text-xs font-800 text-foreground">Seller phone<input inputMode="numeric" value={identityForm.contactPhone} onChange={(e) => setIdentityForm((v) => ({ ...v, contactPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="input-base mt-1.5 w-full px-3 py-2.5 font-mono font-400" placeholder="10 digit seller phone" /></label>
          <label className="text-xs font-800 text-foreground">Seller WhatsApp<input inputMode="numeric" value={identityForm.whatsappNo} onChange={(e) => setIdentityForm((v) => ({ ...v, whatsappNo: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="input-base mt-1.5 w-full px-3 py-2.5 font-mono font-400" placeholder="WhatsApp used to upload products" /></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void saveIdentity()} disabled={identitySaving} className="inline-flex min-h-10 items-center rounded-xl bg-foreground px-4 text-xs font-800 text-background disabled:opacity-60">
            {identitySaving ? 'Saving…' : identity?.ready ? 'Update seller WhatsApp identity' : 'Save seller WhatsApp identity'}
          </button>
          {identityMessage && <p className={`text-xs font-700 ${identityMessage.startsWith('Saved') ? 'text-emerald-700' : 'text-error'}`}>{identityMessage}</p>}
        </div>

        <details className="mt-4 rounded-xl border border-border bg-muted/20 p-3">
          <summary className="cursor-pointer text-xs font-800 text-foreground">Predefined product format — required & optional fields</summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-[11px] leading-5 text-slate-100">{SELLER_FORMAT}</pre>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Photos/videos sent for the product are attached automatically, so image_url is optional. Use NEW PRODUCT before the next item. Duplicate SKU values are never auto-created.</p>
        </details>
      </div>
"""
if 'Seller identity for WhatsApp catalogue' not in text:
    anchor = "      {!status?.channelReady && ("
    if anchor not in text:
        raise SystemExit('Could not locate seller WhatsApp identity insertion point')
    text = text.replace(anchor, identity_section + "\n" + anchor, 1)

replace_once(
"""              Once the official number is connected, a seller message from the same mobile number as their FabricTrad profile will be matched to that seller automatically.""",
"""              Save a dedicated seller WhatsApp identity above, open WhatsApp with FORMAT, then send one product's required fields and its photos. FabricTrad will validate and add the product to this store automatically.""",
'empty inbox guidance',
)

replace_once(
"""                            ['Rate', `${money(draft.pricePerUnit)}${draft.unit ? `/${draft.unit}` : ''}`],
                            ['Stock', draft.availableQuantity ? `${draft.availableQuantity} ${draft.unit || ''}` : 'Pending'],""",
"""                            ['Rate', `${money(draft.price ?? draft.pricePerUnit)}${draft.unit ? `/${draft.unit}` : ''}`],
                            ['Stock', (draft.available ?? draft.availableQuantity) !== undefined ? `${draft.available ?? draft.availableQuantity} ${draft.unit || ''}` : 'Pending'],""",
'inbox price and stock compatibility',
)

path.write_text(text)
print('Seller dashboard WhatsApp panel now manages dedicated identity and strict format.')
