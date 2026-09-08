'use client';

/* eslint-disable @next/next/no-img-element */

import React, { memo, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppImage from './AppImage';

type LogoVariant = 'horizontal' | 'full' | 'icon';

interface AppLogoProps {
  src?: string;
  iconName?: string;
  size?: number;
  className?: string;
  onClick?: () => void;
  variant?: LogoVariant;
}

const OFFICIAL_LOGOS: Record<LogoVariant, { src: string; width: number; height: number }> = {
  horizontal: {
    src: 'https://cdn.shopify.com/s/files/1/0841/4966/6010/files/fabrictrad-logo-horizontal.png?v=1788032519',
    width: 984,
    height: 220,
  },
  full: {
    src: 'https://cdn.shopify.com/s/files/1/0841/4966/6010/files/fabrictrad-logo-full.png?v=1788032530',
    width: 789,
    height: 608,
  },
  icon: {
    src: 'https://cdn.shopify.com/s/files/1/0841/4966/6010/files/fabrictrad-app-icon-512.png?v=1788032540',
    width: 512,
    height: 512,
  },
};

const AppLogo = memo(function AppLogo({
  src,
  size = 64,
  className = '',
  onClick,
  variant = 'horizontal',
}: AppLogoProps) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const authenticatedHome =
    user && profile
      ? profile.role === 'admin_staff' || profile.role === 'super_admin'
        ? '/admin-portal'
        : '/marketplace'
      : null;

  const containerClassName = useMemo(() => {
    const classes = ['flex items-center'];
    if (onClick || authenticatedHome) classes.push('cursor-pointer hover:opacity-80 transition-opacity');
    if (className) classes.push(className);
    return classes.join(' ');
  }, [authenticatedHome, onClick, className]);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (onClick) {
      onClick();
      return;
    }

    if (authenticatedHome) {
      event.preventDefault();
      router.push(authenticatedHome);
    }
  };

  const official = OFFICIAL_LOGOS[variant];
  const renderedWidth = Math.max(1, Math.round((size * official.width) / official.height));

  return (
    <div
      className={containerClassName}
      onClick={onClick || authenticatedHome ? handleClick : undefined}
      data-fabrictrad-brand-logo="official-uploaded-logo"
      data-fabrictrad-logo-variant={variant}
    >
      {src ? (
        <AppImage
          src={src}
          alt="FabricTrad"
          width={size}
          height={size}
          className="flex-shrink-0 object-contain"
          priority={true}
          unoptimized={src.startsWith('/assets/') || src.endsWith('.svg')}
        />
      ) : (
        <img
          src={official.src}
          alt="FabricTrad — Textile Trading Platform"
          width={renderedWidth}
          height={size}
          loading="eager"
          decoding="async"
          className="block max-w-none shrink-0 object-contain"
          style={{ width: `${renderedWidth}px`, height: `${size}px` }}
        />
      )}
    </div>
  );
});

export default AppLogo;
