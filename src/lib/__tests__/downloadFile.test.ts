// ABOUTME: Covers the file-delivery fallback — that a framed page or a browser
// ABOUTME: which ignores the download attribute gets a new tab instead of a
// ABOUTME: download that would be dropped silently, and that ordinary browsers
// ABOUTME: still get a real download.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deliverBlob, isFramed, supportsDownloadAttribute } from '../downloadFile';

const originalOpen = window.open;

describe('isFramed', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is false at the top level', () => {
    expect(isFramed()).toBe(false);
  });

  it('is true when window.top differs from window.self', () => {
    vi.spyOn(window, 'top', 'get').mockReturnValue({} as Window);
    expect(isFramed()).toBe(true);
  });

  it('treats an unreadable window.top as framed', () => {
    // Cross-origin framing throws on access. A throw is proof of framing, so it
    // must not be swallowed into "not framed" — that is the case where the
    // download silently disappears.
    vi.spyOn(window, 'top', 'get').mockImplementation(() => {
      throw new Error('Blocked a frame with origin from accessing a cross-origin frame.');
    });
    expect(isFramed()).toBe(true);
  });
});

describe('supportsDownloadAttribute', () => {
  // defineProperty, not spyOn: jsdom's navigator has no `maxTouchPoints` at
  // all, and spyOn refuses to stub a property that does not exist.
  const setAgent = (userAgent: string, platform = 'Linux x86_64', maxTouchPoints = 0) => {
    for (const [key, value] of Object.entries({ userAgent, platform, maxTouchPoints })) {
      Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
    }
  };

  afterEach(() => vi.restoreAllMocks());

  it('is true for a desktop browser', () => {
    setAgent('Mozilla/5.0 (X11; Linux x86_64) Chrome/147');
    expect(supportsDownloadAttribute()).toBe(true);
  });

  it('is false on iPhone, where the attribute exists but is ignored', () => {
    setAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605');
    expect(supportsDownloadAttribute()).toBe(false);
  });

  it('is false on an iPad reporting itself as a Mac', () => {
    // iPadOS 13+ sends a desktop Safari agent; the touch points are the tell.
    setAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', 'MacIntel', 5);
    expect(supportsDownloadAttribute()).toBe(false);
  });

  it('is true on a real Mac', () => {
    setAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', 'MacIntel', 0);
    expect(supportsDownloadAttribute()).toBe(true);
  });
});

describe('deliverBlob', () => {
  let created: string[] = [];

  beforeEach(() => {
    created = [];
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => {
        const url = `blob:mock-${created.length}`;
        created.push(url);
        return url;
      }),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    window.open = originalOpen;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('downloads normally at the top level in a capable browser', () => {
    const clicks: string[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLAnchorElement;
      if (tag === 'a') el.click = () => clicks.push(el.download);
      return el;
    });

    const method = deliverBlob(new Blob(['x'], { type: 'application/pdf' }), 'cert-ABC.pdf');

    expect(method).toBe('download');
    expect(clicks).toEqual(['cert-ABC.pdf']);
  });

  it('opens a new tab when framed, because a download there is discarded', () => {
    vi.spyOn(window, 'top', 'get').mockReturnValue({} as Window);
    const open = vi.fn(() => ({}) as Window);
    window.open = open as unknown as typeof window.open;

    const method = deliverBlob(new Blob(['x'], { type: 'application/pdf' }), 'cert-ABC.pdf');

    expect(method).toBe('new-tab');
    expect(open).toHaveBeenCalledWith('blob:mock-0', '_blank', 'noopener,noreferrer');
  });

  it('falls back to a download when the popup is blocked', () => {
    // Last resort rather than giving up: on some webviews the download does
    // land, and a blocked popup plus no download attempt is a dead end.
    vi.spyOn(window, 'top', 'get').mockReturnValue({} as Window);
    window.open = vi.fn(() => null) as unknown as typeof window.open;

    const clicks: string[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLAnchorElement;
      if (tag === 'a') el.click = () => clicks.push(el.download);
      return el;
    });

    const method = deliverBlob(new Blob(['x'], { type: 'application/pdf' }), 'cert-ABC.pdf');

    expect(method).toBe('download');
    expect(clicks).toEqual(['cert-ABC.pdf']);
  });

  it('does not revoke the object URL in the same tick', () => {
    // Revoking immediately cancels the navigation the URL was just handed to,
    // which is its own silent-failure mode.
    vi.useFakeTimers();
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLAnchorElement;
      if (tag === 'a') el.click = () => {};
      return el;
    });

    deliverBlob(new Blob(['x']), 'cert.pdf');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-0');
    vi.useRealTimers();
  });
});
