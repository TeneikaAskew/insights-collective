// ABOUTME: Preserves the existing v3.6.5 table-cell width import behavior on the coherent v2 editor.
// ABOUTME: Keeps the stored schema and explicit colwidth priority; this is not a new table importer.
import { TableCell } from '@tiptap/extension-table-cell';
import type { Attributes } from '@tiptap/core';

// Behavioral reference (MIT):
// https://github.com/ueberdosis/tiptap/blob/v3.6.5/packages/extension-table/src/cell/table-cell.ts
// Preserve its physical-sibling indexing, including no fallback for index zero.
// Do not add CSS-width parsing or span-aware indexing in a dependency repair.
function existingCellWidth(element: HTMLElement): number[] | null {
  const explicit = element.getAttribute('colwidth');
  if (explicit) return explicit.split(',').map((width) => parseInt(width, 10));

  const index = Array.from(element.parentElement?.children ?? []).indexOf(element);
  if (index <= 0) return null;
  const column = element.closest('table')?.querySelectorAll('colgroup > col').item(index);
  const width = column?.getAttribute('width');
  return width ? [parseInt(width, 10)] : null;
}

export const CompatibleTableCell = TableCell.extend({
  addAttributes() {
    const attributes: Attributes = this.parent?.() ?? {};
    return {
      ...attributes,
      colwidth: { ...attributes.colwidth, parseHTML: existingCellWidth },
    };
  },
});
