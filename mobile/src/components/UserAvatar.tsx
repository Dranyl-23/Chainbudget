import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Image, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { API_URL } from '../lib/api';

const BACKEND_BASE = API_URL.replace(/\/api\/?$/, '');

export function formatAvatarUrl(uri?: string): string | undefined {
  if (!uri || typeof uri !== 'string') return undefined;
  const trimmed = uri.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  if (trimmed.startsWith('/uploads')) {
    return `${BACKEND_BASE}${trimmed}`;
  }
  if (trimmed.startsWith('uploads/')) {
    return `${BACKEND_BASE}/${trimmed}`;
  }
  if (trimmed.includes('localhost:5001') || trimmed.includes('127.0.0.1:5001')) {
    return trimmed.replace(/http:\/\/(localhost|127\.0\.0\.1):5001/, BACKEND_BASE);
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return undefined;
}

interface UserAvatarProps {
  avatarUrl?: string;
  displayName?: string;
  size?: number;
  borderRadius?: number;
  shape?: 'circle' | 'squircle';
  borderColor?: string;
  borderWidth?: number;
  backgroundColor?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  children?: React.ReactNode;
}

export default function UserAvatar({
  avatarUrl,
  displayName = 'User',
  size = 48,
  borderRadius,
  shape = 'circle',
  borderColor = 'transparent',
  borderWidth = 0,
  backgroundColor = 'rgba(147, 51, 234, 0.15)',
  textColor = '#9333EA',
  style,
  imageStyle,
  children,
}: UserAvatarProps) {
  const initialUri = useMemo(() => formatAvatarUrl(avatarUrl), [avatarUrl]);
  const [currentUri, setCurrentUri] = useState<string | undefined>(initialUri);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCurrentUri(formatAvatarUrl(avatarUrl));
    setHasError(false);
  }, [avatarUrl]);

  const handleError = () => {
    if (currentUri && currentUri.includes('gateway.pinata.cloud/ipfs/')) {
      // 1. Failover from rate-limited Pinata to public ipfs.io
      setCurrentUri(currentUri.replace('gateway.pinata.cloud/ipfs/', 'ipfs.io/ipfs/'));
    } else if (currentUri && currentUri.includes('ipfs.io/ipfs/')) {
      // 2. Failover to cloudflare-ipfs
      setCurrentUri(currentUri.replace('ipfs.io/ipfs/', 'cloudflare-ipfs.com/ipfs/'));
    } else if (currentUri && currentUri.includes('cloudflare-ipfs.com/ipfs/')) {
      // 3. Failover to dweb.link
      setCurrentUri(currentUri.replace('cloudflare-ipfs.com/ipfs/', 'dweb.link/ipfs/'));
    } else {
      // 4. Fallback to initials
      setHasError(true);
    }
  };

  const calculatedRadius =
    borderRadius !== undefined
      ? borderRadius
      : shape === 'circle'
      ? size / 2
      : Math.round(size * 0.3);

  const initials = useMemo(() => {
    const clean = (displayName || 'User').trim().replace(/\n/g, ' ');
    const parts = clean.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase() || 'U';
  }, [displayName]);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: calculatedRadius,
          borderColor,
          borderWidth,
          backgroundColor,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        },
        style,
      ]}
    >
      {currentUri && !hasError ? (
        <Image
          source={{ uri: currentUri }}
          style={[
            {
              width: '100%',
              height: '100%',
              borderRadius: calculatedRadius,
            },
            imageStyle,
          ]}
          resizeMode="cover"
          onError={handleError}
        />
      ) : (
        <Text
          style={{
            color: textColor,
            fontSize: Math.round(size * 0.38),
            fontWeight: '800',
            letterSpacing: 0.5,
            includeFontPadding: false,
          }}
          numberOfLines={1}
        >
          {initials}
        </Text>
      )}
      {children}
    </View>
  );
}
