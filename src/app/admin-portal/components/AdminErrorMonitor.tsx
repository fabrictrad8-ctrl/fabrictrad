'use client';
import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';

interface ErrorLog {
  id: string;
  type: 'razorpay' | 'shiprocket' | 'rls' | 'webhook' | 'general';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  details: string;
  timestamp: string;
  resolved: boolean;
  count: number;
  affectedEntity?: string;
}

const mockErrors: ErrorLog[] = [
  {
    id: 'ERR-001',
    type: 'razorpay',
    severity: 'critical',
    message: 'Payment capture failed — order FT-ORD-009821',
    details:
      'Razorpay API returned 502 Bad Gateway. Payment ID: pay_NxK8mL2pQ4rT. Amount: ₹18,400. Retry count: 3/3.',
    timestamp: '2026-07-17 19:42:11',
    resolved: false,
    count: 3,
    affectedEntity: 'FT-ORD-009821',
  },
  {
    id: 'ERR-002',
    type: 'shiprocket',
    severity: 'high',
    message: 'Shiprocket API timeout — shipment creation delayed',
    details:
      'POST /v1/external/orders/create timed out after 30s. Order FT-ORD-009815 shipment not created. Seller: Surat Textile Mills.',
    timestamp: '2026-07-17 18:55:03',
    resolved: false,
    count: 1,
    affectedEntity: 'FT-ORD-009815',
  },
  {
    id: 'ERR-003',
    type: 'rls',
    severity: 'high',
    message: 'RLS policy violation — unauthorized data access attempt',
    details:
      'User FT-BYR-004521 attempted to access seller_profiles table without proper role. Query blocked by RLS. IP: 103.21.xx.xx.',
    timestamp: '2026-07-17 17:30:45',
    resolved: true,
    count: 1,
    affectedEntity: 'FT-BYR-004521',
  },
  {
    id: 'ERR-004',
    type: 'webhook',
    severity: 'critical',
    message: 'Razorpay webhook signature mismatch',
    details:
      'Webhook event payment.captured received but HMAC signature validation failed. Event ID: evt_NxK9pR3mT5. Possible replay attack or key rotation needed.',
    timestamp: '2026-07-17 16:12:30',
    resolved: false,
    count: 7,
    affectedEntity: 'Webhook Handler',
  },
  {
    id: 'ERR-005',
    type: 'shiprocket',
    severity: 'medium',
    message: 'Tracking update fetch failed — 3 shipments',
    details:
      'GET /v1/external/courier/track/awbs returned 429 Too Many Requests. AWBs: 1234567890, 1234567891, 1234567892. Rate limit exceeded.',
    timestamp: '2026-07-17 15:08:22',
    resolved: true,
    count: 12,
    affectedEntity: '3 Shipments',
  },
  {
    id: 'ERR-006',
    type: 'razorpay',
    severity: 'medium',
    message: 'Payment verification failed — duplicate order ID',
    details:
      'Order ID FT-ORD-009800 already exists in Razorpay. Possible duplicate checkout submission. Buyer: FT-BYR-004488.',
    timestamp: '2026-07-17 14:22:10',
    resolved: true,
    count: 2,
    affectedEntity: 'FT-ORD-009800',
  },
  {
    id: 'ERR-007',
    type: 'general',
    severity: 'low',
    message: 'Supabase connection pool exhausted — brief latency spike',
    details:
      'Connection pool hit max limit (100 connections) for 45 seconds. Queries queued. Auto-resolved after pool recycled.',
    timestamp: '2026-07-17 12:45:00',
    resolved: true,
    count: 1,
    affectedEntity: 'Database',
  },
];

const typeConfig = {
  razorpay: { label: 'Razorpay', icon: 'CreditCardIcon', color: 'text-blue-600', bg: 'bg-blue-50' },
  shiprocket: {
    label: 'Shiprocket',
    icon: 'TruckIcon',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  rls: {
    label: 'RLS Violation',
    icon: 'ShieldExclamationIcon',
    color: 'text-error',
    bg: 'bg-error/10',
  },
  webhook: { label: 'Webhook', icon: 'BoltIcon', color: 'text-warning', bg: 'bg-amber-50' },
  general: {
    label: 'General',
    icon: 'ExclamationCircleIcon',
    color: 'text-muted-foreground',
    bg: 'bg-muted',
  },
};

const severityConfig = {
  critical: { label: 'Critical', class: 'bg-error text-white', dot: 'bg-error' },
  high: { label: 'High', class: 'bg-orange-500 text-white', dot: 'bg-orange-500' },
  medium: { label: 'Medium', class: 'bg-warning text-white', dot: 'bg-warning' },
  low: { label: 'Low', class: 'bg-muted-foreground text-white', dot: 'bg-muted-foreground' },
};

export default function AdminErrorMonitor() {
  const [errors, setErrors] = useState<ErrorLog[]>(mockErrors);
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'critical'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleResolve = (id: string) => {
    setErrors((prev) => prev.map((e) => (e.id === id ? { ...e, resolved: true } : e)));
  };

  const filtered = errors.filter((e) => {
    if (filter === 'unresolved' && e.resolved) return false;
    if (filter === 'critical' && e.severity !== 'critical') return false;
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    return true;
  });

  const unresolvedCount = errors.filter((e) => !e.resolved).length;
  const criticalCount = errors.filter((e) => e.severity === 'critical' && !e.resolved).length;

  const stats = [
    {
      label: 'Total Errors (24h)',
      value: errors.length.toString(),
      icon: 'ExclamationCircleIcon',
      color: 'text-foreground',
      bg: 'bg-muted',
    },
    {
      label: 'Unresolved',
      value: unresolvedCount.toString(),
      icon: 'ExclamationTriangleIcon',
      color: 'text-error',
      bg: 'bg-error/10',
    },
    {
      label: 'Critical Alerts',
      value: criticalCount.toString(),
      icon: 'BellAlertIcon',
      color: 'text-error',
      bg: 'bg-error/10',
    },
    {
      label: 'Resolved Today',
      value: errors.filter((e) => e.resolved).length.toString(),
      icon: 'CheckCircleIcon',
      color: 'text-success',
      bg: 'bg-success/10',
    },
  ];

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-800 text-foreground">Error Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Production error tracking · Last refresh:{' '}
            {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
            <span className="text-xs font-600 text-foreground">Real-time Alerts</span>
            <button
              onClick={() => setAlertsEnabled(!alertsEnabled)}
              className={`w-9 h-5 rounded-full transition-colors relative ${alertsEnabled ? 'bg-success' : 'bg-muted border border-border'}`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${alertsEnabled ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </button>
          </div>
          <button
            onClick={() => setLastRefresh(new Date())}
            className="flex items-center gap-1.5 bg-card border border-border text-xs px-3 py-2 rounded-xl font-600 text-foreground hover:border-primary transition-colors"
          >
            <Icon name="ArrowPathIcon" size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-card rounded-2xl border border-border p-4">
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-2`}>
              <Icon name={s.icon as 'ExclamationCircleIcon'} size={18} className={s.color} />
            </div>
            <p className={`text-2xl font-800 ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Critical Alert Banner */}
      {criticalCount > 0 && (
        <div className="bg-error/10 border border-error/30 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-error/20 flex items-center justify-center shrink-0 mt-0.5">
            <Icon name="BellAlertIcon" size={16} className="text-error" />
          </div>
          <div>
            <p className="text-sm font-800 text-error">
              {criticalCount} Critical Error{criticalCount > 1 ? 's' : ''} Require Immediate
              Attention
            </p>
            <p className="text-xs text-error/80 mt-0.5">
              {errors
                .filter((e) => e.severity === 'critical' && !e.resolved)
                .map((e) => e.message)
                .join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1">
          {(['all', 'unresolved', 'critical'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-600 transition-all capitalize ${
                filter === f
                  ? 'bg-secondary text-white'
                  : 'bg-card border border-border text-muted-foreground hover:border-secondary'
              }`}
            >
              {f === 'all'
                ? 'All Errors'
                : f === 'unresolved'
                  ? `Unresolved (${unresolvedCount})`
                  : `Critical (${criticalCount})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input-base px-2 py-1.5 text-xs rounded-lg"
          >
            <option value="all">All Types</option>
            {Object.entries(typeConfig).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <Icon name="CheckCircleIcon" size={32} className="text-success mx-auto mb-2" />
            <p className="font-700 text-foreground">No errors match your filter</p>
            <p className="text-sm text-muted-foreground">All systems operating normally</p>
          </div>
        )}
        {filtered.map((error) => (
          <div
            key={error.id}
            className={`bg-card rounded-2xl border transition-all ${error.resolved ? 'border-border opacity-70' : 'border-border hover:border-primary/30'}`}
          >
            <div
              className="p-4 cursor-pointer"
              onClick={() => setExpandedId(expandedId === error.id ? null : error.id)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl ${typeConfig[error.type].bg} flex items-center justify-center shrink-0 mt-0.5`}
                >
                  <Icon
                    name={typeConfig[error.type].icon as 'CreditCardIcon'}
                    size={16}
                    className={typeConfig[error.type].color}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-700 ${severityConfig[error.severity].class}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                      {severityConfig[error.severity].label}
                    </span>
                    <span className="text-xs font-600 text-muted-foreground">
                      {typeConfig[error.type].label}
                    </span>
                    {error.count > 1 && (
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-lg font-600">
                        ×{error.count}
                      </span>
                    )}
                    {error.resolved && (
                      <span className="text-xs bg-success/10 text-success px-1.5 py-0.5 rounded-lg font-600">
                        Resolved
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-700 text-foreground leading-snug">{error.message}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {formatTime(error.timestamp)} · {error.timestamp.split(' ')[0]}
                    </span>
                    {error.affectedEntity && (
                      <span className="mono-id text-xs">{error.affectedEntity}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!error.resolved && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResolve(error.id);
                      }}
                      className="bg-success/10 text-success text-xs px-2.5 py-1 rounded-lg font-600 hover:bg-success hover:text-white transition-all"
                    >
                      Resolve
                    </button>
                  )}
                  <Icon
                    name={expandedId === error.id ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                    size={16}
                    className="text-muted-foreground"
                  />
                </div>
              </div>
            </div>
            {expandedId === error.id && (
              <div className="px-4 pb-4 border-t border-border pt-3">
                <p className="text-xs font-700 text-muted-foreground mb-1.5">Error Details</p>
                <div className="bg-muted rounded-xl p-3 font-mono text-xs text-foreground leading-relaxed">
                  {error.details}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-muted-foreground">
                    Error ID: <span className="font-mono font-600">{error.id}</span>
                  </span>
                  <button className="ml-auto text-xs text-primary font-600 hover:underline">
                    Copy Details
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
