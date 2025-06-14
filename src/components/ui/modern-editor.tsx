
import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Bold, Italic, Underline, Strikethrough, Code, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Quote, Link as LinkIcon, 
  Image, Heading1, Heading2, Heading3, Type,
  Undo, Redo, Eye, EyeOff
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface ModernEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export const ModernEditor: React.FC<ModernEditorProps> = ({
  value,
  onChange,
  placeholder = 'Start writing your content...',
  className = '',
  minHeight = '400px'
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [linkDialog, setLinkDialog] = useState(false);
  const [imageDialog, setImageDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null);

  const insertTextAtCursor = useCallback((text: string) => {
    if (!textareaRef) return;

    const start = textareaRef.selectionStart;
    const end = textareaRef.selectionEnd;
    const newValue = value.substring(0, start) + text + value.substring(end);
    onChange(newValue);

    // Set cursor position after inserted text
    setTimeout(() => {
      textareaRef.selectionStart = textareaRef.selectionEnd = start + text.length;
      textareaRef.focus();
    }, 0);
  }, [value, onChange, textareaRef]);

  const wrapSelectedText = useCallback((before: string, after: string = before) => {
    if (!textareaRef) return;

    const start = textareaRef.selectionStart;
    const end = textareaRef.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = before + selectedText + after;
    const newValue = value.substring(0, start) + newText + value.substring(end);
    onChange(newValue);

    // Set cursor position
    setTimeout(() => {
      if (selectedText) {
        textareaRef.selectionStart = start + before.length;
        textareaRef.selectionEnd = end + before.length;
      } else {
        textareaRef.selectionStart = textareaRef.selectionEnd = start + before.length;
      }
      textareaRef.focus();
    }, 0);
  }, [value, onChange, textareaRef]);

  const insertLink = useCallback(() => {
    if (linkUrl) {
      const linkMarkdown = `[${linkText || linkUrl}](${linkUrl})`;
      insertTextAtCursor(linkMarkdown);
      setLinkUrl('');
      setLinkText('');
      setLinkDialog(false);
    }
  }, [linkUrl, linkText, insertTextAtCursor]);

  const insertImage = useCallback(() => {
    if (imageUrl) {
      const imageMarkdown = `![${imageAlt}](${imageUrl})`;
      insertTextAtCursor(imageMarkdown);
      setImageUrl('');
      setImageAlt('');
      setImageDialog(false);
    }
  }, [imageUrl, imageAlt, insertTextAtCursor]);

  const renderPreview = useMemo(() => {
    // Simple markdown to HTML conversion for preview
    let html = value
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/~~(.*)~~/gim, '<del>$1</del>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<img src="$2" alt="$1" class="max-w-full h-auto" />')
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      .replace(/^(\d+)\. (.*$)/gim, '<li>$1. $2</li>')
      .replace(/\n/gim, '<br />');

    // Wrap consecutive <li> tags with <ul> or <ol>
    html = html.replace(/(<li>.*?<\/li>)/gis, '<ul>$1</ul>');
    html = html.replace(/(<li>\d+\..*?<\/li>)/gis, '<ol>$1</ol>');

    return html;
  }, [value]);

  const toolbarButtons = [
    {
      icon: Bold,
      action: () => wrapSelectedText('**'),
      title: 'Bold'
    },
    {
      icon: Italic,
      action: () => wrapSelectedText('*'),
      title: 'Italic'
    },
    {
      icon: Underline,
      action: () => wrapSelectedText('<u>', '</u>'),
      title: 'Underline'
    },
    {
      icon: Strikethrough,
      action: () => wrapSelectedText('~~'),
      title: 'Strikethrough'
    },
    {
      icon: Code,
      action: () => wrapSelectedText('`'),
      title: 'Inline Code'
    },
    null, // Separator
    {
      icon: Heading1,
      action: () => insertTextAtCursor('# '),
      title: 'Heading 1'
    },
    {
      icon: Heading2,
      action: () => insertTextAtCursor('## '),
      title: 'Heading 2'
    },
    {
      icon: Heading3,
      action: () => insertTextAtCursor('### '),
      title: 'Heading 3'
    },
    null, // Separator
    {
      icon: List,
      action: () => insertTextAtCursor('* '),
      title: 'Bullet List'
    },
    {
      icon: ListOrdered,
      action: () => insertTextAtCursor('1. '),
      title: 'Numbered List'
    },
    {
      icon: Quote,
      action: () => insertTextAtCursor('> '),
      title: 'Quote'
    },
    null, // Separator
    {
      icon: LinkIcon,
      action: () => setLinkDialog(true),
      title: 'Insert Link'
    },
    {
      icon: Image,
      action: () => setImageDialog(true),
      title: 'Insert Image'
    },
    null, // Separator
    {
      icon: showPreview ? EyeOff : Eye,
      action: () => setShowPreview(!showPreview),
      title: showPreview ? 'Hide Preview' : 'Show Preview'
    }
  ];

  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="border-b bg-muted/30 p-2">
        <div className="flex flex-wrap items-center gap-1">
          {toolbarButtons.map((button, index) => {
            if (button === null) {
              return <Separator key={index} orientation="vertical" className="h-6 mx-1" />;
            }
            
            const Icon = button.icon;
            return (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={button.action}
                title={button.title}
                className="h-8 w-8 p-0"
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex">
        {/* Editor */}
        <div className={showPreview ? 'w-1/2 border-r' : 'w-full'}>
          <Textarea
            ref={setTextareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="border-0 focus-visible:ring-0 resize-none rounded-none font-mono"
            style={{ minHeight }}
          />
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="w-1/2 p-4 overflow-y-auto" style={{ minHeight }}>
            <div 
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderPreview }}
            />
          </div>
        )}
      </div>

      {/* Link Dialog */}
      <Dialog open={linkDialog} onOpenChange={setLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="link-text">Link Text (optional)</Label>
              <Input
                id="link-text"
                placeholder="Link text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(false)}>
              Cancel
            </Button>
            <Button onClick={insertLink} disabled={!linkUrl}>
              Insert Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Dialog */}
      <Dialog open={imageDialog} onOpenChange={setImageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="image-url">Image URL</Label>
              <Input
                id="image-url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="image-alt">Alt Text</Label>
              <Input
                id="image-alt"
                placeholder="Image description"
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageDialog(false)}>
              Cancel
            </Button>
            <Button onClick={insertImage} disabled={!imageUrl}>
              Insert Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
