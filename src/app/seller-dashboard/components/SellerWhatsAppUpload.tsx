'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { parseWhatsAppCatalog } from '@/lib/whatsappCatalog';

type ConnectionStatus = {
  configured: boolean;
  displayNumber: string | null;
  waNumber: string | null;
  pairingWindowMinutes: number;
  webhookPath: string;
};

type WhatsAppProduct = {
  id: string;
  name: string;
  sku: string;
  category: string;
  price_per_unit: number;
  unit: string;
  width_inches: number | null;
  work_type: string;
  image_url: string | null;
  approval_status: 'not_submitted' | 'pending' | 'approved' | 'rejected';
  status: 'draft' | 'active' | 'archived';
  created_at: string;
  admin_review_notes: string | null;
};

const template = `Navratri special

Fabric = vichitra silk
Width = 44
Work = mirror work
Rate = 240 per mtr`;

function approvalLabel(product: WhatsAppProduct) {
  if (product.approval_status === 'approved') return 'Approved';
  if (product.approval_status === 'rejected') return 'Needs changes';
  return 'Pending review';
}

export default function SellerWhatsAppUpload() {
  const { user, isDemoAccount } = useAuth();
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [products, setProducts] = useState<WhatsAppProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [sampleText, setSampleText] = useState(template);

  const parsedPreview = useMemo(() => parseWhatsAppCatalog(sampleText), [sampleText]);

  useEffect(() => {
    let cancelled = false;
    const loadConnection = async () => {
      try {
        const response = await fetch('/api/whatsapp/catalog/status', {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const payload = (await response.json().catch(() => ({}))) as Partial<ConnectionStatus>;
        if (!cancelled) {
          setConnection({
            configured: response.ok && payload.configured === true,
            displayNumber: payload.displayNumber || null,
            waNumber: payload.waNumber || null,
            pairingWindowMinutes: payload.pairingWindowMinutes || 15,
            webhookPath: payload.webhookPath || '/api/whatsapp/webhook',
          });
        }
      } catch {
        if (!cancelled) {
          setConnection({
            configured: false,
            displayNumber: null,
            waNumber: null,
            pairingWindowMinutes: 15,
            webhookPath: '/api/whatsapp/webhook',
          });
        }
      }
    };
    void loadConnection();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadProducts = useCallback(async () => {
    setError('');
    setLoadingProducts(true);

    if (isDemoAccount) {
      setProducts([]);
      setLoadingProducts(false);
      return;
    }
    if (!user?.id) {
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
        .select(
          'id,name,sku,category,price_per_unit,unit,width_inches,work_type,image_url,approval_status,status,created_at,admin_review_notes'
        )
        .eq('seller_id', seller.id)
        .eq('source', 'whatsapp')
        .order('created_at', { ascending: false })
        .limit(30);
      if (productsError) throw productsError;
      setProducts((data || []) as WhatsAppProduct[]);
    } catch (loadError) {
      setProducts([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load WhatsApp catalogue uploads.'
      );
    } finally {
      setLoadingProducts(false);
    }
  }, [isDemoAccount, user?.id]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const refreshProducts = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  const openWhatsApp = () => {
    if (!connection?.configured || !connection.waNumber) return;
    const text = encodeURIComponent(sampleText.trim() || template);
    window.open(`https://wa.me/${connection.waNumber}?text=${text}`, '_blank', 'noopener');
  };

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-800 uppercase tracking-[0.16em] text-primary">
          Connected catalogue intake
        </p>
        <h1 className="mt-1 text-xl font-800 text-foreground">WhatsApp Catalog Upload</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Send a clear fabric photo and its details to the connected FabricTrad WhatsApp Business
          number. The webhook pairs the messages, saves the image and creates a catalogue draft for
          review.
        </p>
      </div>

      <div
        className={`mb-6 rounded-2xl border p-5 ${
          connection === null
            ? 'border-border bg-card'
            : connection.configured
              ? 'border-success/25 bg-success/5'
              : 'border-error/25 bg-error/5'
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                connection?.configured ? 'bg-success text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              <Icon
                name={connection === null ? 'ArrowPathIcon' : 'ChatBubbleLeftRightIcon'}
                size={21}
                className={connection === null ? 'animate-spin' : ''}
              />
            </div>
            <div>
              <p className="text-sm font-800 text-foreground">
                {connection === null
                  ? 'Checking WhatsApp connection…'
                  : connection.configured
                    ? `FabricTrad Upload Bot · ${connection.displayNumber}`
                    : 'WhatsApp Business upload is not connected'}
              </p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                {connection?.configured
                  ? `Send the image with a caption, or send the image and text as separate messages within ${connection.pairingWindowMinutes} minutes.`
                  : 'The previous +91 98765… numbers were display placeholders and could not receive website webhooks. A real Meta WhatsApp Business number, access token and webhook subscription are required.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openWhatsApp}
            disabled={!connection?.configured || !connection.waNumber}
            className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="PaperAirplaneIcon" size={16} /> Open connected WhatsApp
          </button>
        </div>
      </div>

      {isDemoAccount && (
        <div className="mb-6 rounded-2xl border border-warning/30 bg-warning/5 p-4">
          <p className="flex items-center gap-2 text-sm font-800 text-foreground">
            <Icon name="ExclamationTriangleIcon" size={17} className="text-warning" /> Demo account
            limitation
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            The shared demo seller is not linked to a private WhatsApp number. External uploads are
            attached only to a real seller account whose verified FabricTrad phone matches the number
            sending the WhatsApp messages.
          </p>
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-800 text-foreground">
            <Icon name="DocumentTextIcon" size={17} className="text-primary" /> Message format
          </h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            The title can be the first line. Fabric and Rate are required. Width, Work, MOQ, Stock and
            GSM are optional. Attach at least one JPG, PNG or WebP photo.
          </p>
          <textarea
            value={sampleText}
            onChange={(event) => setSampleText(event.target.value)}
            rows={8}
            className="input-base mt-4 w-full resize-none rounded-xl px-4 py-3 font-mono text-sm"
          />
          <button
            type="button"
            onClick={openWhatsApp}
            disabled={!connection?.configured || !connection.waNumber || !parsedPreview}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-800 text-success disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="ChatBubbleLeftRightIcon" size={16} /> Send these details
          </button>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-800 text-foreground">
            <Icon name="CpuChipIcon" size={17} className="text-secondary" /> Parsed preview
          </h2>
          {parsedPreview ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ['Product', parsedPreview.name],
                ['Category', parsedPreview.category],
                ['Price', `₹${parsedPreview.pricePerUnit}/${parsedPreview.unit}`],
                ['Width', parsedPreview.widthInches ? `${parsedPreview.widthInches} inches` : 'Not provided'],
                ['Work', parsedPreview.workType],
                ['Status', 'Draft · Pending review'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-muted p-3">
                  <p className="text-[10px] font-800 uppercase tracking-wider text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-1 text-xs font-800 text-foreground">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-error/20 bg-error/5 p-4 text-xs leading-5 text-error">
              Add both a Fabric value and a positive Rate. Example: Fabric = vichitra silk and Rate =
              240 per mtr.
            </div>
          )}
          <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
            <span className="font-800 text-foreground">How pairing works:</span> an image caption is
            processed immediately. When the photo and details are separate messages, the system finds
            the matching messages from the same sender within the connection window and uploads them
            as one product.
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-800 text-foreground">Real WhatsApp uploads</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              These records come from your seller inventory, not hard-coded demonstration cards.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshProducts()}
            disabled={refreshing || loadingProducts || isDemoAccount}
            className="btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs disabled:opacity-50"
          >
            <Icon
              name="ArrowPathIcon"
              size={15}
              className={refreshing ? 'animate-spin' : ''}
            />
            Refresh uploads
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-error/20 bg-error/5 p-3 text-xs text-error">
            {error}
          </div>
        )}

        {loadingProducts ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading catalogue drafts…
          </div>
        ) : products.length ? (
          <div className="mt-5 space-y-3">
            {products.map((product) => (
              <article
                key={product.id}
                className="flex flex-col gap-4 rounded-xl border border-border p-4 sm:flex-row sm:items-start"
              >
                <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:w-24">
                  {product.image_url ? (
                    <AppImage
                      src={product.image_url}
                      alt={`${product.name} WhatsApp catalogue upload`}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Icon name="PhotoIcon" size={24} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-800 text-foreground">{product.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {product.sku} · {product.category} · {product.work_type}
                      </p>
                    </div>
                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-800 ${
                        product.approval_status === 'approved'
                          ? 'bg-success/10 text-success'
                          : product.approval_status === 'rejected'
                            ? 'bg-error/10 text-error'
                            : 'bg-warning/10 text-warning'
                      }`}
                    >
                      {approvalLabel(product)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-muted px-2.5 py-1 font-800 text-foreground">
                      ₹{Number(product.price_per_unit).toLocaleString('en-IN')}/{product.unit}
                    </span>
                    {product.width_inches && (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                        {product.width_inches} inches
                      </span>
                    )}
                    <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                      Added {new Date(product.created_at).toLocaleString('en-IN')}
                    </span>
                  </div>
                  {product.admin_review_notes && (
                    <p className="mt-3 rounded-lg bg-error/5 p-2 text-xs text-error">
                      {product.admin_review_notes}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-border py-12 text-center">
            <Icon name="PhotoIcon" size={28} className="mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm font-800 text-foreground">No WhatsApp catalogue drafts yet</p>
            <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-muted-foreground">
              Once the connection is configured, send from the same verified phone number saved on
              your seller account. A successful upload receives a WhatsApp confirmation and appears
              here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
