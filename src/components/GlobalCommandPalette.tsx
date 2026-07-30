'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

type Command = {
  label: string;
  description: string;
  href: string;
  icon: string;
  search: string;
};

const publicCommands: Command[] = [
  {
    label: 'Marketplace',
    description: 'Browse fabrics, colours and sellers',
    href: '/marketplace',
    icon: 'ShoppingBagIcon',
    search: 'marketplace buy fabric product catalogue',
  },
  {
    label: 'Categories',
    description: 'Explore textile categories',
    href: '/categories',
    icon: 'Squares2X2Icon',
    search: 'categories collection textile types',
  },
  {
    label: 'Verified vendors',
    description: 'Find textile suppliers',
    href: '/vendors',
    icon: 'BuildingStorefrontIcon',
    search: 'vendor seller supplier business',
  },
  {
    label: 'AI Drape Studio',
    description: 'Preview fabric on a model or your photo',
    href: '/product-detail#drape-on',
    icon: 'SparklesIcon',
    search: 'ai drape virtual try on model photo',
  },
];

function accountCommands(canSell: boolean, isAdmin: boolean): Command[] {
  if (isAdmin) {
    return [
      {
        label: 'Admin dashboard',
        description: 'Open platform operations',
        href: '/admin-portal',
        icon: 'ChartPieIcon',
        search: 'admin dashboard operations',
      },
      {
        label: 'Manage sellers',
        description: 'Review seller accounts and verification',
        href: '/admin-portal?tab=sellers',
        icon: 'BuildingStorefrontIcon',
        search: 'admin sellers verification',
      },
      {
        label: 'Orders',
        description: 'Review marketplace orders',
        href: '/admin-portal?tab=orders',
        icon: 'ClipboardDocumentListIcon',
        search: 'admin orders purchases',
      },
      {
        label: 'Payments',
        description: 'Open payment operations',
        href: '/admin-portal?tab=payments',
        icon: 'CreditCardIcon',
        search: 'admin payments razorpay transactions',
      },
    ];
  }

  const buyer: Command[] = [
    {
      label: 'Buyer dashboard',
      description: 'Orders, tracking and sourcing',
      href: '/buyer-dashboard',
      icon: 'ChartBarSquareIcon',
      search: 'buyer dashboard overview',
    },
    {
      label: 'My purchases',
      description: 'Review orders and payment status',
      href: '/buyer-dashboard?tab=orders',
      icon: 'ShoppingBagIcon',
      search: 'buyer orders purchases payments',
    },
    {
      label: 'Track shipments',
      description: 'See delivery progress',
      href: '/buyer-dashboard?tab=tracking',
      icon: 'TruckIcon',
      search: 'tracking shipment delivery',
    },
    {
      label: 'Post a requirement',
      description: 'Request fabric from verified sellers',
      href: '/buyer-requirements',
      icon: 'MegaphoneIcon',
      search: 'requirement sourcing request fabric',
    },
  ];

  if (!canSell) {
    return [
      ...buyer,
      {
        label: 'Start selling with GST',
        description: 'Activate seller tools on this account',
        href: '/seller-registration',
        icon: 'BuildingStorefrontIcon',
        search: 'sell gst vendor business activate',
      },
    ];
  }

  return [
    ...buyer,
    {
      label: 'Seller dashboard',
      description: 'Open your commerce workspace',
      href: '/seller-dashboard',
      icon: 'BuildingStorefrontIcon',
      search: 'seller dashboard business',
    },
    {
      label: 'Add product with AI',
      description: 'Create a catalogue from text and media',
      href: '/seller-dashboard?tab=upload',
      icon: 'SparklesIcon',
      search: 'add product catalogue ai upload',
    },
    {
      label: 'Products and inventory',
      description: 'Manage stock, variants and rates',
      href: '/seller-dashboard?tab=inventory',
      icon: 'ArchiveBoxIcon',
      search: 'products inventory stock variants rates',
    },
    {
      label: 'Seller order queue',
      description: 'Accept, reject and fulfil orders',
      href: '/seller-dashboard?tab=orders',
      icon: 'ClipboardDocumentListIcon',
      search: 'seller orders fulfilment queue',
    },
    {
      label: 'Earnings and payouts',
      description: 'Review revenue and settlements',
      href: '/seller-dashboard?tab=earnings',
      icon: 'BanknotesIcon',
      search: 'earnings payouts settlements revenue',
    },
  ];
}

export default function GlobalCommandPalette() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const canSell = Boolean(profile?.can_sell || profile?.role === 'seller');
  const isAdmin = profile?.role === 'admin_staff' || profile?.role === 'super_admin';

  const commands = useMemo(() => {
    const account = user
      ? accountCommands(canSell, isAdmin)
      : [
          {
            label: 'Sign in',
            description: 'Open your FabricTrad account',
            href: '/login',
            icon: 'ArrowRightOnRectangleIcon',
            search: 'login sign in account',
          },
          {
            label: 'Create account',
            description: 'Register to buy or sell',
            href: '/register',
            icon: 'UserPlusIcon',
            search: 'register create account signup',
          },
        ];
    return [...account, ...publicCommands];
  }, [canSell, isAdmin, user]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter((item) =>
      `${item.label} ${item.description} ${item.search}`.toLowerCase().includes(term)
    );
  }, [commands, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (!typing && event.key === '/') {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActive(0);
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => setActive(0), [query]);

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (results.length ? (index + 1) % results.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (results.length ? (index - 1 + results.length) % results.length : 0));
    } else if (event.key === 'Enter' && results[active]) {
      event.preventDefault();
      navigate(results[active].href);
    }
  };

  return (
    <>
      <button
        type="button"
        className="ft-command-trigger"
        onClick={() => setOpen(true)}
        aria-label="Open quick search"
      >
        <Icon name="MagnifyingGlassIcon" size={16} />
        <span>Quick search</span>
        <kbd>⌘K</kbd>
      </button>

      {open && (
        <div
          className="ft-command-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section className="ft-command" role="dialog" aria-modal="true" aria-label="Quick search">
            <div className="ft-command-search">
              <Icon name="MagnifyingGlassIcon" size={20} />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search pages and actions"
                aria-label="Search FabricTrad"
              />
              <button type="button" onClick={() => setOpen(false)}>Esc</button>
            </div>

            <div className="ft-command-results" role="listbox">
              {results.length ? (
                results.map((item, index) => (
                  <button
                    key={`${item.label}-${item.href}`}
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    data-active={index === active}
                    className="ft-command-item"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => navigate(item.href)}
                  >
                    <span className="ft-command-icon">
                      <Icon name={item.icon as 'HomeIcon'} size={17} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                    <Icon name="ArrowRightIcon" size={15} />
                  </button>
                ))
              ) : (
                <div className="ft-command-empty">No matching page or action</div>
              )}
            </div>

            <footer className="ft-command-footer">
              <span>↑↓ Navigate · Enter Open</span>
              <span>FabricTrad</span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
