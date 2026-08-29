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

const AppLogo = memo(function AppLogo({
  src = '/assets/images/fabrictrad-symbol.webp',
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
          unoptimized={src.endsWith('.svg')}
        />
      ) : (
        <AppIcon name={iconName} size={size} className="flex-shrink-0" />
      )}
    </div>
  );
});

export default AppLogo;
