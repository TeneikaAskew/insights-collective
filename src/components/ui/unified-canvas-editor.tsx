// Unified Canvas-style rich content editor with all features
// This is the single editor to be used throughout the application

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Video from './extensions/video-extension';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Highlighter,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Type,
  Table as TableIcon,
  FileText,
  Calculator,
  Palette,
  Paperclip,
  MoreHorizontal,
  ChevronDown,
  Code2,
  Indent,
  Outdent,
  X,
  Save
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger 
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { sanitizeHtmlContent, isValidUrl } from '@/utils/securityUtils';
import { cn } from '@/lib/utils';
import { 

import { createLogger } from '@/utils/logger';

const logger = createLogger('UnifiedCanvasEditor');
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface UnifiedCanvasEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  maxHeight?: string;
  showAdvancedFeatures?: boolean;
  onFileUpload?: (file: File) => Promise<string>;
  readOnly?: boolean;
}

const fontSizes = [
  { value: '12px', label: '12px' },
  { value: '14px', label: '14px' },
  { value: '16px', label: '16px' },
  { value: '18px', label: '18px' },
  { value: '20px', label: '20px' },
  { value: '24px', label: '24px' },
  { value: '28px', label: '28px' },
  { value: '32px', label: '32px' },
  { value: '36px', label: '36px' },
];

const colors = [
  '#000000', '#424242', '#636363', '#9C9C94', '#CEC6CE', '#EFEFEF', '#F7F7F7', '#FFFFFF',
  '#FF0000', '#FF9900', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#9900FF', '#FF00FF',
  '#F4CCCC', '#FCE5CD', '#FFF2CC', '#D9EAD3', '#D0E0E3', '#CFE2F3', '#D9D2E9', '#EAD1DC',
];

export function UnifiedCanvasEditor({ 
  content, 
  onChange, 
  placeholder,
  className = '',
  minHeight = '400px',
  maxHeight = '800px',
  showAdvancedFeatures = true,
  onFileUpload,
  readOnly = false
}: UnifiedCanvasEditorProps) {
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [showMathDialog, setShowMathDialog] = useState(false);
  const [mathEquation, setMathEquation] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      TextStyle,
      Color,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Underline,
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-4',
        },
      }),
      Video.configure({
        allowFullscreen: true,
        HTMLAttributes: {
          class: 'w-full',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start writing your content...',
      }),
      ...(showAdvancedFeatures ? [
        Table.configure({
          resizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
      ] : []),
    ],
    content,
    onUpdate: ({ editor }) => {
      if (!readOnly) {
        const html = editor.getHTML();
        const sanitizedHtml = sanitizeHtmlContent(html);
        onChange(sanitizedHtml);
      }
    },
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-lg dark:prose-invert max-w-none focus:outline-none px-6 py-4',
          'overflow-auto',
          readOnly && 'cursor-default',
          className
        ),
        style: `min-height: ${minHeight}; max-height: ${maxHeight};`,
      },
    },
  });

  if (!editor) {
    return null;
  }

  const addLink = () => {
    if (linkUrl && isValidUrl(linkUrl)) {
      if (linkText) {
        editor.chain().focus().insertContent(`<a href="${linkUrl}">${linkText}</a>`).run();
      } else {
        editor.chain().focus().setLink({ href: linkUrl }).run();
      }
      setLinkUrl('');
      setLinkText('');
      setShowLinkDialog(false);
    }
  };

  const addImage = () => {
    if (imageUrl && isValidUrl(imageUrl)) {
      editor.chain().focus().setImage({ 
        src: imageUrl,
        alt: imageAlt || 'Image'
      }).run();
      setImageUrl('');
      setImageAlt('');
      setShowImageDialog(false);
    }
  };

  const addVideo = () => {
    if (videoUrl && isValidUrl(videoUrl)) {
      // Process video URL for embedding
      let embedUrl = videoUrl;
      
      // YouTube URL processing
      if (videoUrl.includes('youtube.com/watch?v=')) {
        const videoId = videoUrl.split('v=')[1]?.split('&')[0];
        embedUrl = `https://www.youtube.com/embed/${videoId}`;
      } else if (videoUrl.includes('youtu.be/')) {
        const videoId = videoUrl.split('youtu.be/')[1]?.split('?')[0];
        embedUrl = `https://www.youtube.com/embed/${videoId}`;
      } else if (videoUrl.includes('youtube.com/embed/')) {
        // Already an embed URL
        embedUrl = videoUrl;
      } else if (videoUrl.includes('vimeo.com/')) {
        const videoId = videoUrl.split('vimeo.com/')[1]?.split('?')[0];
        embedUrl = `https://player.vimeo.com/video/${videoId}`;
      }

      // Use the video extension command
      editor.chain().focus().setVideo({ src: embedUrl }).run();
      setVideoUrl('');
      setShowVideoDialog(false);
    }
  };

  const addTable = () => {
    editor.chain().focus().insertTable({ 
      rows: tableRows, 
      cols: tableCols, 
      withHeaderRow: true 
    }).run();
    setShowTableDialog(false);
    setTableRows(3);
    setTableCols(3);
  };

  const addMathEquation = () => {
    if (mathEquation) {
      // For now, we'll add as code block with math notation
      // In production, you'd integrate with MathJax or KaTeX
      const mathHtml = `<code class="math-equation">\\(${mathEquation}\\)</code>`;
      editor.chain().focus().insertContent(mathHtml).run();
      setMathEquation('');
      setShowMathDialog(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      try {
        const url = await onFileUpload(file);
        if (file.type.startsWith('image/')) {
          editor.chain().focus().setImage({ src: url, alt: file.name }).run();
        } else {
          // Insert as link for other file types
          editor.chain().focus().insertContent(
            `<a href="${url}" target="_blank">${file.name}</a>`
          ).run();
        }
      } catch (error) {
        logger.error('File upload failed:', error);
      }
    }
  };

  if (readOnly) {
    return (
      <div className={cn("border rounded-lg overflow-hidden bg-background", className)}>
        <EditorContent editor={editor} />
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Enhanced Toolbar */}
      <div className="border-b bg-muted/50 p-2 space-y-2">
        {/* First Row - Text Formatting */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* Font Style Dropdown */}
          <Select 
            value="paragraph" 
            onValueChange={(value) => {
              if (value === 'paragraph') editor.chain().focus().setParagraph().run();
              else if (value.startsWith('h')) {
                const level = parseInt(value.substring(1)) as 1 | 2 | 3 | 4 | 5 | 6;
                editor.chain().focus().toggleHeading({ level }).run();
              }
            }}
          >
            <SelectTrigger className="w-32 h-8">
              <SelectValue placeholder="Paragraph" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paragraph">Paragraph</SelectItem>
              <SelectItem value="h1">Heading 1</SelectItem>
              <SelectItem value="h2">Heading 2</SelectItem>
              <SelectItem value="h3">Heading 3</SelectItem>
              <SelectItem value="h4">Heading 4</SelectItem>
              <SelectItem value="h5">Heading 5</SelectItem>
              <SelectItem value="h6">Heading 6</SelectItem>
            </SelectContent>
          </Select>

          {/* Font Size */}
          <Select 
            value="16px" 
            onValueChange={(value) => {
              editor.chain().focus().setMark('textStyle', { fontSize: value }).run();
            }}
          >
            <SelectTrigger className="w-20 h-8">
              <SelectValue placeholder="16px" />
            </SelectTrigger>
            <SelectContent>
              {fontSizes.map(size => (
                <SelectItem key={size.value} value={size.value}>
                  {size.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="h-6" />

          {/* Text Formatting */}
          <Toggle
            size="sm"
            pressed={editor.isActive('bold')}
            onPressedChange={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('italic')}
            onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('underline')}
            onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('strike')}
            onPressedChange={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="h-4 w-4" />
          </Toggle>

          <Separator orientation="vertical" className="h-6" />

          {/* Color Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <Type className="h-4 w-4" />
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="grid grid-cols-8 gap-1">
                {colors.map(color => (
                  <button
                    key={color}
                    className="w-7 h-7 rounded border"
                    style={{ backgroundColor: color }}
                    onClick={() => editor.chain().focus().setColor(color).run()}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Highlight */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <Highlighter className="h-4 w-4" />
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="grid grid-cols-8 gap-1">
                {colors.map(color => (
                  <button
                    key={color}
                    className="w-7 h-7 rounded border"
                    style={{ backgroundColor: color }}
                    onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="h-6" />

          {/* Alignment */}
          <Toggle
            size="sm"
            pressed={editor.isActive({ textAlign: 'left' })}
            onPressedChange={() => editor.chain().focus().setTextAlign('left').run()}
          >
            <AlignLeft className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive({ textAlign: 'center' })}
            onPressedChange={() => editor.chain().focus().setTextAlign('center').run()}
          >
            <AlignCenter className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive({ textAlign: 'right' })}
            onPressedChange={() => editor.chain().focus().setTextAlign('right').run()}
          >
            <AlignRight className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive({ textAlign: 'justify' })}
            onPressedChange={() => editor.chain().focus().setTextAlign('justify').run()}
          >
            <AlignJustify className="h-4 w-4" />
          </Toggle>
        </div>

        {/* Second Row - Lists, Quotes, Media */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* Lists */}
          <Toggle
            size="sm"
            pressed={editor.isActive('bulletList')}
            onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('orderedList')}
            onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-4 w-4" />
          </Toggle>
          
          {/* Indent/Outdent */}
           <Button
             variant="ghost"
             size="sm"
             onClick={() => editor.chain().focus().run()}
             className="h-8 px-2"
           >
             <Indent className="h-4 w-4" />
           </Button>
           <Button
             variant="ghost"
             size="sm"
             onClick={() => editor.chain().focus().run()}
             className="h-8 px-2"
           >
             <Outdent className="h-4 w-4" />
           </Button>

          <Separator orientation="vertical" className="h-6" />

          {/* Quote and Code */}
          <Toggle
            size="sm"
            pressed={editor.isActive('blockquote')}
            onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('code')}
            onPressedChange={() => editor.chain().focus().toggleCode().run()}
          >
            <Code className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive('codeBlock')}
            onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            <Code2 className="h-4 w-4" />
          </Toggle>

          <Separator orientation="vertical" className="h-6" />

          {/* Media */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLinkDialog(true)}
            className="h-8 px-2"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowImageDialog(true)}
            className="h-8 px-2"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowVideoDialog(true)}
            className="h-8 px-2"
          >
            <VideoIcon className="h-4 w-4" />
          </Button>

          {/* Advanced Features */}
          {showAdvancedFeatures && (
            <>
              <Separator orientation="vertical" className="h-6" />
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTableDialog(true)}
                className="h-8 px-2"
              >
                <TableIcon className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMathDialog(true)}
                className="h-8 px-2"
              >
                <Calculator className="h-4 w-4" />
              </Button>
              
              {onFileUpload && (
                <>
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="h-8 px-2"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </>
              )}

              {/* More Options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => editor.chain().focus().clearNodes().run()}>
                    Clear Formatting
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().setHardBreak().run()}>
                    Hard Break
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                    Horizontal Rule
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <Separator orientation="vertical" className="h-6" />

          {/* Undo/Redo */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="h-8 px-2"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="h-8 px-2"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />

      {/* Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="link-text">Link Text (optional)</Label>
              <Input
                id="link-text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="My Link"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addLink}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Image</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="image-url">Image URL</Label>
              <Input
                id="image-url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="image-alt">Alt Text</Label>
              <Input
                id="image-alt"
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                placeholder="Image description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImageDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addImage}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Dialog */}
      <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Embed Video</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="video-url">Video URL</Label>
              <Input
                id="video-url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
              />
              <p className="text-sm text-muted-foreground">
                Supports YouTube, Vimeo, and direct video URLs
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVideoDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addVideo}>Embed</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Dialog */}
      {showAdvancedFeatures && (
        <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Insert Table</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="table-rows">Rows</Label>
                <Input
                  id="table-rows"
                  type="number"
                  min="1"
                  value={tableRows}
                  onChange={(e) => setTableRows(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="table-cols">Columns</Label>
                <Input
                  id="table-cols"
                  type="number"
                  min="1"
                  value={tableCols}
                  onChange={(e) => setTableCols(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTableDialog(false)}>
                Cancel
              </Button>
              <Button onClick={addTable}>Insert</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Math Dialog */}
      {showAdvancedFeatures && (
        <Dialog open={showMathDialog} onOpenChange={setShowMathDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Insert Math Equation</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="math-equation">LaTeX Equation</Label>
                <Input
                  id="math-equation"
                  value={mathEquation}
                  onChange={(e) => setMathEquation(e.target.value)}
                  placeholder="x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}"
                />
                <p className="text-sm text-muted-foreground">
                  Enter LaTeX math notation
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMathDialog(false)}>
                Cancel
              </Button>
              <Button onClick={addMathEquation}>Insert</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Export as default for easy migration
export default UnifiedCanvasEditor;