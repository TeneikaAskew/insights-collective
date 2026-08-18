// ABOUTME: Invokes an Edge Function with the long rate-limit waits made visible.
// ABOUTME: Wraps invokeWithBackoff and narrates each wait through a toast.
//
// The waiting itself is in src/lib/rateLimitRetry.ts; this only makes it
// legible. That matters more than it sounds: the waits are a minute and then
// two, and a UI that just sat there would be indistinguishable from a hang.
// The user needs to know the request is alive, why it is slow, and that it will
// resume without them doing anything.

import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { invokeWithBackoff, describeWait } from '@/lib/rateLimitRetry';

export function useRateLimitedInvoke() {
  const { toast } = useToast();

  return useCallback(
    <T = unknown>(functionName: string, body?: unknown): Promise<T> =>
      invokeWithBackoff<T>(functionName, {
        body,
        onWait: ({ waitMs, remaining }) => {
          toast({
            title: 'Rate limit reached',
            description:
              `The AI model's per-minute budget is full. Retrying in ${describeWait(waitMs)}` +
              (remaining > 0 ? ` — ${remaining + 1} attempts left.` : ' — last attempt.'),
            // Outlast the wait, so the explanation is still on screen when the
            // user looks up. A toast that vanished after 5s would leave them
            // staring at a spinner with the reason already gone.
            duration: waitMs,
          });
        },
        onRetry: () => {
          toast({ title: 'Retrying now', description: 'Sending your request again.' });
        },
      }),
    [toast],
  );
}
