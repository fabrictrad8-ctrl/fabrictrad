import React from 'react';
import type { Metadata, Viewport } from 'next';
import '../styles/tailwind.css';
import '../styles/font-fallback.css';
import '../styles/shopify-glass.css';
import '../styles/commerce-polish.css';
import '../styles/global-commerce.css';
import '../styles/orange-commerce.css';
import '../styles/premium-commerce.css';
import '../styles/marketplace-refinement.css';
import '../styles/header-reflow.css';
import '../styles/site-motion-and-polish.css';
import '../styles/accessibility-target-fixes.css';
import '../styles/commerce-2026-redesign.css';
import '../styles/fabrictrad-future.css';
import '../styles/fabrictrad-ui-fixes.css';
import '../styles/fabrictrad-light-commerce.css';
import '../styles/commerce-ux-final.css';
import '../styles/human-ui-refinement.css';
import '../styles/public-nav-consistency.css';
import '../styles/ui-integrity-hotfix.css';
import { AuthProvider } from '@/contexts/AuthContext';
import AppClientEnhancements from '@/components/AppClientEnhancements';
import RouteExperienceEnhancer from '@/components/RouteExperienceEnhancer';
import PageContinuity from '@/components/PageContinuity';
import PublicHowToUseNavigation from '@/components/PublicHowToUseNavigation';
import SitewideLanguageControl from '@/components/SitewideLanguageControl';
import { AppPreferencesProvider } from '@/contexts/AppPreferencesContext';

const PRODUCTION_UI_RELEASE = 'fabrictrad-brand-logo-2026-08-29';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f6f7f9',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: "FabricTrad — India's Textile Commerce Platform",
    template: '%s · FabricTrad',
  },
  description:
    'FabricTrad connects verified textile sellers with business and retail buyers for sourcing, catalogues, payments, orders and fulfilment.',
  applicationName: 'FabricTrad',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FabricTrad',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    siteName: 'FabricTrad',
    title: "FabricTrad — India's Textile Commerce Platform",
    description:
      'FabricTrad connects verified textile sellers with business and retail buyers for sourcing, catalogues, payments, orders and fulfilment.',
    images: [
      {
        url: '/assets/images/fabrictrad-og.jpg',
        width: 1200,
        height: 630,
        alt: 'FabricTrad textile trading platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "FabricTrad — India's Textile Commerce Platform",
    description:
      'FabricTrad connects verified textile sellers with business and retail buyers for sourcing, catalogues, payments, orders and fulfilment.',
    images: ['/assets/images/fabrictrad-og.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-fabrictrad-release={PRODUCTION_UI_RELEASE}>
      <head>
        <meta name="fabrictrad-release" content={PRODUCTION_UI_RELEASE} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{localStorage.setItem('fabrictrad:theme','light');document.documentElement.classList.remove('dark');document.documentElement.dataset.theme='light';document.documentElement.style.colorScheme='light';}catch(e){document.documentElement.classList.remove('dark');document.documentElement.dataset.theme='light';document.documentElement.style.colorScheme='light';}})();`,
          }}
        />
      </head>
      <body className="ft-root">
        <AuthProvider>
          <AppPreferencesProvider>
            <RouteExperienceEnhancer />
            <AppClientEnhancements />
            <PageContinuity />
            <PublicHowToUseNavigation />
            <SitewideLanguageControl />
            {children}
          </AppPreferencesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
