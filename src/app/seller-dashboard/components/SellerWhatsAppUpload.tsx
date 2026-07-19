'use client';
import React, { useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

type UploadStatus = 'idle' | 'parsing' | 'preview' | 'submitted';

const processedUploads = [
  {
    id: 'WA-001',
    raw: 'Fabric = pure dyeable soft nett\nWidth = 44\nWork = handwork all over\nRate = 840 per mtr',
    parsed: {
      name: 'Pure Dyeable Soft Nett Fabric',
      width: '44 inches',
      work: 'Handwork All Over',
      price: '₹840/mtr',
    },
    images: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=120&h=120&fit=crop',
      'https://images.unsplash.com/photo-1597843786272-5e54bef5b7e6?w=120&h=120&fit=crop',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=120&h=120&fit=crop',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=120&h=120&fit=crop',
    ],
    status: 'approved',
    time: '17 Jul 2026, 10:14 AM',
  },
  {
    id: 'WA-002',
    raw: 'Fabric = georgette embroidered\nWidth = 44\nWork = zari work\nRate = 1250 per mtr',
    parsed: {
      name: 'Georgette Embroidered Fabric',
      width: '44 inches',
      work: 'Zari Work',
      price: '₹1,250/mtr',
    },
    images: ['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=120&h=120&fit=crop'],
    status: 'pending_admin',
    time: '16 Jul 2026, 03:30 PM',
  },
];

const referenceMatches = [
  {
    id: 'REF-1150',
    vendor: 'Aarav Ethnic Studio',
    image: 'https://images.unsplash.com/photo-1593032465175-481ac7f401f0?w=240&h=280&fit=crop',
    title: 'White Indo-Western Jacket',
    confidence: '94%',
    details: ['Pearl button placket', 'Mandarin collar', 'Gold hand embroidery', 'Ready reference'],
    capturedFrom: 'WhatsApp image + caption',
  },
  {
    id: 'REF-1142',
    vendor: 'Surat Zari House',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=240&h=280&fit=crop',
    title: 'Ivory Designer Fabric Panel',
    confidence: '88%',
    details: ['Ivory base', 'Zari motif', 'Occasion wear', 'Sample available'],
    capturedFrom: 'Seller catalog upload',
  },
];

export default function SellerWhatsAppUpload() {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [rawText, setRawText] = useState('');
  const [parsedData, setParsedData] = useState<Record<string, string> | null>(null);

  const handleParse = () => {
    setStatus('parsing');
    setTimeout(() => {
      setParsedData({
        'Fabric Name': 'Pure Dyeable Soft Nett Fabric',
        Width: '44 inches',
        'Work Type': 'Handwork All Over',
        Price: '₹840 per metre',
        Category: 'Net & Embroidered (AI detected)',
        GSM: '120 GSM (AI estimated)',
        'HSN Code': '5804 10 00 (AI assigned)',
        'GST Rate': '5% (AI assigned)',
      });
      setStatus('preview');
    }, 1800);
  };

  const handleSubmit = () => {
    setStatus('submitted');
  };

  return (
    <div>
      <h1 className="text-xl font-800 text-foreground mb-2">WhatsApp Catalog Upload</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Send your catalog details via WhatsApp. Our AI automatically processes and uploads products
        to your store. Products go live only after Admin approval.
      </p>

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-8">
        {[
          {
            step: '1',
            icon: 'ChatBubbleLeftRightIcon',
            label: 'Send on WhatsApp',
            desc: 'Type fabric details + attach photos',
          },
          {
            step: '2',
            icon: 'CpuChipIcon',
            label: 'AI Processes',
            desc: 'AI parses, structures and categorises',
          },
          {
            step: '3',
            icon: 'CloudArrowUpIcon',
            label: 'Auto Uploaded',
            desc: 'Product added to your catalog draft',
          },
          {
            step: '4',
            icon: 'ShieldCheckIcon',
            label: 'Admin Approval',
            desc: 'Goes live after FabricTrad review',
          },
        ].map((s) => (
          <div key={s.step} className="bg-card rounded-xl border border-border p-4 text-center">
            <div className="w-10 h-10 rounded-xl gradient-saffron flex items-center justify-center mx-auto mb-2">
              <Icon name={s.icon as 'CpuChipIcon'} size={18} className="text-white" />
            </div>
            <p className="text-xs font-700 text-foreground mb-1">{s.label}</p>
            <p className="text-xs text-muted-foreground leading-tight">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* WhatsApp Reference Image */}
      <div className="bg-card rounded-2xl border border-border p-5 mb-6">
        <h2 className="font-800 text-foreground text-sm mb-3 flex items-center gap-2">
          <Icon name="PhotoIcon" size={16} className="text-primary" />
          Reference: How to Send on WhatsApp
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {/* Simulated WhatsApp Chat */}
          <div className="w-full sm:w-64 bg-[#ECE5DD] rounded-2xl p-3 font-sans">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-black/10">
              <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center">
                <Icon name="ChatBubbleLeftRightIcon" size={16} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-700 text-foreground">FabricTrad Upload Bot</p>
                <p className="text-xs text-green-600">● Online</p>
              </div>
            </div>

            {/* Image message */}
            <div className="bg-white rounded-xl rounded-tl-sm p-1 mb-2 shadow-sm max-w-[220px]">
              <div className="grid grid-cols-2 gap-0.5 rounded-lg overflow-hidden mb-1">
                {[
                  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop',
                  'https://images.unsplash.com/photo-1597843786272-5e54bef5b7e6?w=100&h=100&fit=crop',
                  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=100&h=100&fit=crop',
                ].map((src, i) => (
                  <div
                    key={i}
                    className={`${i === 0 ? 'col-span-2' : ''} aspect-video overflow-hidden bg-gray-100 relative`}
                  >
                    <AppImage
                      src={src}
                      alt={`WhatsApp catalog image ${i + 1} showing fabric texture and embroidery detail`}
                      fill
                      sizes="100px"
                      className="object-cover"
                    />
                    {i === 2 && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white text-sm font-700">+3</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 text-right px-1 pb-0.5">12:14</p>
            </div>

            {/* Text message */}
            <div className="bg-white rounded-xl rounded-tl-sm p-3 shadow-sm max-w-[220px]">
              <p className="text-xs text-gray-500 text-xs mb-1">Forwarded</p>
              <p className="text-xs font-500 text-foreground leading-relaxed">
                Fabric = pure dyeable soft nett
                <br />
                Width = 44
                <br />
                Work = handwork all over
                <br />
                Rate = 840 per mtr
              </p>
              <p className="text-xs text-gray-400 text-right mt-1">12:14</p>
            </div>
          </div>

          <div className="flex-1">
            <p className="text-sm font-700 text-foreground mb-2">Message Format</p>
            <div className="bg-muted rounded-xl p-4 font-mono text-sm mb-3">
              <p className="text-muted-foreground">Fabric = [fabric type]</p>
              <p className="text-muted-foreground">Width = [width in inches]</p>
              <p className="text-muted-foreground">Work = [work type]</p>
              <p className="text-muted-foreground">Rate = [price per mtr]</p>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Also attach photos of the fabric. AI will auto-detect: category, GSM, HSN code, and
              GST rate.
            </p>
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
              <Icon name="ChatBubbleLeftRightIcon" size={16} className="text-green-600" />
              <div>
                <p className="text-xs font-700 text-green-800">WhatsApp: +91 98765 00001</p>
                <p className="text-xs text-green-600">FabricTrad Seller Upload Bot</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Text Input (Demo) */}
      <div className="bg-card rounded-2xl border border-border p-5 mb-6">
        <h2 className="font-800 text-foreground text-sm mb-3">Try AI Parser (Demo)</h2>

        {status === 'idle' && (
          <div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={5}
              placeholder={`Fabric = pure dyeable soft nett\nWidth = 44\nWork = handwork all over\nRate = 840 per mtr`}
              className="input-base w-full px-4 py-3 text-sm rounded-xl font-mono mb-3 resize-none"
            />
            <button
              onClick={handleParse}
              disabled={rawText.trim().length < 10}
              className="btn-primary px-5 py-2.5 text-sm rounded-xl disabled:opacity-50"
            >
              Process with AI
            </button>
          </div>
        )}

        {status === 'parsing' && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-sm font-700 text-foreground">AI is processing your catalog...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Detecting fabric type, category, HSN code...
            </p>
          </div>
        )}

        {status === 'preview' && parsedData && (
          <div>
            <div className="flex items-center gap-2 mb-4 p-3 bg-success/10 border border-success/20 rounded-xl">
              <Icon name="CheckCircleIcon" size={16} className="text-success" />
              <p className="text-sm font-700 text-success">
                AI parsing complete! Review and submit.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {Object.entries(parsedData).map(([key, val]) => (
                <div key={key} className="bg-muted rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">{key}</p>
                  <p className="text-sm font-700 text-foreground">{val}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStatus('idle')}
                className="btn-secondary px-4 py-2.5 text-sm rounded-xl"
              >
                Edit
              </button>
              <button onClick={handleSubmit} className="btn-primary px-5 py-2.5 text-sm rounded-xl">
                Submit for Admin Approval
              </button>
            </div>
          </div>
        )}

        {status === 'submitted' && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-success/10 border-2 border-success flex items-center justify-center mx-auto mb-3">
              <Icon name="CheckCircleIcon" size={28} className="text-success" />
            </div>
            <p className="text-base font-800 text-foreground mb-1">Product Submitted!</p>
            <p className="text-sm text-muted-foreground mb-4">
              Awaiting FabricTrad admin approval. You'll be notified via SMS & email.
            </p>
            <button
              onClick={() => {
                setStatus('idle');
                setRawText('');
                setParsedData(null);
              }}
              className="btn-secondary px-4 py-2 text-sm rounded-xl"
            >
              Upload Another
            </button>
          </div>
        )}
      </div>

      {/* AI Reference Matching */}
      <div className="mb-6 rounded-2xl border border-secondary/20 bg-card p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-800 text-foreground">
              <Icon name="SparklesIcon" size={16} className="text-secondary" />
              AI Reference Matching
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Product or fabric photos shared on WhatsApp become searchable vendor references with
              extracted details. When a buyer posts the same or similar image, FabricTrad can show
              matching vendors instantly.
            </p>
          </div>
          <span className="w-fit rounded-full border border-success/20 bg-success/10 px-3 py-1 text-xs font-700 text-success">
            Buyer popup enabled
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="mb-3 text-xs font-800 uppercase text-muted-foreground">
              WhatsApp to account flow
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  icon: 'PhotoIcon',
                  title: 'Image received',
                  desc: 'Vendor sends catalog image, product code, rate and notes.',
                },
                {
                  icon: 'CpuChipIcon',
                  title: 'AI fills details',
                  desc: 'Fabric, work, colour, price, tags and reference ID are drafted.',
                },
                {
                  icon: 'BellAlertIcon',
                  title: 'Buyer match popup',
                  desc: 'Similar buyer image posts surface this vendor as a reference.',
                },
              ].map((step) => (
                <div key={step.title} className="rounded-xl border border-border bg-card p-3">
                  <Icon name={step.icon as 'PhotoIcon'} size={18} className="mb-2 text-primary" />
                  <p className="text-sm font-800 text-foreground">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {referenceMatches.map((match) => (
              <div key={match.id} className="flex gap-3 rounded-xl border border-border p-3">
                <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <AppImage
                    src={match.image}
                    alt={`${match.title} AI reference image`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-700 text-primary">{match.id}</p>
                      <p className="text-sm font-800 text-foreground">{match.title}</p>
                    </div>
                    <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-xs font-800 text-secondary">
                      {match.confidence}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{match.vendor}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {match.details.slice(0, 3).map((detail) => (
                      <span key={detail} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {detail}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{match.capturedFrom}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Uploads */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h2 className="font-800 text-foreground text-sm mb-4">Recent WhatsApp Uploads</h2>
        <div className="space-y-4">
          {processedUploads.map((upload) => (
            <div key={upload.id} className="border border-border rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex gap-1 shrink-0">
                  {upload.images.slice(0, 3).map((img, i) => (
                    <div key={i} className="w-12 h-12 rounded-lg overflow-hidden bg-muted">
                      <AppImage
                        src={img}
                        alt={`Uploaded fabric product image ${i + 1}`}
                        width={48}
                        height={48}
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-700 text-foreground">{upload.parsed.name}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.values(upload.parsed)
                      .slice(1)
                      .map((val) => (
                        <span
                          key={val}
                          className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full"
                        >
                          {val}
                        </span>
                      ))}
                  </div>
                </div>
                <span
                  className={`text-xs font-700 px-2.5 py-1 rounded-full shrink-0 ${
                    upload.status === 'approved'
                      ? 'bg-success/10 text-success'
                      : 'bg-amber-50 text-warning'
                  }`}
                >
                  {upload.status === 'approved' ? '✓ Live' : '⏳ Pending Review'}
                </span>
              </div>
              <div className="bg-muted rounded-lg p-2">
                <p className="text-xs font-mono text-muted-foreground whitespace-pre-line">
                  {upload.raw}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{upload.time}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
