// ABOUTME: Right-side "Add content" tile grid for the Teachable-style lesson editor.
// ABOUTME: Each tile seeds a new lesson with a working starter template the instructor can edit.

import {
  FileText,
  Video,
  FileType2,
  Volume2,
  Image as ImageIcon,
  Paperclip,
  Code2,
  MonitorPlay,
  HelpCircle,
  MessageSquare,
  ShoppingCart,
  Gift,
} from 'lucide-react';
import type { ContentItemType } from '@/types/canvas';

interface AddContentPanelProps {
  onAdd: (type: ContentItemType, defaultTitle: string, defaultContent?: string) => void;
  onClose?: () => void;
}

interface Tile {
  label: string;
  icon: typeof FileText;
  type: ContentItemType;
  defaultTitle: string;
  defaultContent?: string;
  soon?: boolean;
}

// Starter templates — real, working markup that renders immediately and is
// easy to edit inline via the rich-text editor.
const VIDEO_TEMPLATE = `
<p><em>Replace the sample video below with your own YouTube or Vimeo embed URL.</em></p>
<div data-youtube-video>
  <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" height="315" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title="Lesson video"></iframe>
</div>
`.trim();

const PDF_TEMPLATE = `
<p><em>Replace the src below with a link to your PDF file (must be publicly accessible).</em></p>
<iframe src="https://mozilla.github.io/pdf.js/web/viewer.html" width="100%" height="600" frameborder="0" title="Lesson PDF"></iframe>
`.trim();

const AUDIO_TEMPLATE = `
<p><em>Paste an audio file URL (MP3, WAV, etc.) into the src below.</em></p>
<audio controls src="https://cdn.pixabay.com/download/audio/2022/03/15/audio_2ca7e1e5df.mp3?filename=lofi-study-112191.mp3"></audio>
`.trim();

const BANNER_TEMPLATE = `
<img src="https://placehold.co/1200x400/e2e8f0/475569?text=Your+banner+image" alt="Lesson banner" width="100%" />
<p><em>Replace the image src with your own banner (recommended 1200×400).</em></p>
`.trim();

const CODE_TEMPLATE = `
<p>Example:</p>
<pre><code>// Replace this with your code
function greet(name) {
  return \`Hello, \${name}!\`;
}
</code></pre>
`.trim();

const EMBED_TEMPLATE = `
<p><em>Paste an embed URL (Google Slides, Figma, CodePen, etc.) into the src below.</em></p>
<iframe src="https://codepen.io/team/codepen/embed/preview/PNaGbb" width="100%" height="480" frameborder="0" allowfullscreen title="Embedded media"></iframe>
`.trim();

const TEXT_TEMPLATE = `
<h2>Lesson title</h2>
<p>Start writing your lesson here. Use the toolbar to add headings, lists, links, images, and more.</p>
`.trim();

const RESOURCE_TEMPLATE = `
<p><em>Add the resource URL and a short description of what students will find there.</em></p>
<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">Open resource →</a></p>
`.trim();

const CONTENT_TILES: Tile[] = [
  { label: 'Text & Images', icon: FileText, type: 'page', defaultTitle: 'Text & Images', defaultContent: TEXT_TEMPLATE },
  { label: 'Video', icon: Video, type: 'page', defaultTitle: 'Video lesson', defaultContent: VIDEO_TEMPLATE },
  { label: 'PDF Viewer', icon: FileType2, type: 'page', defaultTitle: 'PDF lesson', defaultContent: PDF_TEMPLATE },
  { label: 'Audio', icon: Volume2, type: 'page', defaultTitle: 'Audio lesson', defaultContent: AUDIO_TEMPLATE },
  { label: 'Banner image', icon: ImageIcon, type: 'page', defaultTitle: 'Banner image', defaultContent: BANNER_TEMPLATE },
  { label: 'Resource', icon: Paperclip, type: 'page', defaultTitle: 'Resource', defaultContent: RESOURCE_TEMPLATE },
  { label: 'Code example', icon: Code2, type: 'page', defaultTitle: 'Code example', defaultContent: CODE_TEMPLATE },
  { label: 'Embed media', icon: MonitorPlay, type: 'page', defaultTitle: 'Embedded media', defaultContent: EMBED_TEMPLATE },
];

const EDU_TILES: Tile[] = [
  { label: 'Quiz', icon: HelpCircle, type: 'quiz', defaultTitle: 'New quiz' },
  { label: 'Open-ended', icon: MessageSquare, type: 'assignment', defaultTitle: 'Open-ended assignment' },
];

const MARKETING_TILES: Tile[] = [
  { label: 'Upsell', icon: ShoppingCart, type: 'page', defaultTitle: 'Upsell', soon: true },
  { label: 'Referrals', icon: Gift, type: 'page', defaultTitle: 'Referrals', soon: true },
];

export function AddContentPanel({ onAdd, onClose }: AddContentPanelProps) {
  return (
    <div
      className="bg-white rounded-xl p-5"
      style={{ border: '1px solid hsl(var(--tw-border))' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-2xl">Add content</h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-black text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      <TileSection title="Content" tiles={CONTENT_TILES} onAdd={onAdd} />
      <TileSection title="Educational tools" tiles={EDU_TILES} onAdd={onAdd} />
      <TileSection title="Marketing tools" tiles={MARKETING_TILES} onAdd={onAdd} />
    </div>
  );
}

function TileSection({
  title,
  tiles,
  onAdd,
}: {
  title: string;
  tiles: Tile[];
  onAdd: (type: ContentItemType, defaultTitle: string, defaultContent?: string) => void;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">
        {title}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map(({ label, icon: Icon, type, defaultTitle, defaultContent, soon }) => (
          <button
            key={label}
            type="button"
            disabled={soon}
            onClick={() => onAdd(type, defaultTitle, defaultContent)}
            className="aspect-square rounded-lg bg-white flex flex-col items-center justify-center gap-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ border: '1px solid hsl(var(--tw-border))' }}
            title={soon ? 'Coming soon' : `Add ${label}`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[11px] text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default AddContentPanel;
