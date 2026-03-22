import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COMMON_FRACTIONS: [number, string][] = [
  [1 / 8, '1/8'],
  [1 / 4, '1/4'],
  [1 / 3, '1/3'],
  [3 / 8, '3/8'],
  [1 / 2, '1/2'],
  [5 / 8, '5/8'],
  [2 / 3, '2/3'],
  [3 / 4, '3/4'],
  [7 / 8, '7/8'],
];

/**
 * Converts a leading decimal quantity in an ingredient string to a readable fraction.
 * e.g. "0.66666668653488 cup flour" → "2/3 cup flour"
 * e.g. "1.5 cups sugar" → "1 1/2 cups sugar"
 */
export function formatIngredient(text: string): string {
  const match = text.match(/^(\d*\.\d+)(.*)/);
  if (!match) return text;

  const num = parseFloat(match[1]);
  const rest = match[2];
  const whole = Math.floor(num);
  const frac = num - whole;

  if (frac < 0.01) return whole > 0 ? `${whole}${rest}` : text;

  let bestFrac: string | null = null;
  let bestDiff = 0.02;
  for (const [val, str] of COMMON_FRACTIONS) {
    const diff = Math.abs(frac - val);
    if (diff < bestDiff) { bestDiff = diff; bestFrac = str; }
  }

  if (!bestFrac) return text;
  const prefix = whole > 0 ? `${whole} ${bestFrac}` : bestFrac;
  return prefix + rest;
}
