// ABOUTME: Resend plumbing shared by the notification senders — the API call,
// ABOUTME: sender-domain discovery, and HTML escaping.

const RESEND_API = 'https://api.resend.com';

// Resend is used directly (the key is a provider key, not a connector-gateway key).
export async function resend(path: string, init: RequestInit = {}) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) throw new Error('RESEND_API_KEY is not configured');
  const res = await fetch(`${RESEND_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`[${res.status}] ${text}`);
  return text ? JSON.parse(text) : {};
}

type ResendDomain = {
  id: string;
  name: string;
  status: string;
  records?: Array<{ record: string; name: string; type: string; value: string; status?: string }>;
};

// A domain sitting at `not_started` has never had its DNS checked. Kicking
// verification here means the first send after DNS is in place succeeds on its own,
// and the error we raise carries the exact records the operator still owes.
async function senderSetupHint(list: ResendDomain[]): Promise<string> {
  if (list.length === 0) return 'no sender domain has been added in Resend';
  const domain = list[0];
  const parts: string[] = [`${domain.name}:${domain.status}`];
  try {
    if (domain.status === 'not_started' || domain.status === 'failed') {
      await resend(`/domains/${domain.id}/verify`, { method: 'POST' });
      parts.push('verification requested');
    }
    const detail = (await resend(`/domains/${domain.id}`)) as ResendDomain;
    const records = (detail.records ?? [])
      .map((r) => `${r.type} ${r.name} -> ${r.value}`)
      .join(' | ');
    if (records) parts.push(`required DNS: ${records}`);
  } catch (e) {
    parts.push(`detail lookup failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  return parts.join('; ');
}

// The sender domain is whatever is verified in Resend, so it is discovered rather
// than hardcoded — a wrong `from` is a 403 that looks like a broken key.
let cachedFrom: string | null = null;
export async function resolveFrom(): Promise<string> {
  const override = Deno.env.get('NOTIFICATION_EMAIL_FROM');
  if (override) return override;
  if (cachedFrom) return cachedFrom;
  const domains = await resend('/domains');
  const list: ResendDomain[] = domains?.data ?? [];
  const verified = list.find((d) => d.status === 'verified');
  if (!verified) {
    throw new Error(`no verified sender domain in Resend (${await senderSetupHint(list)})`);
  }
  cachedFrom = `Insights Collective <notifications@${verified.name}>`;
  return cachedFrom;
}

export function appUrl(link: string | null): string {
  const base = (Deno.env.get('APP_BASE_URL') ?? 'https://insightscollective.org').replace(/\/$/, '');
  if (!link) return base;
  return `${base}${link.startsWith('/') ? '' : '/'}${link}`;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}
