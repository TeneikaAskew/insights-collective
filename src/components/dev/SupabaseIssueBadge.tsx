// ABOUTME: Dev-only badge that makes failed Supabase queries impossible to miss.
// ABOUTME: Excluded from production builds by an import.meta.env.DEV guard.
//
// A failed query currently renders as an empty list. Nothing on screen says the
// difference between "no results" and "the request returned 42703", which is how
// three broken pages shipped. This puts the count in the corner while you build,
// where it is cheapest to notice.

import React from 'react';
import { supabaseIssues, onSupabaseIssue, type SupabaseIssue } from '@/integrations/supabase/instrumentation';

const KIND_LABEL: Record<SupabaseIssue['kind'], string> = {
  error: 'failed',
  'empty-write': 'wrote nothing',
  'bad-filter': 'undefined filter',
};

export const SupabaseIssueBadge: React.FC = () => {
  const [issues, setIssues] = React.useState<SupabaseIssue[]>(() => [...supabaseIssues]);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => onSupabaseIssue(() => setIssues([...supabaseIssues])), []);

  if (!issues.length) return null;

  return (
    <div
      style={{ position: 'fixed', bottom: 12, left: 12, zIndex: 2147483647, fontFamily: 'ui-monospace, monospace' }}
    >
      {open && (
        <div
          style={{
            maxHeight: '50vh', maxWidth: 'min(46rem, 92vw)', overflow: 'auto', marginBottom: 8,
            background: '#1b1113', color: '#ffd9d2', border: '1px solid #7a3a30', borderRadius: 6,
            padding: '10px 12px', fontSize: 12, lineHeight: 1.5,
            boxShadow: '0 10px 30px -10px rgba(0,0,0,.6)',
          }}
        >
          {issues.map((issue, i) => (
            <div key={i} style={{ paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid #40211c' }}>
              <div style={{ color: '#ff9b8a', fontWeight: 700 }}>
                {issue.method} {issue.target} — {KIND_LABEL[issue.kind]}
                {issue.code ? ` (${issue.code})` : ''}
              </div>
              {issue.message && <div style={{ opacity: 0.9 }}>{issue.message}</div>}
              {issue.select && <div style={{ opacity: 0.7 }}>select: {issue.select}</div>}
              <div style={{ opacity: 0.55 }}>on {issue.route}</div>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: '#8a2f22', color: '#fff', border: 0, borderRadius: 999,
          padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {issues.length} failed {issues.length === 1 ? 'query' : 'queries'}
      </button>
    </div>
  );
};

export default SupabaseIssueBadge;
