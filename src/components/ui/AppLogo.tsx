'use client';

import React, { memo, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppIcon from './AppIcon';
import AppImage from './AppImage';

interface AppLogoProps {
  src?: string; // Image source (optional)
  iconName?: string; // Icon name when no image
  size?: number; // Size for icon/image
  className?: string; // Additional classes
  onClick?: () => void; // Click handler
}

const BRAND_LOGO_SRC = '/assets/images/app_logo.png?v=fabrictrad-brand-20260829-2';

const AppLogo = memo(function AppLogo({
  src = BRAND_LOGO_SRC,
  iconName = 'SparklesIcon',
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

  const isLocalBrandAsset = src.startsWith('/assets/images/app_logo.png');

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
          unoptimized={isLocalBrandAsset || src.endsWith('.svg')}
        />
      ) : (
        <AppIcon name={iconName} size={size} className="flex-shrink-0" />
      )}
    </div>
  );
});

export default AppLogo;
