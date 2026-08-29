'use client';

import React, { memo, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppImage from './AppImage';

interface AppLogoProps {
  src?: string;
  iconName?: string;
  size?: number;
  className?: string;
  onClick?: () => void;
}

interface BrandMarkProps {
  size: number;
}

/**
 * FabricTrad's default mark is deliberately inline SVG instead of a public image
 * asset. This keeps the primary navigation brand visible even if a static asset
 * is stale, missing, incorrectly encoded, or cached by the edge.
 *
 * The mark combines a fabric roll/bolt with an upward trade arrow.
 */
function BrandMark({ size }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="FabricTrad"
      data-fabrictrad-brand-mark="fabric-roll-trade-arrow"
      className="block shrink-0"
    >
      <rect x="1" y="1" width="46" height="46" rx="13" fill="#FFF7ED" stroke="#FED7AA" strokeWidth="1.5" />

      {/* Fabric bolt */}
      <path
        d="M13.5 28.5V18.75C13.5 15.57 16.07 13 19.25 13H29.5"
        stroke="#17324D"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 34.5C22.31 34.5 25 31.81 25 28.5C25 25.19 22.31 22.5 19 22.5C15.69 22.5 13 25.19 13 28.5C13 31.81 15.69 34.5 19 34.5Z"
        fill="white"
        stroke="#17324D"
        strokeWidth="3"
      />
      <circle cx="19" cy="28.5" r="2.25" fill="#F97316" />
      <path
        d="M24.75 28.5H29.5C33.09 28.5 36 25.59 36 22V17"
        stroke="#17324D"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Trade / growth arrow */}
      <path
        d="M29.75 18.25L36 12L41 17"
        stroke="#F97316"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M36 12V21.25"
        stroke="#F97316"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

const AppLogo = memo(function AppLogo({
  src,
  size = 64,
  className = '',
  onClick,
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

  return (
    <div
      className={containerClassName}
      onClick={onClick || authenticatedHome ? handleClick : undefined}
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
        <BrandMark size={size} />
      )}
    </div>
  );
});

export default AppLogo;
