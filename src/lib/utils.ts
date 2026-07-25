import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a profile's first/last name into a single display string.
 * Returns 'Unknown' when neither name part is present.
 */
export function formatProfileName(
  profile?: { first_name?: string | null; last_name?: string | null } | null
): string {
  const name = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
  return name || 'Unknown';
}

/**
 * Converts a string to a URL-friendly slug
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}
