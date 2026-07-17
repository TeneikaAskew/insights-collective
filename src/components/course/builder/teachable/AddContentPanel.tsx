// ABOUTME: Right-side "Add content" tile grid for the Teachable-style lesson editor.
// ABOUTME: Only the four wired types (page, assignment, quiz, external_url) actually create lessons.

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
  onAdd: (type: ContentItemType, defaultTitle: string) => void;
  onClose?: () => void;
}

interface Tile {
  label: string;
  icon: typeof FileText;
  type: ContentItemType;
  defaultTitle: string;
  soon?: boolean;
}

const CONTENT_TILES: Tile[] = [
  { label: 'Text & Images', icon: FileText, type: 'page', defaultTitle: 'Text & Images' },
  { label: 'Video', icon: Video, type: 'page', defaultTitle: 'Video lesson' },
  { label: 'PDF Viewer', icon: FileType2, type: 'page', defaultTitle: 'PDF lesson' },
  { label: 'Audio', icon: Volume2, type: 'page', defaultTitle: 'Audio lesson' },
  { label: 'Banner image', icon: ImageIcon, type: 'page', defaultTitle: 'Banner image' },
  { label: 'Resource', icon: Paperclip, type: 'external_url', defaultTitle: 'Resource' },
  { label: 'Code example', icon: Code2, type: 'page', defaultTitle: 'Code example' },
  { label: 'Embed media', icon: MonitorPlay, type: 'page', defaultTitle: 'Embedded media' },
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
        <h3 className="tw-serif text-2xl">Add content</h3>
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
  onAdd: (type: ContentItemType, defaultTitle: string) => void;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">
        {title}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map(({ label, icon: Icon, type, defaultTitle, soon }) => (
          <button
            key={label}
            type="button"
            disabled={soon}
            onClick={() => onAdd(type, defaultTitle)}
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
