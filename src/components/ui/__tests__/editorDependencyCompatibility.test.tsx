// ABOUTME: Guards stored rich-text compatibility while keeping the active editor on one TipTap family.
// ABOUTME: Uses real editor schemas and the mounted production component, not mocked extension imports.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { CompatibleTableCell as TableCell } from '../extensions/compatible-table-cell';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { UnifiedCanvasEditor } from '../unified-canvas-editor';
import { sanitizeHTML } from '@/utils/sanitize';

const STORED_HTML = '<h2 style="text-align: center">Stored heading</h2>' +
  '<p><span style="color: #ff0000"><span style="font-weight: bold">Nested inherited</span></span>' +
  ' <mark data-color="#ffff00" style="background-color: #ffff00">Highlight</mark></p>' +
  '<table><tbody><tr><th colspan="2" colwidth="100,150"><p>Merged header</p></th></tr>' +
  '<tr><td rowspan="2" colwidth="100"><p>Spanning cell</p></td><td colwidth="150"><p>Cell B</p></td></tr>' +
  '<tr><td colwidth="150"><p>Cell C</p></td></tr></tbody></table>';

const editors: Editor[] = [];
function load(content: string) {
  const editor = new Editor({
    extensions: [StarterKit, TextStyle.configure({ mergeNestedSpanStyles: true }), Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }), Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }), TableRow, TableHeader, TableCell],
    content,
  });
  editors.push(editor);
  return editor;
}
afterEach(() => { while (editors.length) editors.pop()!.destroy(); });

describe('editor dependency compatibility', () => {
  it('preserves stored table geometry and styled text through sanitize, save and reload', () => {
    const first = load(STORED_HTML);
    const saved = sanitizeHTML(first.getHTML());
    const second = load(saved);
    expect(second.getJSON()).toEqual(first.getJSON());
    const html = document.createElement('div');
    html.innerHTML = second.getHTML();
    expect(html.querySelector('h2')).toHaveStyle({ textAlign: 'center' });
    expect(html.querySelector('th')).toHaveAttribute('colspan', '2');
    expect(html.querySelector('th')).toHaveAttribute('colwidth', '100,150');
    expect(html.querySelector('td')).toHaveAttribute('rowspan', '2');
    expect(html.querySelector('td')).toHaveAttribute('colwidth', '100');
    expect(html.querySelector('mark')).toHaveStyle({ backgroundColor: 'rgb(255, 255, 0)' });
    const styledText = Array.from(html.querySelectorAll('span')).find((span) => span.textContent === 'Nested inherited');
    expect(styledText).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(html.querySelector('strong')).toHaveTextContent('Nested inherited');
    expect(html.textContent).toContain('Cell C');
    expect(sanitizeHTML(second.getHTML())).toBe(saved);
  });

  it('keeps inherited nested-span color in the actual rendered learner surface', async () => {
    render(<UnifiedCanvasEditor content={STORED_HTML} onChange={() => {}} readOnly showAdvancedFeatures />);
    const nested = await screen.findByText('Nested inherited');
    const colored = nested.closest('span') ?? nested.querySelector('span');
    expect(colored).not.toBeNull();
    expect(colored).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(screen.getByRole('columnheader', { name: 'Merged header' })).toHaveAttribute('colwidth', '100,150');
  });

  it('inserts a header table and retains edited column widths on reload', () => {
    const editor = load('<p></p>');
    expect(editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true })).toBe(true);
    expect(editor.commands.setCellAttribute('colwidth', [140])).toBe(true);
    const saved = sanitizeHTML(editor.getHTML());
    expect(saved).toContain('<th');
    expect(saved).toContain('colwidth="140"');
    expect(load(saved).getJSON()).toEqual(editor.getJSON());
  });

  it('preserves the existing colgroup fallback and its explicit-cell-width precedence', () => {
    const original = load('<table><colgroup><col width="90"><col width="180"></colgroup><tbody>' +
      '<tr><td><p>First</p></td><td><p>Inherited</p></td></tr>' +
      '<tr><td><p>Another first</p></td><td colwidth="250"><p>Explicit</p></td></tr>' +
      '</tbody></table>');
    const cells: Array<number[] | null> = [];
    original.state.doc.descendants((node) => { if (node.type.name === 'tableCell') cells.push(node.attrs.colwidth); });
    // This intentionally retains v3.6.5's index-zero omission; it is not a new importer.
    expect(cells).toEqual([null, [180], null, [250]]);
    expect(load(sanitizeHTML(original.getHTML())).getJSON()).toEqual(original.getJSON());
  });

  it('does not introduce a colgroup fallback for header cells or CSS-only widths', () => {
    const headers = load('<table><colgroup><col width="90"><col width="180"></colgroup><tbody>' +
      '<tr><th><p>First header</p></th><th><p>Second header</p></th></tr></tbody></table>');
    const headerWidths: Array<number[] | null> = [];
    headers.state.doc.descendants((node) => { if (node.type.name === 'tableHeader') headerWidths.push(node.attrs.colwidth); });
    // The second header has an attribute-backed column at a nonzero index:
    // applying the cell fallback to headers would incorrectly produce [180].
    expect(headerWidths).toEqual([null, null]);

    const editor = load('<table><colgroup><col width="90"><col style="width:180px"></colgroup><tbody>' +
      '<tr><th><p>First header</p></th><th><p>Second header</p></th></tr>' +
      '<tr><td><p>First cell</p></td><td><p>CSS-only cell</p></td></tr></tbody></table>');
    const widths: Array<number[] | null> = [];
    editor.state.doc.descendants((node) => { if (['tableCell', 'tableHeader'].includes(node.type.name)) widths.push(node.attrs.colwidth); });
    expect(widths).toEqual([null, null, null, null]);
  });

  it('syncs changed external content without emitting a user-edit callback', async () => {
    const onChange = vi.fn();
    const view = render(<UnifiedCanvasEditor content="<p>Initial content</p>" onChange={onChange} />);
    await screen.findByText('Initial content');
    view.rerender(<UnifiedCanvasEditor content="<h2>External replacement</h2>" onChange={onChange} />);
    await screen.findByRole('heading', { name: 'External replacement' });
    await waitFor(() => expect(screen.queryByText('Initial content')).toBeNull());
    expect(onChange).not.toHaveBeenCalled();
  });
});
