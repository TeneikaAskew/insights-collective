// ABOUTME: Ledger view over notification_email_log — every message the platform
// ABOUTME: handed to Resend, what it cost, and which ones were suppressed.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type LogRow = {
  id: string;
  created_at: string;
  recipient: string | null;
  status: string;
  provider_message_id: string | null;
  error: string | null;
  notification_id: string | null;
};

const RANGES = [
  { label: 'Today', days: 0 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
] as const;

// `sent` is the only status that costs quota. Keeping the distinction visible is
// the point of the page: a run that is entirely dry_run is a working test suite,
// not a broken mailer.
type BadgeVariant = 'success' | 'secondary' | 'destructive' | 'outline';
const STATUS_VARIANT: Record<string, BadgeVariant> = {
  sent: 'success',
  dry_run: 'secondary',
  failed: 'destructive',
};

function sinceIso(days: number): string {
  const d = new Date();
  if (days === 0) d.setUTCHours(0, 0, 0, 0);
  else d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export default function EmailLog() {
  const [rangeDays, setRangeDays] = useState<number>(7);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  const since = useMemo(() => sinceIso(rangeDays), [rangeDays]);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['notification-email-log', since, status],
    queryFn: async (): Promise<LogRow[]> => {
      let q = supabase
        .from('notification_email_log')
        .select('id, created_at, recipient, status, provider_message_id, error, notification_id')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);
      if (status !== 'all') q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter((r) => (r.recipient ?? '').toLowerCase().includes(term));
  }, [data, search]);

  const totals = useMemo(() => {
    const t = { sent: 0, dry_run: 0, failed: 0 };
    for (const r of data ?? []) if (r.status in t) t[r.status as keyof typeof t]++;
    return t;
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every notification email the platform has handed to the provider. Only{' '}
            <span className="font-medium">sent</span> spends daily quota.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCw className={cn('mr-2 h-4 w-4', isRefetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(['sent', 'dry_run', 'failed'] as const).map((key) => (
          <Card key={key}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {key === 'dry_run' ? 'Dry run (test accounts)' : key}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{totals[key]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRangeDays(r.days)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                rangeDays === r.days ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border p-0.5">
          {['all', 'sent', 'dry_run', 'failed'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                status === s ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
            >
              {s === 'dry_run' ? 'dry run' : s}
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by recipient"
            className="pl-9"
          />
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {(error as Error).message}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No email in this range.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Scrolls inside its own container so the admin shell never scrolls sideways */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">Recipient</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Kind</th>
                    <th className="px-4 py-3 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{r.recipient ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'} className="font-medium">
                          {r.status === 'dry_run' ? 'dry run' : r.status}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {/* A digest covers many notifications at once, so it carries
                            no single notification_id — that absence is the marker. */}
                        {r.notification_id ? 'single' : 'digest'}
                      </td>
                      <td className="max-w-[420px] px-4 py-3 text-muted-foreground">
                        {r.error ? (
                          <span className="text-destructive">{r.error}</span>
                        ) : (
                          <span className="font-mono text-xs">{r.provider_message_id ?? '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Showing up to 500 rows. A notification is emailed once: the digest stamps
        <code className="mx-1 rounded bg-muted px-1 py-0.5">email_digest_sent_at</code>
        when it covers one, and only unstamped rows are ever collected, so nothing here
        can be sent twice.
      </p>
    </div>
  );
}
