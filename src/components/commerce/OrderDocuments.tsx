'use client';

import { useState } from 'react';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';

type Document = { id: string; invoice_number: string; document_type: string; total_amount: number; email_status: string; status: string };
const copy = {
  en: { title: 'Receipts & invoices', loading: 'Loading documents…', empty: 'Documents appear after verified payment capture. Contact FabricTrad if a paid order has no document.', open: 'Open / save PDF', receipt: 'Payment receipt', invoice: 'Tax invoice', supply: 'Bill of supply', retry: 'Refresh', generate: 'Generate / retry email', error: 'Documents could not be loaded.', submitted: 'Email submitted', pending: 'Email pending', void: 'Void' },
  hi: { title: 'रसीदें और चालान', loading: 'दस्तावेज़ लोड हो रहे हैं…', empty: 'भुगतान की पुष्टि के बाद दस्तावेज़ यहाँ दिखेंगे। भुगतान के बाद दस्तावेज़ न मिले तो FabricTrad से संपर्क करें।', open: 'खोलें / PDF सहेजें', receipt: 'भुगतान रसीद', invoice: 'कर चालान', supply: 'आपूर्ति बिल', retry: 'फिर से लोड करें', generate: 'बनाएँ / ईमेल फिर भेजें', error: 'दस्तावेज़ लोड नहीं हुए।', submitted: 'ईमेल भेजने के लिए जमा', pending: 'ईमेल लंबित', void: 'रद्द' },
  gu: { title: 'રસીદો અને ઇન્વૉઇસ', loading: 'દસ્તાવેજો લોડ થઈ રહ્યા છે…', empty: 'ચુકવણીની પુષ્ટિ પછી દસ્તાવેજો અહીં દેખાશે. ચૂકવેલા ઑર્ડરનો દસ્તાવેજ ન મળે તો FabricTradનો સંપર્ક કરો.', open: 'ખોલો / PDF સાચવો', receipt: 'ચુકવણીની રસીદ', invoice: 'ટેક્સ ઇન્વૉઇસ', supply: 'સપ્લાય બિલ', retry: 'ફરી લોડ કરો', generate: 'બનાવો / ઈમેલ ફરી મોકલો', error: 'દસ્તાવેજો લોડ થયા નથી.', submitted: 'ઈમેલ મોકલવા માટે સબમિટ', pending: 'ઈમેલ બાકી', void: 'રદ' },
};

export default function OrderDocuments({ kind, orderId, admin = false }: { kind: 'catalog' | 'bulk' | 'bespoke'; orderId: string; admin?: boolean }) {
  const { language } = useAppPreferences();
  const t = copy[language as keyof typeof copy] || copy.en;
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const load = async () => {
    setLoading(true); setMessage('');
    try {
      const response = await fetch(`/api/seller/invoices?${kind === 'catalog' ? 'catalogOrderId' : kind === 'bulk' ? 'bulkOrderId' : 'bespokeOrderId'}=${encodeURIComponent(orderId)}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(t.error);
      setDocuments(body.invoices || []); setLoaded(true);
    } catch { setMessage(t.error); }
    finally { setLoading(false); }
  };
  const regenerate = async () => {
    setLoading(true); setMessage('');
    try {
      const response = await fetch('/api/admin/orders/invoice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, orderId }) });
      const body = await response.json();
      await load();
      setMessage(body.error || body.message || t.error);
    } catch { setMessage(t.error); }
    finally { setLoading(false); }
  };
  return <details className="mt-4 rounded-2xl border border-border bg-card p-4" onToggle={event => { if (event.currentTarget.open && !loaded && !loading) void load(); }}>
    <summary className="cursor-pointer text-sm font-800 text-foreground">{t.title}</summary>
    <div className="mt-3 space-y-3">
      {loading && <p role="status" className="text-xs text-muted-foreground">{t.loading}</p>}
      {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
      {loaded && !documents.length && <p className="text-xs text-muted-foreground">{t.empty}</p>}
      {documents.map(doc => <div key={doc.id} className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><p className="break-words text-sm font-700">{doc.document_type === 'payment_receipt' ? t.receipt : doc.document_type === 'bill_of_supply' ? t.supply : t.invoice} · {doc.invoice_number}</p>
          <p className="text-xs text-muted-foreground">₹{Number(doc.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} · {doc.status === 'void' ? t.void : doc.email_status === 'sent' ? t.submitted : t.pending}</p></div>
        <a href={`/api/invoices/${encodeURIComponent(doc.id)}`} target="_blank" rel="noopener noreferrer" className="btn-secondary shrink-0 px-3 py-2 text-xs">{t.open}</a>
      </div>)}
      <div className="flex flex-wrap gap-2"><button disabled={loading} onClick={() => void load()} className="btn-secondary px-3 py-2 text-xs">{t.retry}</button>
        {admin && <button disabled={loading} onClick={() => void regenerate()} className="btn-primary px-3 py-2 text-xs">{t.generate}</button>}</div>
    </div>
  </details>;
}
