import { describe, it, expect } from 'vitest';
import { applyIdOrder, createReorderSequencer } from '../reorderReconcile';

const L = (...ids: string[]) => ids.map((id) => ({ id }));
const ids = (l: Array<{ id: string }>) => l.map((x) => x.id).join(',');

describe('applyIdOrder', () => {
  it('reorders', () => expect(ids(applyIdOrder(L('a', 'b', 'c'), ['c', 'a', 'b']))).toBe('c,a,b'));
  it('skips unknown ids instead of leaving holes', () => expect(ids(applyIdOrder(L('a', 'b'), ['x', 'b', 'a']))).toBe('b,a'));
  it('keeps unlisted entries at the end in their order', () => expect(ids(applyIdOrder(L('a', 'b', 'c'), ['c']))).toBe('c,a,b'));
  it('ignores duplicate ids in the order', () => expect(ids(applyIdOrder(L('a', 'b'), ['b', 'b', 'a']))).toBe('b,a'));
});

describe('createReorderSequencer', () => {
  it('only the latest begin in a scope is latest; scopes are independent', () => {
    const s = createReorderSequencer();
    const a = s.begin('x');
    const b = s.begin('x');
    const c = s.begin('y');
    expect(s.isLatest('x', a)).toBe(false);
    expect(s.isLatest('x', b)).toBe(true);
    expect(s.isLatest('y', c)).toBe(true);
  });
});
