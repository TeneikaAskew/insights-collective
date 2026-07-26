// ABOUTME: Shared CSV export helpers — RFC 4180 quoting + browser download.
// ABOUTME: Replaces several ad-hoc CSV builders across the admin surfaces.

// Quote every cell and double any embedded quotes so commas, quotes, and
// newlines in the data cannot break the CSV structure.
const escapeCell = (value: unknown): string => {
  const s = value == null ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
};

/** Build a CSV string from a header row and data rows, fully quoted. */
export const toCsv = (headers: string[], rows: unknown[][]): string => {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  return lines.join('\n');
};

/**
 * Trigger a client-side download of CSV built from headers + rows.
 * Uses a Blob (not a data: URI) so large exports and special characters work
 * reliably, and always revokes the object URL.
 */
export const downloadCsv = (
  filename: string,
  headers: string[],
  rows: unknown[][],
): void => {
  const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
