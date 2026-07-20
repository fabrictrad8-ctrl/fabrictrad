import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import '../styles/tailwind.css';
import { AuthProvider } from '@/contexts/AuthContext';
import AppClientEnhancements from '@/components/AppClientEnhancements';
import { AppPreferencesProvider } from '@/contexts/AppPreferencesContext';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: "FabricTrad — India's B2B Textile Marketplace",
  description:
    'FabricTrad connects verified textile sellers with business buyers for bulk fabric sourcing with AI-automated catalog upload and end-to-end shipment tracking.',
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
    <html lang="en" suppressHydrationWarning className={plusJakartaSans.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('fabrictrad:theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
      </head>
      <body className={plusJakartaSans.className}>
        <AuthProvider>
          <AppPreferencesProvider>
            <AppClientEnhancements />
            {children}
          </AppPreferencesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
