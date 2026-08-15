// ABOUTME: Decides which recipients get a real provider send and which are recorded
// ABOUTME: as a dry run, so test traffic never spends Resend quota.

// The E2E suite drives the live project through real accounts, and the seeded
// fixtures sit on RFC 2606 reserved domains that hard-bounce by definition. Both
// spend daily quota on mail nobody reads, and the bounces additionally cost sender
// reputation. Anything not matched here — including the operator's own account —
// gets a real send.
const RESERVED_DOMAINS = new Set(['example.com', 'example.org', 'example.net']);
const RESERVED_TLDS = ['.test', '.invalid', '.localhost', '.example'];

// Exact addresses, comma-separated. The suite reads its accounts from
// E2E_*_EMAIL, so an operator can point it at addresses that do not follow the
// e2e- convention and suppress them here without a code change.
function configuredRecipients(): Set<string> {
  return new Set(
    (Deno.env.get('EMAIL_DRY_RUN_RECIPIENTS') ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isDryRunRecipient(email: string | null | undefined): boolean {
  if (!email) return false;
  const address = email.trim().toLowerCase();
  // Split on the last '@' so a quoted local part cannot smuggle in a domain.
  const at = address.lastIndexOf('@');
  if (at < 1 || at === address.length - 1) return false;
  const local = address.slice(0, at);
  const domain = address.slice(at + 1);

  if (configuredRecipients().has(address)) return true;
  if (RESERVED_DOMAINS.has(domain)) return true;
  if (RESERVED_TLDS.some((tld) => domain.endsWith(tld))) return true;
  return local === 'e2e' || local.startsWith('e2e-') || local === 'test' || local.startsWith('test-');
}
