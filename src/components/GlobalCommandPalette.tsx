'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

type CommandItem = {
  label: string;
  description: string;
  href: string;
  icon: string;
  keywords: string[];
};

export default function GlobalCommandPalette() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const canSell = Boolean(profile?.can_sell || profile?.role === 'seller');
  const isAdmin = profile?.role === 'admin_staff' || profile?.role === 'super_admin';

  const commands = useMemo<CommandItem[]>(() => {
    const common: CommandItem[] = [
      {
        label: 'Home',
        description: 'Open the FabricTrad home page',
        href: '/',
        icon: 'HomeIcon',
        keywords: ['home', 'start'],
      },
      {
        label: 'Marketplace',
        description: 'Browse fabrics, colours and verified sellers',
        href: '/marketplace',
        icon: 'ShoppingBagIcon',
        keywords: ['marketplace', 'buy', 'fabric', 'products'],
      },
      {
        label: 'Categories',
        description: 'Explore textile categories',
        href: '/categories',
        icon: 'Squares2X2Icon',
        keywords: ['categories', 'collections', 'types'],
      },
      {
        label: 'Vendors',
        description: 'Find verified textile businesses',
        href: '/vendors',
        icon: 'BuildingStorefrontIcon',
        keywords: ['vendors', 'sellers', 'suppliers'],
      },
      {
        label: 'AI Drape Studio',
        description: 'Preview fabric on a model or uploaded photo',
        href: '/product-detail#drape-on',
        icon: 'SparklesIcon',
        keywords: ['ai', 'drape', 'virtual', 'try on'],
      },
    ];

    if (!user) {
      return [
        ...common,
        {
          label: 'Sign in',
          description: 'Open your FabricTrad account',
          href: '/login',
          icon: 'ArrowRightOnRectangleIcon',
          keywords: ['login', 'sign in', 'account'],
        },
        {
          label: 'Create account',
          description: 'Register to buy or sell',
          href: '/register',
          icon: 'UserPlusIcon',
          keywords: ['register', 'create', 'signup'],
        },
      ];
    }

    if (isAdmin) {
      return [
        ...common,
        {
          label: 'Admin dashboard',
          description: 'Open platform operations',
          href: '/admin-portal',
          icon: 'ChartPieIcon',
          keywords: ['admin', 'dashboard', 'operations'],
        },
        {
          label: 'Sellers',
          description: 'Review and manage sellers',
          href: '/admin-portal?tab=sellers',
          icon: 'BuildingStorefrontIcon',
          keywords: ['seller', 'vendors', 'verification'],
        },
        {
          label: 'Payments',
          description: 'Open payment operations',
          href: '/admin-portal?tab=payments',
          icon: 'CreditCardIcon',
          keywords: ['payments', 'razorpay', 'transactions'],
        },
        {
          label: 'Orders',
          description: 'Review marketplace orders',
          href: '/admin-portal?tab=orders',
          icon: 'ClipboardDocumentListIcon',
          keywords: ['orders', 'purchases'],
        },
      ];
    }

    const buyerCommands: CommandItem[] = [
      {
        label: 'Buyer dashboard',
        description: 'Open orders, tracking and sourcing tools',
        href: '/buyer-dashboard',
        icon: 'ChartBarSquareIcon',
        keywords: ['buyer', 'dashboard', 'overview'],
      },
      {
        label: 'My orders',
        description: 'Review purchases and payment status',
        href: '/buyer-dashboard?tab=orders',
        icon: 'ShoppingBagIcon',
        keywords: ['orders', 'purchases', 'payments'],
      },
      {
        label: 'Track shipments',
        description: 'See shipment progress',
        href: '/buyer-dashboard?tab=tracking',
        icon: 'TruckIcon',
        keywords: ['tracking', 'shipment', 'delivery'],
      },
      {
        label: 'Post requirement',
        description: 'Request a fabric from verified sellers',
        href: '/buyer-requirements',
        icon: 'MegaphoneIcon',
        keywords: ['requirement', 'request', 'source'],
      },
      {
        label: 'Profile and verification',
        description: 'Manage account, phone and business details',
        href: '/profile',
        icon: 'UserCircleIcon',
        keywords: ['profile', 'account', 'verification'],
      },
    ];

    const sellerCommands: CommandItem[] = canSell
      ? [
          {
            label: 'Seller dashboard',
            description: 'Open your commerce workspace',
            href: '/seller-dashboard',
            icon: 'BuildingStorefrontIcon',
            keywords: ['seller', 'dashboard', 'business'],
          },
          {
            label: 'Add product with AI',
            description: 'Create a catalogue from text and media',
            href: '/seller-dashboard?tab=upload',
            icon: 'SparklesIcon',
            keywords: ['add', 'product', 'catalog', 'ai', 'upload'],
          },
          {
            label: 'Products and inventory',
            description: 'Manage fabrics, stock and pricing',
            href: '/seller-dashboard?tab=inventory',
            icon: 'ArchiveBoxIcon',
            keywords: ['products', 'inventory', 'stock'],
          },
          {
            label: 'Seller order queue',
            description: 'Accept, reject and fulfil orders',
            href: '/seller-dashboard?tab=orders',
            icon: 'ClipboardDocumentListIcon',
            keywords: ['seller orders', 'fulfilment', 'queue'],
          },
          {
            label: 'Earnings and payouts',
            description: 'Review revenue and settlements',
            href: '/seller-dashboard?tab=earnings',
            icon: 'BanknotesIcon',
            keywords: ['earnings', 'payouts', 'settlements'],
          },
        ]
      : [
          {
            label: 'Start selling with GST',
            description: 'Activate seller tools on this account',
            href: '/seller-registration',
            icon: 'BuildingStorefrontIcon',
            keywords: ['sell', 'gst', 'vendor', 'business'],
          },
        ];

    return [...common, ...buyerCommands, ...sellerCommands];
  }, [canSell, isAdmin, user]);

  const filteredCommands = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) =>
      [command.label, command.description, ...command.keywords]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [commands, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inTextField =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }

      if (!inTextField && event.key === '/') {
        event.preventDefault();
        setOpen(true);
        return;
      }

      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) =>
        filteredCommands.length ? (current + 1) % filteredCommands.length : 0
      );
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) =>
        filteredCommands.length
          ? (current - 1 + filteredCommands.length) % filteredCommands.length
          : 0
      );
    }
    if (event.key === 'Enter' && filteredCommands[activeIndex]) {
      event.preventDefault();
      navigate(filteredCommands[activeIndex].href);
    }
  };

  return (
    <>
      <button
        type="button"
        className="command-palette-trigger"
        onClick={() => setOpen(true)}
        aria-label="Open quick search"
      >
        <Icon name="MagnifyingGlassIcon" size={16} />
        <span>Quick search</span>
        <kbd>⌘K</kbd>
      </button>

      {open && (
        <div
          className="command-palette-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="FabricTrad quick search"
          >
            <div className="command-palette-search">
              <Icon name="MagnifyingGlassIcon" size={20} className="text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search pages, products and actions"
                aria-label="Search FabricTrad"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border bg-muted px-2 py-1 text-xs font-700 text-muted-foreground"
              >
                Esc
              </button>
            </div>

            <div className="command-palette-results" role="listbox">
              {filteredCommands.length ? (
                filteredCommands.map((command, index) => (
                  <button
                    key={`${command.label}-${command.href}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    data-active={index === activeIndex}
                    className="command-palette-item"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => navigate(command.href)}
                  >
                    <span className="command-palette-item-icon">
                      <Icon name={command.icon as 'HomeIcon'} size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-800 text-foreground">
                        {command.label}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {command.description}
                      </span>
                    </span>
                    <Icon name="ArrowRightIcon" size={15} className="text-muted-foreground" />
                  </button>
                ))
              ) : (
                <div className="command-palette-empty">
                  <Icon name="MagnifyingGlassIcon" size={24} className="mx-auto mb-2" />
                  No matching page or action
                </div>
              )}
            </div>

            <footer className="command-palette-footer">
              <span>↑↓ Navigate · Enter Open</span>
              <span>FabricTrad command search</span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
