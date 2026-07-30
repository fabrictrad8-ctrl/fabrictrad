'use client';

import React, { useState, useCallback, useMemo, memo } from 'react';
import Image, { type ImageProps } from 'next/image';

type NativeImageProps = Omit<
  ImageProps,
  | 'src'
  | 'alt'
  | 'width'
  | 'height'
  | 'fill'
  | 'className'
  | 'priority'
  | 'quality'
  | 'placeholder'
  | 'blurDataURL'
  | 'sizes'
  | 'onClick'
  | 'loading'
  | 'unoptimized'
>;

interface AppImageProps extends NativeImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  fill?: boolean;
  sizes?: string;
  onClick?: () => void;
  fallbackSrc?: string;
  loading?: 'lazy' | 'eager';
  unoptimized?: boolean;
}

const OPTIMIZED_REMOTE_HOSTS = new Set([
  'images.unsplash.com',
  'images.pexels.com',
  'images.pixabay.com',
  'img.rocket.new',
  'rdhfwlzhcvwjhkxhhpoo.supabase.co',
]);

function supportsOptimization(src: string) {
  if (!src.startsWith('http')) return true;
  try {
    return OPTIMIZED_REMOTE_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

const AppImage = memo(function AppImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality = 85,
  placeholder = 'empty',
  blurDataURL,
  fill = false,
  sizes,
  onClick,
  fallbackSrc = '/assets/images/no_image.png',
  loading = 'lazy',
  unoptimized = false,
  ...props
}: AppImageProps) {
  const [imageSrc, setImageSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const resolvedUnoptimized = useMemo(
    () => unoptimized || !supportsOptimization(imageSrc),
    [imageSrc, unoptimized]
  );

  const handleError = useCallback(() => {
    if (!hasError && imageSrc !== fallbackSrc) {
      setImageSrc(fallbackSrc);
      setHasError(true);
    }
    setIsLoading(false);
  }, [fallbackSrc, hasError, imageSrc]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const imageClassName = useMemo(() => {
    const classes = [className, 'transition-[opacity,filter] duration-200'];
    if (isLoading) classes.push('bg-muted opacity-70');
    if (onClick) classes.push('cursor-pointer hover:opacity-90');
    return classes.filter(Boolean).join(' ');
  }, [className, isLoading, onClick]);

  const commonProps = {
    src: imageSrc,
    alt,
    className: imageClassName,
    quality,
    placeholder,
    unoptimized: resolvedUnoptimized,
    onError: handleError,
    onLoad: handleLoad,
    onClick,
    ...(priority ? { priority: true } : { loading }),
    ...(blurDataURL && placeholder === 'blur' ? { blurDataURL } : {}),
    ...props,
  } satisfies Omit<ImageProps, 'width' | 'height' | 'fill'>;

  if (fill) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        <Image
          {...commonProps}
          fill
          sizes={sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'}
          style={{ objectFit: 'cover', ...commonProps.style }}
        />
      </div>
    );
  }

  return (
    <Image
      {...commonProps}
      width={width || 400}
      height={height || 300}
      sizes={sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px'}
    />
  );
});

AppImage.displayName = 'AppImage';

export default AppImage;
