'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface FeedbackTheme {
  label: string;
  type: 'praise' | 'concern';
  count: number;
  icon: string;
}

const PRAISE_THEMES: FeedbackTheme[] = [
  { label: 'Fast Dispatch', type: 'praise', count: 87, icon: '⚡' },
  { label: 'Consistent Quality', type: 'praise', count: 74, icon: '✅' },
  { label: 'Accurate Description', type: 'praise', count: 68, icon: '📋' },
  { label: 'Good Packaging', type: 'praise', count: 52, icon: '📦' },
  { label: 'GST Invoice Provided', type: 'praise', count: 41, icon: '🧾' },
];

const CONCERN_THEMES: FeedbackTheme[] = [
  { label: 'Slow Response', type: 'concern', count: 18, icon: '⏱️' },
  { label: 'Minor Shade Variation', type: 'concern', count: 12, icon: '🎨' },
  { label: 'Packaging Could Improve', type: 'concern', count: 7, icon: '📦' },
];

const RECENT_5STAR = [
  {
    id: 1,
    buyer: 'Mehta Garments',
    city: 'Mumbai',
    date: '12 Jul 2026',
    title: 'Excellent quality, fast dispatch',
    body: 'Received exactly 300 metres as ordered. Fabric quality is top-notch. Dispatch within 2 days.',
    orderId: 'FT-ORD-004821',
  },
  {
    id: 2,
    buyer: 'Patel Creations',
    city: 'Ahmedabad',
    date: '05 Jul 2026',
    title: 'Consistent quality across bulk orders',
    body: 'Third time ordering. Every batch is consistent. GST invoice on time. Highly recommended.',
    orderId: 'FT-ORD-004612',
  },
  {
    id: 3,
    buyer: 'Sharma Textiles',
    city: 'Delhi',
    date: '28 Jun 2026',
    title: 'Great fabric, will reorder',
    body: 'Fabric quality as described. Delivery on time. Very satisfied with the purchase.',
    orderId: 'FT-ORD-004390',
  },
];

const IMPROVEMENTS = [
  { icon: '⚡', text: 'Respond to buyer queries within 2 hours to boost rating by ~0.3 stars', impact: 'High' },
  { icon: '🎨', text: 'Add more accurate color swatches to reduce shade variation complaints', impact: 'Medium' },
  { icon: '📦', text: 'Use double-layer packaging for embroidered fabrics to reduce damage claims', impact: 'Medium' },
  { icon: '🧾', text: 'Share GST invoice proactively at dispatch — buyers rate this highly', impact: 'Low' },
];

const RESPONSE_RATE_DATA = [
  { label: '< 1 hr', rating: 4.9, pct: 100 },
  { label: '1–4 hrs', rating: 4.7, pct: 96 },
  { label: '4–12 hrs', rating: 4.4, pct: 90 },
  { label: '12–24 hrs', rating: 4.0, pct: 82 },
  { label: '> 24 hrs', rating: 3.5, pct: 71 },
];

export default function BuyerFeedbackWidget() {
  const [activeTab, setActiveTab] = useState<'overview' | 'themes' | 'response' | 'suggestions'>('overview');

  const tabs = [
    { key: 'overview' as const, label: 'Recent Reviews', icon: 'StarIcon' },
    { key: 'themes' as const, label: 'Themes', icon: 'TagIcon' },
    { key: 'response' as const, label: 'Response Impact', icon: 'ChartBarIcon' },
    { key: 'suggestions' as const, label: 'Improve', icon: 'LightBulbIcon' },
  ];

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden mt-6">
      {/* Header */}
      <div className="p-4 border-b border-border bg-gradient-to-r from-amber-50 to-orange-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Icon name="StarIcon" size={16} className="text-amber-500" variant="solid" />
            </div>
            <div>
              <h3 className="font-700 text-sm text-foreground">Buyer Feedback Intelligence</h3>
              <p className="text-xs text-muted-foreground">AI-analysed from 124 verified reviews</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-800 text-foreground">4.8</span>
            <div>
              <div className="flex items-center gap-0.5">
                {[1,2,3,4,5].map((s) => (
                  <Icon key={s} name="StarIcon" size={12} className={s <= 4 ? 'text-amber-400' : 'text-amber-200'} variant="solid" />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">124 reviews</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-600 whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={tab.icon as 'StarIcon'} size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* Recent 5-Star Reviews */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            <p className="text-xs font-700 text-muted-foreground uppercase tracking-wide mb-3">Recent 5-Star Reviews</p>
            {RECENT_5STAR.map((review) => (
              <div key={review.id} className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-800 text-amber-700">{review.buyer[0]}</span>
                    </div>
                    <div>
                      <p className="text-xs font-700 text-foreground">{review.buyer}</p>
                      <p className="text-xs text-muted-foreground">{review.city} · {review.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {[1,2,3,4,5].map((s) => (
                      <Icon key={s} name="StarIcon" size={11} className="text-amber-400" variant="solid" />
                    ))}
                  </div>
                </div>
                <p className="text-xs font-700 text-foreground mb-0.5">{review.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{review.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* Praise & Concern Themes */}
        {activeTab === 'themes' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-700 text-success uppercase tracking-wide mb-2">Common Praise</p>
              <div className="space-y-2">
                {PRAISE_THEMES.map((theme) => (
                  <div key={theme.label} className="flex items-center gap-2">
                    <span className="text-sm">{theme.icon}</span>
                    <span className="text-xs font-600 text-foreground flex-1">{theme.label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-success rounded-full"
                          style={{ width: `${(theme.count / 87) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{theme.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-700 text-warning uppercase tracking-wide mb-2">Common Concerns</p>
              <div className="space-y-2">
                {CONCERN_THEMES.map((theme) => (
                  <div key={theme.label} className="flex items-center gap-2">
                    <span className="text-sm">{theme.icon}</span>
                    <span className="text-xs font-600 text-foreground flex-1">{theme.label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-warning rounded-full"
                          style={{ width: `${(theme.count / 18) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{theme.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Response Rate Impact */}
        {activeTab === 'response' && (
          <div>
            <p className="text-xs text-muted-foreground mb-4">
              Faster response time directly correlates with higher buyer ratings. Your current avg: <strong className="text-foreground">3.2 hrs</strong>
            </p>
            <div className="space-y-2.5">
              {RESPONSE_RATE_DATA.map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16 shrink-0">{row.label}</span>
                  <div className="flex-1 h-6 bg-muted rounded-lg overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-end pr-2 transition-all"
                      style={{ width: `${row.pct}%` }}
                    >
                      <span className="text-xs font-700 text-white">{row.rating}★</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground w-8 shrink-0">{row.pct}%</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3 p-2 bg-muted/50 rounded-lg">
              💡 Responding within 1 hour could increase your rating from 4.8 to 4.9
            </p>
          </div>
        )}

        {/* Improvement Suggestions */}
        {activeTab === 'suggestions' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground mb-3">AI-generated suggestions based on your review patterns:</p>
            {IMPROVEMENTS.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl border border-border">
                <span className="text-lg shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground leading-relaxed">{item.text}</p>
                </div>
                <span className={`text-xs font-700 px-2 py-0.5 rounded-full shrink-0 ${
                  item.impact === 'High' ? 'bg-error/10 text-error' :
                  item.impact === 'Medium'? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
                }`}>
                  {item.impact}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
