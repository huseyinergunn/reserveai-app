import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines clsx (conditional classes) with tailwind-merge (conflict resolution).
 * Use everywhere instead of raw string concatenation for Tailwind classes.
 *
 * Example:
 *   cn('px-4 py-2', isActive && 'bg-brand-500', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
