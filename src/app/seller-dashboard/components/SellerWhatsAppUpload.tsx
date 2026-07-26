'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { parseWhatsAppCatalog } from '@/lib/whatsappCatalog';
import {
  OFFICIAL_WHATSAPP_DISPLAY_NUMBER,
  OFFICIAL_WHATSAPP_WA_NUMBER,
} from '@/lib/whatsappConfig';

type ConnectionStatus = {
  configured: boolean;
  displayNumber: string | null;
  waNumber: string | null;
  pairingWindowMinutes: number;
  webhookPath: string;
};

type VariantSummary = {
  id?: string;
  color?: string;
  colorHex?: string | null;
  design?: string;
  price?: number;
  unit?: string;
  available?: number;
  image?: string | null;
};

type WhatsAppProduct = {
  id: string;
  name: string;
  sku: string;
  category: string;
  price_per_unit: number;
  unit: string;
  available_quantity: number;
  width_inches: number | null;
  work_type: string;
  image_url: string | null;
  variant_count: number;
  variant_colors: string[];
  variant_summary: VariantSummary[];
  approval_status: string;
  status: string;
  created_at: string;
};

const template = `Catalog = Navratri Vichitra Silk
Fabric = vichitra silk
Width = 44
Work = mirror work
Rate = 240 per mtr
MOQ = 3

Color = Blue
Stock = 9 mtr
Rate = 240 per mtr
Design = mirror dots

Color = Pink
Stock = 14 mtr
Rate = 250 per mtr
Design = mirror border

Color = Yellow
Stock = 11 mtr
Rate = 245 per mtr
Design = all-over mirror`;

export default function SellerWhatsAppUpload() {
  const { user, profile, isDemoAccount } = useAuth();
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [products, setProducts] = useState<WhatsAppProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [sampleText, setSampleText] = useState(template);

  const parsedPreview = useMemo(() => parseWhatsAppCatalog(sampleText), [sampleText]);
  const accountPhone = useMemo(() => {
    if (isDemoAccount || !profile?.phone_verified || !profile.phone) return null;
    const digits = profile.phone.replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) return profile.phone;
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }, [isDemoAccount, profile?.phone, profile?.phone_verified]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/whatsapp/catalog/status', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as Partial<ConnectionStatus>;
        if (!cancelled) {
          setConnection({
            configured: response.ok && payload.configured === true,
            displayNumber: payload.displayNumber || OFFICIAL_WHATSAPP_DISPLAY_NUMBER,
            waNumber: payload.waNumber || OFFICIAL_WHATSAPP_WA_NUMBER,
            pairingWindowMinutes: payload.pairingWindowMinutes || 15,
            webhookPath: payload.webhookPath || '/api/whatsapp/webhook',
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConnection({
            configured: false,
            displayNumber: OFFICIAL_WHATSAPP_DISPLAY_NUMBER,
            waNumber: OFFICIAL_WHATSAPP_WA_NUMBER,
            pairingWindowMinutes: 15,
            webhookPath: '/api/whatsapp/webhook',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadProducts = useCallback(async () => {
    setError('');
    setLoadingProducts(true);
    if (isDemoAccount || !user?.id) {
      setProducts([]);
      setLoadingProducts(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data: seller, error: sellerError } = await supabase
        .from('seller_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (sellerError) throw sellerError;
      if (!seller?.id) throw new Error('Complete your seller registration before using WhatsApp upload.');

      const { data, error: productsError } = await supabase
        .from('seller_products')
        .select('id,name,sku,category,price_per_unit,unit,available_quantity,width_inches,work_type,image_url,variant_count,variant_colors,variant_summary,approval_status,status,created_at')
        .eq('seller_id', seller.id)
        .eq('source', 'whatsapp')
        .order('updated_at', { ascending: false })
        .limit(30);
      if (productsError) throw productsError;
      setProducts((data || []) as WhatsAppProduct[]);
    } catch (loadError) {
      setProducts([]);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load WhatsApp catalogue uploads.');
    } finally {
      setLoadingProducts(false);
    }
  }, [isDemoAccount, user?.id]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const openWhatsApp = () => {
    if (!connection?.waNumber) return;
    window.open(`https://wa.me/${connection.waNumber}?text=${encodeURIComponent(sampleText.trim() || template)}`, '_blank', 'noopener');
  };

  const refreshProducts = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-800 uppercase tracking-[0.16em] text-primary">Connected catalogue intake</p>
        <h1 className="mt-1 text-xl font-800 text-foreground">WhatsApp multi-variant catalogue</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          One fabric becomes the parent product. Every colour or design becomes its own variation with
          separate stock, rate, description and photos.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-success/25 bg-success/5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success text-white">
              <Icon name={connection === null ? 'ArrowPathIcon' : 'ChatBubbleLeftRightIcon'} size={21} className={connection === null ? 'animate-spin' : ''} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-800 text-foreground">Official FabricTrad catalogue WhatsApp</p>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-800 ${connection?.configured ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                  {connection === null ? 'Checking automation…' : connection.configured ? 'Automatic sync active' : 'Official number · automation setup pending'}
                </span>
              </div>
              <p className="mt-1 text-lg font-800 text-success">
                {connection?.displayNumber || OFFICIAL_WHATSAPP_DISPLAY_NUMBER}
              </p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                Send the parent fabric details, colour/design blocks and photos to this number from the
                same WhatsApp number verified on your FabricTrad seller account.
              </p>
              {connection !== null && !connection.configured && (
                <p className="mt-1 text-xs leading-5 text-warning">
                  The official chat link is available. Automatic website publishing will activate as soon
                  as the Meta webhook credentials and database connection are completed.
                </p>
              )}
            </div>
          </div>
          <button type="button" onClick={openWhatsApp} disabled={!connection?.waNumber} className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50">
            <Icon name="PaperAirplaneIcon" size={16} /> Open WhatsApp
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon name="ShieldCheckIcon" size={18} />
          </div>
          <div>
            <p className="text-sm font-800 text-foreground">Catalogue ownership is automatic</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              When anyone sends catalogue information to {connection?.displayNumber || OFFICIAL_WHATSAPP_DISPLAY_NUMBER},
              FabricTrad matches the sender&apos;s WhatsApp number with the verified phone number on a seller
              account. The complete parent fabric and all its colour/design variations are added only to
              that matched seller&apos;s dashboard and customer catalogue.
            </p>
            <p className="mt-2 text-xs font-800 text-primary">
              Your account match: {accountPhone || 'verify your own seller phone number before sending'}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-800 text-foreground">
            <Icon name="DocumentTextIcon" size={17} className="text-primary" /> Parent and variation format
          </h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Fabric and Rate are required. Start each variation with Color. Add Stock, Rate, Design,
            MOQ and details beneath it. Decimal metre values are supported.
          </p>
          <textarea value={sampleText} onChange={(event) => setSampleText(event.target.value)} rows={18} className="input-base mt-4 w-full resize-y rounded-xl px-4 py-3 font-mono text-sm" />
          <button type="button" onClick={openWhatsApp} disabled={!connection?.waNumber || !parsedPreview} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-800 text-success disabled:opacity-50">
            <Icon name="ChatBubbleLeftRightIcon" size={16} /> Send this catalogue text
          </button>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-800 text-foreground">
            <Icon name="CpuChipIcon" size={17} className="text-secondary" /> Parsed catalogue preview
          </h2>
          {parsedPreview ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ['Parent fabric', parsedPreview.name],
                  ['Category', parsedPreview.category],
                  ['Width', parsedPreview.widthInches ? `${parsedPreview.widthInches} inches` : 'Not provided'],
                  ['Variations', `${parsedPreview.variants.length}`],
                  ['Total stock', `${parsedPreview.availableQuantity} ${parsedPreview.unit}`],
                  ['Starting rate', `₹${parsedPreview.pricePerUnit}/${parsedPreview.unit}`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-muted p-3">
                    <p className="text-[10px] font-800 uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="mt-1 text-xs font-800 text-foreground">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                {parsedPreview.variants.map((variant, index) => (
                  <div key={`${variant.colorName}-${index}`} className="rounded-xl border border-border p-3">
                    <div className="flex items-start gap-2.5">
                      <span className="h-7 w-7 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: variant.colorHex || '#d1d5db' }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-800 text-foreground">{variant.colorName}</p>
                            <p className="text-xs text-muted-foreground">{variant.designName}</p>
                          </div>
                          <p className="text-xs font-800 text-primary">₹{variant.pricePerUnit}/{variant.unit}</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{variant.availableQuantity} {variant.unit} available · MOQ {variant.moq}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-xl border border-error/20 bg-error/5 p-4 text-xs leading-5 text-error">
              Include a Fabric value and a positive Rate. Add each variation using Color and Stock.
            </div>
          )}

          <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
            <p className="font-800 text-foreground">Photo options</p>
            <p className="mt-1">Best: send each colour photo with a caption such as “Color = Blue”.</p>
            <p>Also supported: send all photos immediately after the text; unlabelled photos are matched to the colour blocks in order.</p>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-800 text-foreground">Published WhatsApp catalogues</h2>
            <p className="mt-1 text-xs text-muted-foreground">Parent fabrics and their colour/design inventory are live in the customer marketplace.</p>
          </div>
          <button type="button" onClick={() => void refreshProducts()} disabled={refreshing || loadingProducts || isDemoAccount} className="btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs disabled:opacity-50">
            <Icon name="ArrowPathIcon" size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {error && <div className="mt-4 rounded-xl border border-error/20 bg-error/5 p-3 text-xs text-error">{error}</div>}

        {loadingProducts ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground"><span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />Loading catalogues…</div>
        ) : products.length ? (
          <div className="mt-5 space-y-4">
            {products.map((product) => (
              <article key={product.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:w-32">
                    {product.image_url ? <AppImage src={product.image_url} alt={product.name} fill sizes="128px" className="object-cover" /> : <div className="flex h-full items-center justify-center"><Icon name="PhotoIcon" size={28} className="text-muted-foreground" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-base font-800 text-foreground">{product.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{product.sku} · {product.category} · {product.width_inches || '—'} inches</p>
                      </div>
                      <span className="w-fit rounded-full bg-success/10 px-3 py-1 text-xs font-800 text-success">Published</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-primary/10 px-3 py-1 font-800 text-primary">{product.variant_count || 0} variations</span>
                      <span className="rounded-full bg-muted px-3 py-1">{Number(product.available_quantity || 0).toLocaleString('en-IN')} {product.unit} total</span>
                      <span className="rounded-full bg-muted px-3 py-1">From ₹{Number(product.price_per_unit || 0).toLocaleString('en-IN')}/{product.unit}</span>
                    </div>
                  </div>
                </div>
                {!!product.variant_summary?.length && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {product.variant_summary.map((variant, index) => (
                      <div key={variant.id || index} className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
                        {variant.image ? (
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg"><AppImage src={variant.image} alt={variant.color || 'Variant'} fill sizes="48px" className="object-cover" /></div>
                        ) : (
                          <span className="h-8 w-8 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: variant.colorHex || '#d1d5db' }} />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-xs font-800 text-foreground">{variant.color || 'Assorted'} · {variant.design || 'Standard'}</p>
                          <p className="text-xs text-muted-foreground">{Number(variant.available || 0)} {variant.unit || product.unit} · ₹{Number(variant.price || 0)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-border py-12 text-center">
            <Icon name="SwatchIcon" size={28} className="mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm font-800 text-foreground">No WhatsApp catalogues yet</p>
            <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-muted-foreground">Send the parent fabric details and colour blocks from the verified phone number on your seller account.</p>
          </div>
        )}
      </section>
    </div>
  );
}
