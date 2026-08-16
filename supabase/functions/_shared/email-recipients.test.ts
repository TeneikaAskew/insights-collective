// ABOUTME: Spec for the dry-run recipient rule — the single decision that governs
// ABOUTME: whether a real person receives mail. Run: deno test --allow-env
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isDryRunRecipient } from './email-recipients.ts';

// Every account below was read from auth.users on the live project.
const SUPPRESSED = [
  'e2e-admin@insightscollective.org',
  'e2e-instructor@insightscollective.org',
  'e2e-member@insightscollective.org',
  'e2e-journeys@insightscollective.org',
  'e2e-claude-student@insightscollective.org',
  'test@insightscollective.org',
  'thomas.davis@example.com',
  'sarah.johnson@example.com',
  'michael.chen@example.com',
  'E2E-Member@InsightsCollective.org', // case must not open a hole
  ' e2e-member@insightscollective.org ', // nor stray whitespace
];

// Real people. A regression here mails nobody, which is the failure that matters.
const DELIVERED = [
  'msztee89@gmail.com',
  'student@insightscollective.org',
  'teneika@insightscollective.org',
  'contest@gmail.com', // contains "test" but is not a test account
  'greatest@gmail.com',
  'notme2e-member@x.org', // "e2e-" not at the start of the local part
  'real.e2e-fan@gmail.com',
];

Deno.test('test accounts never reach the provider', () => {
  for (const email of SUPPRESSED) {
    assertEquals(isDryRunRecipient(email), true, `${email} must be dry-run`);
  }
});

Deno.test('real accounts still receive mail', () => {
  for (const email of DELIVERED) {
    assertEquals(isDryRunRecipient(email), false, `${email} must be delivered`);
  }
});

Deno.test('missing or malformed addresses do not suppress delivery', () => {
  for (const email of [null, undefined, '', 'not-an-email', 'trailing@']) {
    assertEquals(isDryRunRecipient(email), false, `${email} should not be dry-run`);
  }
});
