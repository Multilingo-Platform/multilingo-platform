import React from 'react';

interface FlagIconProps {
  code: 'vi' | 'en' | 'gb' | string;
  size?: number;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * FlagIcon component providing vector SVGs for Vietnam and Great Britain.
 * Ensures cross-platform rendering across Windows, macOS, Linux, iOS, and Android
 * without relying on OS-level emoji fonts that render as letters (e.g., 'VN', 'GB') on Windows.
 */
export const FlagIcon: React.FC<FlagIconProps> = ({
  code,
  size,
  width,
  height,
  className = '',
  style = {},
}) => {
  const normalized = code.toLowerCase();

  // Mặc định tỷ lệ 4:3
  const computedWidth = width ?? (size ? size : 24);
  const computedHeight = height ?? (size ? Math.round((size * 3) / 4) : 18);

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: `${computedWidth}px`,
    height: `${computedHeight}px`,
    borderRadius: computedWidth >= 40 ? '6px' : '3px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.18)',
    verticalAlign: 'middle',
    flexShrink: 0,
    ...style,
  };

  if (normalized === 'vi') {
    return (
      <span
        className={`flag-icon flag-icon-vi ${className}`}
        style={containerStyle}
        role="img"
        aria-label="Cờ Việt Nam"
      >
        <svg
          viewBox="0 0 640 480"
          width="100%"
          height="100%"
          style={{ display: 'block' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="640" height="480" fill="#da251d" />
          <polygon
            points="320.0,96.0 352.3,195.5 457.0,195.5 372.3,257.0 404.6,356.5 320.0,295.0 235.4,356.5 267.7,257.0 183.0,195.5 287.7,195.5"
            fill="#FFFF00"
          />
        </svg>
      </span>
    );
  }

  if (normalized === 'en' || normalized === 'gb') {
    return (
      <span
        className={`flag-icon flag-icon-gb ${className}`}
        style={containerStyle}
        role="img"
        aria-label="Cờ Vương Quốc Anh"
      >
        <svg
          viewBox="0 0 640 480"
          width="100%"
          height="100%"
          style={{ display: 'block' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path fill="#012169" d="M0 0h640v480H0z" />
          <path
            fill="#FFF"
            d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0z"
          />
          <path
            fill="#C8102E"
            d="m424 281 216 159v40L369 281zm-184 20 6 35L54 480H0zM640 0v3L391 191l2-44L590 0zM0 0l239 176h-60L0 42z"
          />
          <path fill="#FFF" d="M241 0v480h160V0zM0 160v160h640V160z" />
          <path fill="#C8102E" d="M0 193v96h640v-96zM273 0v480h96V0z" />
        </svg>
      </span>
    );
  }

  return null;
};
