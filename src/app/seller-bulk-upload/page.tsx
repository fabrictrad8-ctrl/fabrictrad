'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

const CSV_HEADERS = [
  'name',
  'sku',
  'category',
  'description',
  'price',
  'unit',
  'available',
  'min_stock',
  'moq',
  'gsm',
  'width',
  'work_type',
  'image_url',
  'dispatch_days',
  'origin_city',
  'origin_state',
  'status',
  'sale_channel',
  'retail_store_min_quantity',
  'retail_store_max_quantity',
  'end_user_min_quantity',
  'end_user_max_quantity',
] as const;

const EXAMPLE_ROW = [
  'Premium Cotton Poplin',
  'COT-POP-001',
  'Cotton',
  '60s cotton poplin, solid white',
  '185',
  'metre',
  '250',
  '20',
  '10',
  '120',
  '58',
  'Plain',
  'https://example.com/products/cot-pop-001.jpg',
  '3',
  'Mumbai',
  'Maharashtra',
  'draft',
  'both',
  '10',
  '100',
  '1',
  '5',
];

const REQUIRED = new Set(['name', 'sku', 'price', 'available', 'moq']);

function csvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function templateCsv() {
  return `${CSV_HEADERS.join(',')}\n${EXAMPLE_ROW.map(csvCell).join(',')}\n`;
}

type ImportError = { row: number; sku: string; message: string };
type ImportResult = {
  imported: number;
  rejected: number;
  total?: number;
  errors: ImportError[];
  message?: string;
};

export default function SellerBulkUploadPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?role=seller');
      return;
    }
    if (profile && !(profile.can_sell ?? profile.role === 'seller')) {
      router.replace('/seller-registration');
    }
  }, [loading, profile, router, user]);

  const canUpload = Boolean(user && profile && (profile.can_sell ?? profile.role === 'seller'));
  const fileSummary = useMemo(() => {
    if (!file) return '';
    return `${file.name} · ${(file.size / 1024).toFixed(Math.max(file.size < 10240 ? 1 : 0, 0))} KB`;
  }, [file]);

  const downloadTemplate = () => {
    const blob = new Blob([templateCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'fabrictrad-product-import-template.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null;
    event.target.value = '';
    setResult(null);
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      toast.error('Choose a .csv file.');
      return;
    }
    if (selected.size > 2 * 1024 * 1024) {
      toast.error('CSV files can be up to 2 MB.');
      return;
    }
    setFile(selected);
  };

  const upload = async () => {
    if (!file || !canUpload || uploading) return;
    setUploading(true);
    setResult(null);
    try {
      const text = await file.text();
      const response = await fetch('/api/seller/products/bulk', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
        body: text,
      });
      const payload = await response.json().catch(() => ({}));
      const nextResult: ImportResult = {
        imported: Number(payload.imported || 0),
        rejected: Number(payload.rejected || 0),
        total: typeof payload.total === 'number' ? payload.total : undefined,
        errors: Array.isArray(payload.errors) ? payload.errors : [],
        message: typeof payload.message === 'string' ? payload.message : undefined,
      };
      setResult(nextResult);
      if (!response.ok) throw new Error(payload.error || 'CSV import failed.');
      if (nextResult.rejected) toast.success(`${nextResult.imported} imported. ${nextResult.rejected} rows need correction.`);
      else toast.success(`${nextResult.imported} products imported successfully.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'CSV import failed.');
    } finally {
      setUploading(false);
    }
  };

  if (loading || (user && !profile)) {
    return (
      <main className="ft-shell flex min-h-screen items-center justify-center px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  if (!canUpload) return null;

  return (
    <main className="ft-shell min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size={36} />
            <div>
              <p className="ft-route-kicker">Seller portal · Products</p>
              <h1 className="text-2xl font-850 tracking-tight text-foreground">Bulk product CSV import</h1>
            </div>
          </div>
          <Link href="/seller-dashboard?tab=inventory" className="ft-secondary-action inline-flex items-center justify-center gap-2 px-4 py-2 text-sm">
            <Icon name="ArrowLeftIcon" size={16} /> Back to products
          </Link>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="ft-card p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon name="TableCellsIcon" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-850 text-foreground">1. Download the FabricTrad template</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Keep the header names unchanged. One row equals one product. The example row can be replaced or deleted.</p>
              </div>
            </div>
            <button type="button" onClick={downloadTemplate} className="ft-secondary-action mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm">
              <Icon name="ArrowDownTrayIcon" size={16} /> Download CSV template
            </button>

            <div className="my-6 border-t border-border" />

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon name="ArrowUpTrayIcon" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-850 text-foreground">2. Upload the completed CSV</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Maximum 500 product rows and 2 MB per import. Existing products with the same seller SKU are updated rather than duplicated.</p>
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 px-4 py-10 text-center transition hover:border-primary/50 hover:bg-primary/5">
              <Icon name="DocumentArrowUpIcon" size={30} className="text-primary" />
              <span className="mt-3 text-sm font-850 text-foreground">Choose CSV file</span>
              <span className="mt-1 text-xs text-muted-foreground">CSV UTF-8 recommended</span>
              <input type="file" accept=".csv,text/csv" onChange={chooseFile} className="hidden" />
            </label>

            {file && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-800 text-foreground">{fileSummary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Ready for server-side validation.</p>
                </div>
                <button type="button" onClick={() => void upload()} disabled={uploading} className="ft-primary-action inline-flex items-center justify-center gap-2 px-4 py-2 text-sm disabled:opacity-60">
                  <Icon name={uploading ? 'ArrowPathIcon' : 'CloudArrowUpIcon'} size={16} className={uploading ? 'animate-spin' : ''} />
                  {uploading ? 'Importing…' : 'Import products'}
                </button>
              </div>
            )}
          </section>

          <aside className="ft-card p-5 sm:p-6">
            <h2 className="text-lg font-850 text-foreground">CSV field guide</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Required:</strong> name, sku, price, available, moq. All other columns can be blank and FabricTrad applies safe defaults.</p>
            <div className="mt-4 max-h-[460px] overflow-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted"><tr><th className="px-3 py-2 text-left">Column</th><th className="px-3 py-2 text-left">Rule</th></tr></thead>
                <tbody>
                  {CSV_HEADERS.map((header) => (
                    <tr key={header} className="border-t border-border first:border-t-0">
                      <td className="px-3 py-2 font-mono font-750 text-foreground">{header}{REQUIRED.has(header) ? ' *' : ''}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {header === 'status' ? 'draft, active, archived' :
                          header === 'sale_channel' ? 'b2b, retail, both' :
                          header === 'image_url' ? 'Public http/https image URL or blank' :
                          header === 'unit' ? 'metre, yard, kg, farma, piece, roll, or custom text' :
                          header.includes('max_quantity') ? 'Number ≥ matching minimum, or blank' :
                          header === 'price' ? 'Number > 0' :
                          header === 'available' || header === 'min_stock' ? 'Number ≥ 0' :
                          header === 'moq' ? 'Number ≥ 1' :
                          header === 'dispatch_days' ? 'Whole number ≥ 0' :
                          'Text or number as appropriate'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </aside>
        </div>

        {result && (
          <section className="ft-card mt-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div><p className="text-xs font-750 uppercase tracking-wider text-muted-foreground">Import result</p><h2 className="mt-1 text-xl font-850 text-foreground">{result.imported} imported · {result.rejected} rejected</h2></div>
              {result.imported > 0 && <Link href="/seller-dashboard?tab=inventory" className="ft-primary-action ml-auto inline-flex px-4 py-2 text-sm">View products</Link>}
            </div>
            {result.errors.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-xl border border-error/20">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-error/5"><tr><th className="px-3 py-2 text-left">CSV row</th><th className="px-3 py-2 text-left">SKU</th><th className="px-3 py-2 text-left">What to fix</th></tr></thead>
                  <tbody>{result.errors.map((item) => <tr key={`${item.row}-${item.sku}`} className="border-t border-border"><td className="px-3 py-2">{item.row}</td><td className="px-3 py-2 font-mono">{item.sku || '—'}</td><td className="px-3 py-2 text-error">{item.message}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
