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
  /** Glossy shimmer sweep across the logo artwork. Default on — pass false for
   * dense contexts (e.g. a tiny inline icon) where the animation would just be noise. */
  shine?: boolean;
}

/**
 * `darkSrc` is a recolour of the same artwork for dark backgrounds: the navy
 * wordmark sits at luminance ~20-50, which is invisible against the dark theme,
 * so it is lifted to a cool near-white while the gold (already legible) is left
 * untouched. Both files ship and CSS picks one, so the swap happens in the same
 * paint as the pre-hydration theme script and never flashes an unreadable logo.
 */
const OFFICIAL_LOGOS: Record<LogoVariant, { src: string; darkSrc?: string; width: number; height: number }> = {
  horizontal: {
    src: '/assets/brand/fabrictrad-logo-horizontal.png',
    darkSrc: '/assets/brand/fabrictrad-logo-horizontal-dark.png',
    width: 984,
    height: 220,
  },
  full: {
    src: '/assets/brand/fabrictrad-logo-full.png',
    width: 789,
    height: 608,
  },
  icon: {
    src: '/assets/brand/fabrictrad-app-icon-512.png',
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
  shine = true,
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
  const resolvedSrc = src || official.src;
  const shineStyle = shine ? ({ '--ft-logo-mask': `url(${resolvedSrc})` } as React.CSSProperties) : undefined;

  return (
    <div
      className={containerClassName}
      onClick={onClick || authenticatedHome ? handleClick : undefined}
      data-fabrictrad-brand-logo="official-uploaded-logo"
      data-fabrictrad-logo-variant={variant}
    >
      <div className={shine ? 'ft-logo-shine-wrap' : undefined} style={shineStyle}>
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
          <>
            <img
              src={official.src}
              alt="FabricTrad — Textile Trading Platform"
              width={renderedWidth}
              height={size}
              loading="eager"
              decoding="async"
              className={`block max-w-none shrink-0 object-contain${official.darkSrc ? ' ft-logo-img--light' : ''}`}
              style={{ width: `${renderedWidth}px`, height: `${size}px` }}
            />
            {official.darkSrc && (
              <img
                src={official.darkSrc}
                alt=""
                aria-hidden="true"
                width={renderedWidth}
                height={size}
                loading="eager"
                decoding="async"
                className="ft-logo-img--dark block max-w-none shrink-0 object-contain"
                style={{ width: `${renderedWidth}px`, height: `${size}px` }}
              />
            )}
          </>
        )}
        {shine && <span className="ft-logo-shine-sweep" aria-hidden="true" />}
      </div>
    </div>
  );
});

export default AppLogo;
