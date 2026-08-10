// ABOUTME: One button that flips between light and dark. Sun means light is on
// ABOUTME: and a click makes it dark; moon means the reverse.

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * This was a dropdown of Light / Dark / System. Two of those were a menu's worth
 * of ceremony for a binary, and the third followed the OS rather than the choice
 * just made, which reads as the control being broken. A toggle needs no menu:
 * the icon states what you get by pressing it.
 */
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // next-themes is undefined on the server/first paint; render only after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="h-9 w-9" aria-hidden />;
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      data-testid="theme-toggle"
      // Names the destination, not the current state: a control read aloud as
      // "dark theme" is ambiguous about which side of the switch it describes.
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={isDark}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {/* Swapped by the `dark` class rather than by `isDark`, so the icon is
          already correct in the markup next-themes paints before React hydrates
          — a JS-driven swap flashes the wrong one for a frame. */}
      <Sun className="h-[1.1rem] w-[1.1rem] dark:hidden" />
      <Moon className="hidden h-[1.1rem] w-[1.1rem] dark:block" />
    </Button>
  );
}
