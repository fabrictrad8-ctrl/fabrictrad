import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Fraunces, Public_Sans, IBM_Plex_Mono } from 'next/font/google';
import '../styles/tailwind.css';
import '../styles/font-fallback.css';
import '../styles/commerce-glass.css';
import '../styles/commerce-polish.css';
import '../styles/global-commerce.css';
import '../styles/orange-commerce.css';
import '../styles/premium-commerce.css';
import '../styles/marketplace-refinement.css';
import '../styles/header-reflow.css';
import '../styles/accessibility-target-fixes.css';
import '../styles/commerce-2026-redesign.css';
import '../styles/fabrictrad-future.css';
import '../styles/fabrictrad-ui-fixes.css';
import '../styles/fabrictrad-light-commerce.css';
import '../styles/commerce-ux-final.css';
import '../styles/human-ui-refinement.css';
import '../styles/public-nav-consistency.css';
import '../styles/ui-integrity-hotfix.css';
import '../styles/mobile-auth-hotfix.css';
import '../styles/sitewide-mobile-responsive.css';
import '../styles/site-motion-and-polish.css';
import '../styles/storefront-premium-redesign.css';
import '../styles/brand-identity-2026.css';
import '../styles/workspace-shell.css';
import '../styles/auth-shell.css';
import '../styles/site-header.css';
import '../styles/interaction-system.css';

import '../styles/liquid-glass.css';
import '../styles/mobile-native-feel.css';
import '../styles/scroll-motion.css';
import '../styles/announcement-ticker.css';
import '../styles/premium-accents.css';
import '../styles/ai-assistant-widget.css';
import '../styles/logo-shine.css';
import { AuthProvider } from '@/contexts/AuthContext';
import AppClientEnhancements from '@/components/AppClientEnhancements';
import RouteExperienceEnhancer from '@/components/RouteExperienceEnhancer';
import PageContinuity from '@/components/PageContinuity';
import PublicHowToUseNavigation from '@/components/PublicHowToUseNavigation';
import SitewideLanguageControl from '@/components/SitewideLanguageControl';
import PointerGlow from '@/components/PointerGlow';
import ScrollReveal from '@/components/ScrollReveal';
import EntranceAnimationCleanup from '@/components/EntranceAnimationCleanup';
import SitewideAnnouncementTicker from '@/components/SitewideAnnouncementTicker';
import { AppPreferencesProvider } from '@/contexts/AppPreferencesContext';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display-raw',
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
});
const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-sans-brand',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono-brand',
  weight: ['400', '500', '600'],
  display: 'swap',
});

const PRODUCTION_UI_RELEASE = 'fabrictrad-textile-showroom-2026-09-05';
const BRAND_ICON_192 = '/assets/brand/fabrictrad-app-icon-192.png';
const BRAND_ICON_512 = '/assets/brand/fabrictrad-app-icon-512.png';
const BRAND_APPLE_ICON = '/assets/brand/fabrictrad-apple-touch-icon.png';
const BRAND_SOCIAL_PREVIEW = '/assets/brand/fabrictrad-social-preview.jpg';

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
      { url: BRAND_ICON_192, sizes: '192x192', type: 'image/png' },
      { url: BRAND_ICON_512, sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: BRAND_APPLE_ICON, sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    siteName: 'FabricTrad',
    title: "FabricTrad — India's Textile Commerce Platform",
    description:
      'FabricTrad connects verified textile sellers with business and retail buyers for sourcing, catalogues, payments, orders and fulfilment.',
    images: [
      {
        url: BRAND_SOCIAL_PREVIEW,
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
    images: [BRAND_SOCIAL_PREVIEW],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      data-fabrictrad-release={PRODUCTION_UI_RELEASE}
      className={`${fraunces.variable} ${publicSans.variable} ${plexMono.variable}`}
    >
      <head>
        <meta name="fabrictrad-release" content={PRODUCTION_UI_RELEASE} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var stored=localStorage.getItem('fabrictrad:theme');var resolved=stored==='dark'?true:stored==='light'?false:window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',resolved);document.documentElement.dataset.theme=resolved?'dark':'light';document.documentElement.style.colorScheme=resolved?'dark':'light';}catch(e){}})();`,
          }}
        />
      </head>
      <body className="ft-root">
        <noscript>
          <style>{'.ft-reveal{opacity:1!important;transform:none!important;transition:none!important;}'}</style>
        </noscript>
        <AuthProvider>
          <AppPreferencesProvider>
            <AppClientEnhancements />
            <PointerGlow />
            <ScrollReveal />
            <EntranceAnimationCleanup />
            <SitewideAnnouncementTicker />
            <PageContinuity />
            <PublicHowToUseNavigation />
            <SitewideLanguageControl />
            <RouteExperienceEnhancer>{children}</RouteExperienceEnhancer>
          </AppPreferencesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
