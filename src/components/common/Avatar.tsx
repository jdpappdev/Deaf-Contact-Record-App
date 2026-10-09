import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { User } from 'lucide-react';

interface AvatarProps {
  photoRef: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '72';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  photoRef,
  name,
  size = 'md',
  className = '',
}) => {
  const { loadPhotoUrl } = useApp();
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    let loadedBlobUrl: string | null = null;

    if (!photoRef) {
      setImgUrl(null);
      return;
    }

    setLoadError(false);
    loadPhotoUrl(photoRef).then((url) => {
      if (active) {
        loadedBlobUrl = url;
        setImgUrl(url);
      } else if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });

    return () => {
      active = false;
      if (loadedBlobUrl && loadedBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(loadedBlobUrl);
      }
    };
  }, [photoRef, loadPhotoUrl]);

  // Dimensions based on size
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl',
    '72': 'w-[72px] h-[72px] text-2xl',
  }[size];

  // Derive initials
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  if (imgUrl && !loadError) {
    return (
      <div
        className={`relative shrink-0 rounded-full overflow-hidden bg-slate-100 border border-[#E5E7EB] ${sizeClasses} ${className}`}
      >
        <img
          src={imgUrl}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setLoadError(true)}
          className="w-full h-full object-cover object-center block"
        />
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 rounded-full flex items-center justify-center font-semibold bg-slate-100 text-slate-700 border border-[#E5E7EB] select-none ${sizeClasses} ${className}`}
      aria-label={name}
    >
      {initials.length > 0 ? (
        <span>{initials}</span>
      ) : (
        <User className="w-1/2 h-1/2 text-slate-400" />
      )}
    </div>
  );
};
