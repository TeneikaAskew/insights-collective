import { describe, it, expect, vi } from 'vitest';
import { applyIdOrder, createReorderCoordinator } from '../reorderReconcile';

const L = (...ids: string[]) => ids.map((id) => ({ id }));
const ids = (l: Array<{ id: string }>) => l.map((x) => x.id).join(',');

describe('applyIdOrder', () => {
  it('reorders', () => expect(ids(applyIdOrder(L('a', 'b', 'c'), ['c', 'a', 'b']))).toBe('c,a,b'));
  it('skips unknown ids instead of leaving holes', () => expect(ids(applyIdOrder(L('a', 'b'), ['x', 'b', 'a']))).toBe('b,a'));
  it('keeps unlisted entries at the end in their order', () => expect(ids(applyIdOrder(L('a', 'b', 'c'), ['c']))).toBe('c,a,b'));
  it('ignores duplicate ids in the order', () => expect(ids(applyIdOrder(L('a', 'b'), ['b', 'b', 'a']))).toBe('b,a'));
});

describe('createReorderCoordinator', () => {
  function harness() {
    let shown = ['a', 'b', 'c'];
    const sends: string[] = [];
    const gates: Array<(ok: boolean) => void> = [];
    const req = {
      current: () => shown,
      apply: (o: string[]) => (shown = o),
      send: (o: string[]) =>
        new Promise<void>((res, rej) => {
          sends.push(o.join(','));
          gates.push((ok) => (ok ? res() : rej(new Error('no'))));
        }),
      reload: vi.fn(async () => ['a', 'b', 'c']),
      onFailed: vi.fn(),
    };
    return { req, sends, gates, shown: () => shown.join(',') };
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it('keeps one request in flight per scope and sends only the newest waiting order', async () => {
    const c = createReorderCoordinator();
    const h = harness();
    const p = c.request('s', ['b', 'a', 'c'], h.req);
    void c.request('s', ['c', 'a', 'b'], h.req);
    void c.request('s', ['c', 'b', 'a'], h.req);
    expect(h.sends).toEqual(['b,a,c']);
    expect(h.shown()).toBe('c,b,a');
    h.gates[0](true);
    await tick();
    expect(h.sends).toEqual(['b,a,c', 'c,b,a']);
    h.gates[1](true);
    await p;
    expect(h.shown()).toBe('c,b,a');
    expect(h.req.onFailed).not.toHaveBeenCalled();
  });

  it('a failed last request with a failed reload shows the last accepted order', async () => {
    const c = createReorderCoordinator();
    const h = harness();
    h.req.reload.mockRejectedValue(new Error('read'));
    const p = c.request('s', ['b', 'a', 'c'], h.req);
    void c.request('s', ['c', 'a', 'b'], h.req);
    h.gates[0](true);
    await tick();
    h.gates[1](false);
    await p;
    expect(h.shown()).toBe('b,a,c');
    expect(h.req.onFailed).toHaveBeenCalledWith(expect.any(Error), 'last-confirmed');
  });

  it('scopes are independent', async () => {
    const c = createReorderCoordinator();
    const h1 = harness();
    const h2 = harness();
    void c.request('x', ['b', 'a', 'c'], h1.req);
    void c.request('y', ['c', 'b', 'a'], h2.req);
    expect(h1.sends).toEqual(['b,a,c']);
    expect(h2.sends).toEqual(['c,b,a']);
  });
});
