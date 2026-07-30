'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

const AUTH_PATH_PREFIXES = [
  '/login',
  '/admin-login',
  '/register',
  '/buyer-registration',
  '/seller-registration',
  '/auth',
];

const routeName = (pathname: string) => {
  if (pathname === '/') return 'home';
  return pathname
    .replace(/^\//, '')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-]/gi, '') || 'home';
};

type CommandItem = {
  label: string;
  description: string;
  href: string;
  icon: string;
  keywords: string;
};

export default function AppClientEnhancements() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState('');

  const isAuthenticationPage = AUTH_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  const commandEnabled = !loading && !!user && !!profile && !isAuthenticationPage;

  const commands = useMemo<CommandItem[]>(() => {
    const shared: CommandItem[] = [
      {
        label: 'Marketplace',
        description: 'Search fabrics, colours and verified sellers',
        href: '/marketplace',
        icon: 'MagnifyingGlassIcon',
        keywords: 'marketplace search products fabrics buy',
      },
      {
        label: 'My profile',
        description: 'Account, address, language and security',
        href: '/profile',
        icon: 'UserCircleIcon',
        keywords: 'profile account settings address security',
      },
      {
        label: 'Buyer requirements',
        description: 'Post or review sourcing requirements',
        href: '/buyer-requirements',
        icon: 'MegaphoneIcon',
        keywords: 'requirements sourcing request quote',
      },
    ];

    if (profile?.role === 'admin_staff' || profile?.role === 'super_admin') {
      return [
        {
          label: 'Admin dashboard',
          description: 'Platform operations and KPIs',
          href: '/admin-portal',
          icon: 'ChartPieIcon',
          keywords: 'admin dashboard overview',
        },
        {
          label: 'Seller verification',
          description: 'Review businesses, GST and documents',
          href: '/admin-portal?tab=sellers',
          icon: 'ShieldCheckIcon',
          keywords: 'seller verification gst approval',
        },
        {
          label: 'Orders and payments',
          description: 'Review orders, payment status and reconciliation',
          href: '/admin-portal?tab=orders',
          icon: 'ClipboardDocumentListIcon',
          keywords: 'orders payment reconciliation admin',
        },
        ...shared,
      ];
    }

    const buyerCommands: CommandItem[] = profile?.can_buy !== false
      ? [
          {
            label: 'Buyer dashboard',
            description: 'Orders, tracking, wishlist and purchasing',
            href: '/buyer-dashboard',
            icon: 'ShoppingBagIcon',
            keywords: 'buyer dashboard orders tracking wishlist',
          },
          {
            label: 'Company purchasing',
            description: 'Locations, PO rules, payment terms and reorders',
            href: '/buyer-dashboard?tab=company',
            icon: 'BuildingOffice2Icon',
            keywords: 'company purchasing locations po payment terms reorder',
          },
        ]
      : [];

    const sellerCommands: CommandItem[] = profile?.can_sell
      ? [
          {
            label: 'Seller dashboard',
            description: 'Orders, catalogue and fulfilment',
            href: '/seller-dashboard',
            icon: 'BuildingStorefrontIcon',
            keywords: 'seller dashboard orders fulfillment',
          },
          {
            label: 'Products and inventory',
            description: 'Manage products, stock and variants',
            href: '/seller-dashboard?tab=inventory',
            icon: 'ArchiveBoxIcon',
            keywords: 'inventory products stock variants',
          },
          {
            label: 'Catalogs and pricing',
            description: 'Quantity rules, price breaks and buyer catalogs',
            href: '/seller-dashboard?tab=catalogs',
            icon: 'TagIcon',
            keywords: 'catalog pricing wholesale quantity breaks',
          },
        ]
      : [];

    return [...buyerCommands, ...sellerCommands, ...shared];
  }, [profile]);

  const filteredCommands = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.description} ${command.keywords}`.toLowerCase().includes(needle)
    );
  }, [commands, query]);

  useEffect(() => {
    const name = routeName(pathname || '/');
    document.body.dataset.route = name;
    document.documentElement.dataset.route = name;
    return () => {
      delete document.body.dataset.route;
      delete document.documentElement.dataset.route;
    };
  }, [pathname]);

  useEffect(() => {
    if (!commandEnabled) {
      setCommandOpen(false);
      setQuery('');
    }
  }, [commandEnabled]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!commandEnabled) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
      if (event.key === 'Escape') setCommandOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commandEnabled]);

  useEffect(() => {
    if (!isAuthenticationPage) return;
    const removeLegacyQuickSearch = () => {
      document.querySelectorAll<HTMLElement>('button, a, [role="button"]').forEach((element) => {
        if (/^quick search/i.test((element.textContent || '').trim())) element.remove();
      });
    };
    removeLegacyQuickSearch();
    const observer = new MutationObserver(removeLegacyQuickSearch);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isAuthenticationPage]);

  const openCommand = (href: string) => {
    setCommandOpen(false);
    setQuery('');
    router.push(href);
  };

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          className:
            'text-sm !bg-card !text-foreground !border !border-primary/20 !rounded-xl !shadow-xl',
          success: { iconTheme: { primary: '#c8600a', secondary: '#ffffff' } },
        }}
      />

      {commandEnabled && (
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="ft-command-trigger"
          aria-label="Open workspace command center"
        >
          <Icon name="MagnifyingGlassIcon" size={15} />
          <span>Workspace search</span>
          <kbd>{typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
      )}

      {commandEnabled && commandOpen && (
        <div className="ft-command-backdrop" role="presentation" onMouseDown={() => setCommandOpen(false)}>
          <section
            className="ft-command-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Workspace command center"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="ft-command-search-row">
              <Icon name="MagnifyingGlassIcon" size={20} className="text-primary" />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pages and actions…"
                aria-label="Search workspace commands"
              />
              <kbd>Esc</kbd>
            </div>
            <div className="ft-command-results">
              {filteredCommands.length ? (
                filteredCommands.map((command) => (
                  <button key={`${command.label}-${command.href}`} type="button" onClick={() => openCommand(command.href)}>
                    <span className="ft-command-icon"><Icon name={command.icon} size={18} /></span>
                    <span className="min-w-0 flex-1 text-left">
                      <strong>{command.label}</strong>
                      <small>{command.description}</small>
                    </span>
                    <Icon name="ArrowRightIcon" size={15} className="text-muted-foreground" />
                  </button>
                ))
              ) : (
                <div className="ft-command-empty">
                  <Icon name="MagnifyingGlassIcon" size={24} />
                  <p>No matching workspace action</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}