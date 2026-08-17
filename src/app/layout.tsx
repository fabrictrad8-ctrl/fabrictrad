import React from 'react';
import type { Metadata, Viewport } from 'next';
import '../styles/tailwind.css';
import '../styles/shopify-glass.css';
import '../styles/commerce-polish.css';
import '../styles/global-commerce.css';
import '../styles/orange-commerce.css';
import '../styles/premium-commerce.css';
import '../styles/marketplace-refinement.css';
import '../styles/header-reflow.css';
import '../styles/site-motion-and-polish.css';
import '../styles/accessibility-target-fixes.css';
import { AuthProvider } from '@/contexts/AuthContext';
import AppClientEnhancements from '@/components/AppClientEnhancements';
import RouteExperienceEnhancer from '@/components/RouteExperienceEnhancer';
import { AppPreferencesProvider } from '@/contexts/AppPreferencesContext';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f4f5' },
    { media: '(prefers-color-scheme: dark)', color: '#111827' },
  ],
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
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('fabrictrad:theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
      </head>
      <body className="ft-root">
        <AuthProvider>
          <AppPreferencesProvider>
            <RouteExperienceEnhancer />
            <AppClientEnhancements />
            {children}
          </AppPreferencesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
