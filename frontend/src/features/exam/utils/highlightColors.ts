export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

export const HIGHLIGHT_COLORS: readonly HighlightColor[] = [
  'yellow',
  'green',
  'blue',
  'pink',
  'purple',
] as const;

export const DEFAULT_HIGHLIGHT_COLOR: HighlightColor = 'yellow';

export interface HighlightColorConfig {
  id: HighlightColor;
  label: string;
  hex: string;
  className: string;
  borderClassName: string;
}

export const HIGHLIGHT_COLOR_CONFIGS: Record<HighlightColor, HighlightColorConfig> = {
  yellow: {
    id: 'yellow',
    label: 'Vàng',
    hex: '#FEF08A',
    className: 'bg-yellow-200',
    borderClassName: 'border-[#EAB308]',
  },
  green: {
    id: 'green',
    label: 'Xanh lá',
    hex: '#BBF7D0',
    className: 'bg-green-200',
    borderClassName: 'border-[#22C55E]',
  },
  blue: {
    id: 'blue',
    label: 'Xanh dương',
    hex: '#BAE6FD',
    className: 'bg-sky-200',
    borderClassName: 'border-[#0EA5E9]',
  },
  pink: {
    id: 'pink',
    label: 'Hồng',
    hex: '#FBCFE8',
    className: 'bg-pink-200',
    borderClassName: 'border-[#EC4899]',
  },
  purple: {
    id: 'purple',
    label: 'Tím',
    hex: '#DDD6FE',
    className: 'bg-purple-200',
    borderClassName: 'border-[#A855F7]',
  },
};

export function isValidHighlightColor(color: unknown): color is HighlightColor {
  return typeof color === 'string' && HIGHLIGHT_COLORS.includes(color as HighlightColor);
}

export function getColorClassName(color: unknown): string {
  if (isValidHighlightColor(color)) {
    return HIGHLIGHT_COLOR_CONFIGS[color].className;
  }
  return HIGHLIGHT_COLOR_CONFIGS[DEFAULT_HIGHLIGHT_COLOR].className;
}
