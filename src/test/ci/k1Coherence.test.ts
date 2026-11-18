import { describe, it, expect } from 'vitest';
import { storedOutlineProblems } from '../../../scripts/builder-authoring-fixture/k1-oracle.mjs';
function fixture() {
  const lesson: Record<string, any> = { id: 'lesson', course_id: 'course', module_id: 'module', title: 'Lesson', type: 'text', position: 0, content: { a: 1, b: [2] } };
  return { mods: [{ id: 'module', course_id: 'course', title: 'Section', position: 0 }], itemsByCourse: [lesson], itemsByModule: [structuredClone(lesson)] };
}
const expected: any[] = [['Section', 0, [['Lesson', 'text', 0, { a: 1, b: [2] }]]]];
describe('K1 cross-read coherence', () => {
  it.each([['title', 'Changed'], ['type', 'quiz'], ['position', 4], ['content', { a: 9 }], ['module_id', 'foreign'], ['course_id', 'foreign']])('rejects inconsistent %s', (field, value) => {
    const rows = fixture(); rows.itemsByModule[0][field] = value;
    const before = structuredClone(rows);
    expect(storedOutlineProblems(rows, expected)).toContain('LINK');
    expect(rows).toEqual(before);
  });
  it('accepts coherent content with reordered JSON keys without mutation', () => {
    const rows = fixture(); rows.itemsByModule[0].content = { b: [2], a: 1 };
    const before = structuredClone(rows);
    expect(storedOutlineProblems(rows, expected)).toEqual([]);
    expect(rows).toEqual(before);
  });
  it('accepts differently ordered read rows', () => {
    const rows = fixture(); const second = { ...rows.itemsByCourse[0], id: 'second', title: 'Second', position: 1 };
    rows.itemsByCourse.push(second); rows.itemsByModule.unshift(structuredClone(second));
    expect(storedOutlineProblems(rows, [['Section', 0, [...expected[0][2], ['Second', 'text', 1, second.content]]]])).toEqual([]);
  });
  it('preserves valid null content', () => {
    const rows = fixture(); rows.itemsByCourse[0].content = null; rows.itemsByModule[0].content = null;
    expect(storedOutlineProblems(rows, [['Section', 0, [['Lesson', 'text', 0, null]]]])).toEqual([]);
  });
  it('accepts an empty outline', () => {
    expect(storedOutlineProblems({ mods: [], itemsByCourse: [], itemsByModule: [] }, [])).toEqual([]);
  });
});
