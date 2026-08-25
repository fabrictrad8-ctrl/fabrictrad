'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type DisputeType =
  | 'return_request'
  | 'exchange_request' |'refund_request' |'damage_claim' |'quality_issue' |'delivery_issue' |'general_query';
type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'escalated' | 'closed';
type OrderKind = 'catalog' | 'bulk';
type Evidence = { file: File; type: 'image' | 'document' | 'video' };

type OrderOption = {
  value: string;
  kind: OrderKind;
  id: string;
  reference: string;
  sellerId: string;
  product: string;
  total: number;
};
type Message = {
  id: string;
  dispute_id: string;
  sender_type: 'buyer' | 'seller' | 'admin';
  sender_id?: string | null;
  sender_name: string;
  message_text?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: 'image' | 'document' | 'video' | null;
  created_at: string;
};
type Dispute = {
  id: string;
  order_id: string;
  seller_id?: string | null;
  product_name?: string | null;
  dispute_type: DisputeType;
  status: DisputeStatus;
  description: string;
  requested_refund_amount?: number | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
  messages: Message[];
};

const typeLabels: Record<DisputeType, string> = {
  return_request: 'Return request',
  exchange_request: 'Exchange request',
  refund_request: 'Refund request',
  damage_claim: 'Damaged goods',
  quality_issue: 'Quality issue',
  delivery_issue: 'Delivery issue',
  general_query: 'General query',
};
const statusStyle: Record<DisputeStatus, string> = {
  open: 'bg-primary/10 text-primary border-primary/20',
  under_review: 'bg-warning/10 text-warning border-warning/20',
  resolved: 'bg-success/10 text-success border-success/20',
  escalated: 'bg-error/10 text-error border-error/20',
  closed: 'bg-muted text-muted-foreground border-border',
};
const money = (value: unknown) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0));
const dateTime = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
const fileExtension = (name: string) =>
  name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';

export default function DisputeMessaging({ mode = 'buyer' }: { mode?: 'buyer' | 'seller' }) {
  const { user, profile, isDemoAccount } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [orderValue, setOrderValue] = useState('');
  const [disputeType, setDisputeType] = useState<DisputeType>('general_query');
  const [description, setDescription] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [createEvidence, setCreateEvidence] = useState<Evidence | null>(null);
  const [message, setMessage] = useState('');
  const [messageEvidence, setMessageEvidence] = useState<Evidence | null>(null);
  const createFileRef = useRef<HTMLInputElement>(null);
  const messageFileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const accountName =
    profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You';
  const active = disputes.find((item) => item.id === activeId) || null;

  const load = useCallback(async () => {
    if (!user?.id || isDemoAccount) {
      setDisputes([]);
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: disputeRows, error: disputeError } = await supabase
        .from('disputes')
        .select(
          'id,order_id,seller_id,product_name,dispute_type,status,description,requested_refund_amount,resolution_notes,created_at,updated_at'
        )
        .order('updated_at', { ascending: false })
        .limit(100);
      if (disputeError) throw disputeError;
      const ids = (disputeRows || []).map((row) => row.id);
      const messageResult = ids.length
        ? await supabase
            .from('dispute_messages')
            .select(
              'id,dispute_id,sender_type,sender_id,sender_name,message_text,file_url,file_name,file_type,created_at'
            )
            .in('dispute_id', ids)
            .order('created_at', { ascending: true })
        : { data: [], error: null };
      if (messageResult.error) throw messageResult.error;
      const grouped = new Map<string, Message[]>();
      ((messageResult.data || []) as Message[]).forEach((row) => {
        grouped.set(row.dispute_id, [...(grouped.get(row.dispute_id) || []), row]);
      });
      const hydrated = (disputeRows || []).map((row) => ({
        ...row,
        messages: grouped.get(row.id) || [],
      })) as Dispute[];
      setDisputes(hydrated);
      setActiveId((current) =>
        current && hydrated.some((item) => item.id === current) ? current : hydrated[0]?.id || null
      );

      if (mode === 'buyer') {
        const [catalogResult, bulkResult] = await Promise.all([
          supabase
            .from('catalog_order_requests')
            .select('id,seller_id,status,total_amount,seller_products(name)')
            .eq('buyer_id', user.id)
            .in('status', ['paid', 'fulfilled'])
            .order('created_at', { ascending: false })
            .limit(100),
          supabase
            .from('bulk_orders')
            .select('id,seller_id,status,net_total,bulk_order_items(product_name)')
            .eq('buyer_id', user.id)
            .in('status', ['paid', 'shipped', 'delivered'])
            .order('created_at', { ascending: false })
            .limit(100),
        ]);
        if (catalogResult.error || bulkResult.error) throw catalogResult.error || bulkResult.error;
        const catalogOptions: OrderOption[] = (catalogResult.data || []).map((row) => {
          const relation = row.seller_products as { name?: string } | { name?: string }[] | null;
          const product = Array.isArray(relation) ? relation[0]?.name : relation?.name;
          return {
            value: `catalog:${row.id}`,
            kind: 'catalog',
            id: row.id,
            reference: `FT-CAT-${row.id.slice(0, 8).toUpperCase()}`,
            sellerId: row.seller_id,
            product: product || 'Catalogue product',
            total: Number(row.total_amount || 0),
          };
        });
        const bulkOptions: OrderOption[] = (bulkResult.data || []).map((row) => {
          const items = row.bulk_order_items as { product_name?: string }[] | null;
          return {
            value: `bulk:${row.id}`,
            kind: 'bulk',
            id: row.id,
            reference: `FT-BULK-${row.id.slice(0, 8).toUpperCase()}`,
            sellerId: row.seller_id,
            product: items?.[0]?.product_name || 'Bulk fabric order',
            total: Number(row.net_total || 0),
          };
        });
        setOrders([...catalogOptions, ...bulkOptions]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Disputes could not be loaded.');
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  }, [isDemoAccount, mode, supabase, user?.id]);

  useEffect(() => void load(), [load]);
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [active?.messages.length]);

  const parseEvidence = (file?: File | null): Evidence | null => {
    if (!file) return null;
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'video/mp4',
      'video/quicktime',
      'video/webm',
    ];
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Evidence files must be 100 MB or smaller.');
      return null;
    }
    if (!allowed.includes(file.type)) {
      toast.error('Upload JPG, PNG, WebP, PDF, MP4, MOV or WebM evidence.');
      return null;
    }
    return {
      file,
      type: file.type.startsWith('video/')
        ? 'video' : file.type.startsWith('image/')
          ? 'image' :'document',
    };
  };

  const uploadEvidence = async (disputeId: string, evidence: Evidence) => {
    if (!user?.id) throw new Error('Authentication required.');
    const path = `${user.id}/${disputeId}/${window.crypto.randomUUID()}.${fileExtension(evidence.file.name)}`;
    const { error } = await supabase.storage.from('dispute-evidence').upload(path, evidence.file, {
      contentType: evidence.file.type,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    return path;
  };

  const sendMessage = async () => {
    if (!active || !user?.id || (!message.trim() && !messageEvidence)) return;
    if (!['open', 'under_review', 'escalated'].includes(active.status)) {
      toast.error('This dispute is closed for participant messages.');
      return;
    }
    setBusy(true);
    try {
      let filePath = messageEvidence ? await uploadEvidence(active.id, messageEvidence) : null;
      const { error } = await supabase.from('dispute_messages').insert({
        dispute_id: active.id,
        sender_type: mode,
        sender_id: user.id,
        sender_name: accountName,
        message_text: message.trim() || null,
        file_url: filePath,
        file_name: messageEvidence?.file.name || null,
        file_type: messageEvidence?.type || null,
      });
      if (error) throw error;
      setMessage('');
      setMessageEvidence(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Message could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  const createDispute = async () => {
    if (mode !== 'buyer' || !user?.id) return;
    const selected = orders.find((item) => item.value === orderValue);
    if (!selected) return toast.error('Select one of your paid marketplace orders.');
    if (description.trim().length < 10) return toast.error('Describe the issue in at least 10 characters.');
    if (['damage_claim', 'exchange_request'].includes(disputeType) && !createEvidence) {
      return toast.error('Attach photo or video evidence for damage or exchange requests.');
    }
    const requestedRefund = disputeType === 'refund_request' ? Number(refundAmount) : null;
    if (
      disputeType === 'refund_request' &&
      (!Number.isFinite(requestedRefund) || Number(requestedRefund) < 1 || Number(requestedRefund) > selected.total)
    ) {
      return toast.error(`Refund request must be between ₹1 and ${money(selected.total)}.`);
    }

    setBusy(true);
    try {
      const { data: buyerProfile } = await supabase
        .from('buyer_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      const { data: dispute, error: disputeError } = await supabase
        .from('disputes')
        .insert({
          order_id: selected.reference,
          buyer_id: buyerProfile?.id || null,
          buyer_user_id: user.id,
          seller_id: selected.sellerId,
          bulk_order_id: selected.kind === 'bulk' ? selected.id : null,
          catalog_order_id: selected.kind === 'catalog' ? selected.id : null,
          product_name: selected.product,
          dispute_type: disputeType,
          status: 'open',
          description: description.trim(),
          has_unboxing_video: createEvidence?.type === 'video',
          requested_refund_amount: requestedRefund,
        })
        .select('id')
        .single();
      if (disputeError || !dispute) throw disputeError || new Error('Dispute could not be created.');

      let filePath: string | null = null;
      if (createEvidence) {
        try {
          filePath = await uploadEvidence(dispute.id, createEvidence);
        } catch (uploadError) {
          toast.error(
            uploadError instanceof Error
              ? `Request opened, but evidence upload failed: ${uploadError.message}`
              : 'Request opened, but evidence upload failed.'
          );
        }
      }
      const { error: messageError } = await supabase.from('dispute_messages').insert({
        dispute_id: dispute.id,
        sender_type: 'buyer',
        sender_id: user.id,
        sender_name: accountName,
        message_text: description.trim(),
        file_url: filePath,
        file_name: filePath ? createEvidence?.file.name || null : null,
        file_type: filePath ? createEvidence?.type || null : null,
      });
      if (messageError) throw messageError;

      toast.success('Request opened and stored for buyer, seller and administrator review.');
      setShowCreate(false);
      setOrderValue('');
      setDescription('');
      setRefundAmount('');
      setCreateEvidence(null);
      setDisputeType('general_query');
      await load();
      setActiveId(dispute.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Request could not be opened.');
    } finally {
      setBusy(false);
    }
  };

  const openEvidence = async (path: string) => {
    const { data, error } = await supabase.storage.from('dispute-evidence').createSignedUrl(path, 600);
    if (error || !data?.signedUrl) return toast.error(error?.message || 'Evidence could not be opened.');
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (isDemoAccount) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card py-14 text-center">
        <Icon name="ChatBubbleLeftRightIcon" size={34} className="mx-auto text-muted-foreground" />
        <p className="mt-3 text-sm font-800">Disputes are disabled for demo accounts</p>
        <p className="mt-1 text-xs text-muted-foreground">Real conversations require an authenticated paid order.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 p-4">
        <div>
          <h2 className="text-sm font-800">Returns, refunds & disputes</h2>
          <p className="mt-1 text-xs text-muted-foreground">Private order-linked records. Administrators control resolution and payment refunds.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="ft-icon-button" aria-label="Refresh disputes"><Icon name="ArrowPathIcon" size={16} className={loading ? 'animate-spin' : ''} /></button>
          {mode === 'buyer' && (
            <button type="button" onClick={() => { setShowCreate(true); setActiveId(null); }} className="btn-primary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs"><Icon name="PlusIcon" size={14} />New request</button>
          )}
        </div>
      </div>

      <div className="grid min-h-[34rem] lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="max-h-72 overflow-y-auto border-b border-border lg:max-h-[42rem] lg:border-b-0 lg:border-r">
          {loading && !disputes.length && <div className="py-12 text-center"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}
          {!loading && !disputes.length && <div className="p-6 text-center"><Icon name="ChatBubbleLeftRightIcon" size={28} className="mx-auto text-muted-foreground" /><p className="mt-2 text-xs font-800">No order disputes</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Only real paid orders can open a request.</p></div>}
          {disputes.map((item) => (
            <button key={item.id} type="button" onClick={() => { setActiveId(item.id); setShowCreate(false); }} className={`w-full border-b border-border p-3 text-left hover:bg-muted/50 ${activeId === item.id ? 'bg-primary/5' : ''}`}>
              <div className="flex items-center justify-between gap-2"><span className="truncate font-mono text-[11px] font-800 text-primary">{item.order_id}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-800 ${statusStyle[item.status]}`}>{item.status.replaceAll('_', ' ')}</span></div>
              <p className="mt-1 truncate text-xs font-800">{item.product_name || typeLabels[item.dispute_type]}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{typeLabels[item.dispute_type]} · {dateTime(item.created_at)}</p>
            </button>
          ))}
        </aside>

        <main className="min-w-0">
          {showCreate && mode === 'buyer' ? (
            <div className="max-h-[42rem] overflow-y-auto p-5">
              <h3 className="text-base font-800">Open an order-linked request</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Eligibility is reviewed against the product policy, evidence, order history and payment state. Submission does not automatically approve a return or refund.</p>
              <div className="mt-5 space-y-4">
                <label className="block text-sm font-700">Paid order<select value={orderValue} onChange={(event) => setOrderValue(event.target.value)} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5"><option value="">Select an order</option>{orders.map((order) => <option key={order.value} value={order.value}>{order.reference} · {order.product} · {money(order.total)}</option>)}</select></label>
                <div><p className="mb-2 text-sm font-700">Request type</p><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{(Object.entries(typeLabels) as [DisputeType, string][]).map(([value, label]) => <button key={value} type="button" onClick={() => setDisputeType(value)} className={`min-h-11 rounded-xl border px-3 py-2 text-left text-xs font-700 ${disputeType === value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30'}`}>{label}</button>)}</div></div>
                {disputeType === 'refund_request' && <label className="block text-sm font-700">Requested refund amount (₹)<input type="number" min="1" step="0.01" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" /></label>}
                <label className="block text-sm font-700">Description<textarea rows={5} maxLength={3000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain what happened, the goods condition and the resolution requested." className="input-base mt-1.5 w-full resize-y rounded-xl px-3 py-2.5" /></label>
                <div className="rounded-xl border border-border bg-muted/30 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-700">Private evidence</p><p className="text-xs text-muted-foreground">JPG, PNG, WebP, PDF, MP4, MOV or WebM · max 100 MB</p></div><button type="button" onClick={() => createFileRef.current?.click()} className="btn-secondary rounded-xl px-3 py-2 text-xs"><Icon name="PaperClipIcon" size={14} className="mr-1 inline" />Attach</button><input ref={createFileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/quicktime,video/webm" className="hidden" onChange={(event) => setCreateEvidence(parseEvidence(event.target.files?.[0]))} /></div>{createEvidence && <p className="mt-2 break-all text-xs font-700 text-success">{createEvidence.file.name}</p>}{['damage_claim', 'exchange_request'].includes(disputeType) && <p className="mt-2 text-xs font-700 text-warning">Evidence is required for this request type.</p>}</div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={busy} onClick={() => setShowCreate(false)} className="btn-secondary rounded-xl px-4 py-2.5 text-sm">Cancel</button><button type="button" disabled={busy || !orderValue || description.trim().length < 10} onClick={() => void createDispute()} className="btn-primary rounded-xl px-4 py-2.5 text-sm disabled:opacity-50">{busy ? 'Opening request…' : 'Open request'}</button></div>
              </div>
            </div>
          ) : active ? (
            <div className="flex min-h-[34rem] flex-col lg:min-h-[42rem]">
              <header className="border-b border-border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs font-800 text-primary">{active.order_id}</p><h3 className="mt-1 text-sm font-800">{typeLabels[active.dispute_type]} · {active.product_name || 'Marketplace order'}</h3>{active.requested_refund_amount ? <p className="mt-1 text-xs font-700 text-warning">Requested refund: {money(active.requested_refund_amount)}</p> : null}</div><span className={`rounded-full border px-2.5 py-1 text-xs font-800 ${statusStyle[active.status]}`}>{active.status.replaceAll('_', ' ')}</span></div>{active.resolution_notes && <div className="mt-3 rounded-xl border border-success/20 bg-success/5 p-3 text-xs"><strong>Administrator resolution:</strong> {active.resolution_notes}</div>}</header>
              <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">{active.messages.map((item) => { const mine = item.sender_id === user?.id; return <div key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-sm sm:max-w-[72%] ${mine ? 'bg-primary text-white' : 'border border-border bg-card'}`}><p className={`mb-1 text-[10px] font-800 ${mine ? 'text-white/75' : 'text-muted-foreground'}`}>{item.sender_name} · {item.sender_type === 'admin' ? 'FabricTrad support' : item.sender_type}</p>{item.message_text && <p className="whitespace-pre-line break-words">{item.message_text}</p>}{item.file_url && <button type="button" onClick={() => void openEvidence(item.file_url!)} className={`mt-2 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-800 ${mine ? 'border-white/30 bg-white/10 text-white' : 'border-border bg-muted text-primary'}`}><Icon name={item.file_type === 'video' ? 'VideoCameraIcon' : item.file_type === 'image' ? 'PhotoIcon' : 'DocumentIcon'} size={13} />{item.file_name || 'Open evidence'}</button>}<p className={`mt-1.5 text-[10px] ${mine ? 'text-white/70' : 'text-muted-foreground'}`}>{dateTime(item.created_at)}</p></div></div>; })}{!active.messages.length && <p className="py-8 text-center text-xs text-muted-foreground">No messages yet.</p>}<div ref={bottomRef} /></div>
              {['open', 'under_review', 'escalated'].includes(active.status) ? <footer className="border-t border-border p-3">{messageEvidence && <p className="mb-2 break-all text-xs font-700 text-success">Attached: {messageEvidence.file.name}</p>}<div className="flex items-end gap-2"><button type="button" onClick={() => messageFileRef.current?.click()} className="ft-icon-button shrink-0" aria-label="Attach private evidence"><Icon name="PaperClipIcon" size={17} /></button><input ref={messageFileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/quicktime,video/webm" className="hidden" onChange={(event) => setMessageEvidence(parseEvidence(event.target.files?.[0]))} /><textarea rows={2} maxLength={3000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message…" className="input-base min-w-0 flex-1 resize-none rounded-xl px-3 py-2.5 text-sm" /><button type="button" disabled={busy || (!message.trim() && !messageEvidence)} onClick={() => void sendMessage()} className="btn-primary shrink-0 rounded-xl px-4 py-3 disabled:opacity-50"><Icon name="PaperAirplaneIcon" size={16} /></button></div></footer> : <div className="border-t border-border bg-muted/30 p-3 text-center text-xs text-muted-foreground">This conversation is closed. Contact support with the dispute reference for further review.</div>}
            </div>
          ) : <div className="grid min-h-[34rem] place-items-center p-6 text-center lg:min-h-[42rem]"><div><Icon name="ChatBubbleLeftRightIcon" size={36} className="mx-auto text-muted-foreground" /><p className="mt-3 text-sm font-800">Select a dispute</p><p className="mt-1 text-xs text-muted-foreground">Choose an order conversation or open a new request.</p></div></div>}
        </main>
      </div>
    </div>
  );
}
