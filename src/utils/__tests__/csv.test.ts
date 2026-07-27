import { describe, it, expect, vi, afterEach } from 'vitest';
import { toCsv, downloadCsv } from '../csv';

describe('toCsv', () => {
  it('quotes every cell and joins with commas', () => {
    expect(toCsv(['A', 'B'], [['1', '2']])).toBe('"A","B"\n"1","2"');
  });

  it('escapes embedded quotes by doubling them', () => {
    expect(toCsv(['H'], [['a "quoted" value']])).toBe('"H"\n"a ""quoted"" value"');
  });

  it('keeps commas and newlines inside a single quoted cell', () => {
    const csv = toCsv(['H'], [['a,b\nc']]);
    expect(csv).toBe('"H"\n"a,b\nc"');
  });

  it('renders null/undefined as empty quoted cells', () => {
    expect(toCsv(['A', 'B'], [[null, undefined]])).toBe('"A","B"\n"",""');
  });
});

describe('downloadCsv', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a blob download with the given filename and revokes the url', () => {
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    (URL as any).createObjectURL = createObjectURL;
    (URL as any).revokeObjectURL = revokeObjectURL;

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadCsv('out.csv', ['A'], [['1']]);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});
