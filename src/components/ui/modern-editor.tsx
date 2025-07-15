
import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Bold, Italic, Underline, Strikethrough, Code, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Quote, Link as LinkIcon, 
  Image, Heading1, Heading2, Heading3, Type,
  Undo, Redo, Eye, EyeOff, Video
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
  const [videoDialog, setVideoDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
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

  const insertVideo = useCallback(() => {
    if (videoUrl) {
      // Convert YouTube URLs to proper embed format and create custom video markdown
      let processedUrl = videoUrl;
      
      // Handle different YouTube URL formats
      if (videoUrl.includes('youtube.com/watch?v=')) {
        const videoId = videoUrl.split('v=')[1]?.split('&')[0];
        processedUrl = `https://www.youtube.com/embed/${videoId}`;
      } else if (videoUrl.includes('youtu.be/')) {
        const videoId = videoUrl.split('youtu.be/')[1]?.split('?')[0];
        processedUrl = `https://www.youtube.com/embed/${videoId}`;
      } else if (videoUrl.includes('youtube.com/embed/')) {
        processedUrl = videoUrl;
      }
      
      const videoMarkdown = `[VIDEO:${processedUrl}]`;
      insertTextAtCursor(videoMarkdown);
      setVideoUrl('');
      setVideoDialog(false);
    }
  }, [videoUrl, insertTextAtCursor]);

  const getEmbedUrl = (url: string): string | null => {
    if (!url || typeof url !== 'string') {
      return null;
    }
    
    const cleanUrl = url.trim();
    
    // YouTube - multiple formats supported
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?/;
    const youtubeMatch = cleanUrl.match(youtubeRegex);
    
    if (youtubeMatch && youtubeMatch[1]) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }

    // Vimeo
    const vimeoRegex = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)(?:\S+)?/;
    const vimeoMatch = cleanUrl.match(vimeoRegex);
    
    if (vimeoMatch && vimeoMatch[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    // Direct video URLs (for uploaded content)
    const directVideoMatch = cleanUrl.match(/\.(mp4|webm|ogg|avi|mov)(\?.*)?$/i);
    
    if (directVideoMatch) {
      return cleanUrl;
    }

    // If it's already an embed URL, return as is
    if (cleanUrl.includes('youtube.com/embed/') || cleanUrl.includes('player.vimeo.com/video/')) {
      return cleanUrl;
    }

    return null;
  };

  const renderVideoEmbed = (videoUrl: string): string => {
    const embedUrl = getEmbedUrl(videoUrl);
    if (embedUrl) {
      // Check if it's a direct video file
      if (embedUrl.match(/\.(mp4|webm|ogg|avi|mov)(\?.*)?$/i)) {
        return `<div class="mb-4">
          <video 
            src="${embedUrl}" 
            controls 
            class="w-full rounded-lg"
            style="max-width: 100%; height: auto;"
          >
            Your browser does not support the video tag.
          </video>
        </div>`;
      } else {
        // It's an embed (YouTube, Vimeo, etc.)
        return `<div class="aspect-video mb-4">
          <iframe 
            src="${embedUrl}" 
            class="w-full h-full rounded-lg" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen
          ></iframe>
        </div>`;
      }
    }
    return `<div class="p-4 bg-gray-100 rounded-lg mb-4 text-center text-gray-500">
      <p>Invalid video URL: ${videoUrl}</p>
      <p class="text-sm">Supported formats: YouTube, Vimeo, MP4, WebM, OGG</p>
    </div>`;
  };

  const renderPreview = useMemo(() => {
    // Simple markdown to HTML conversion for preview
    let html = value
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-medium mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4">$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/~~(.*?)~~/gim, '<del>$1</del>')
      .replace(/`([^`]+)`/gim, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')
      .replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-primary/20 pl-4 italic">$1</blockquote>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-4" />')
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      .replace(/^(\d+)\. (.*$)/gim, '<li>$1. $2</li>');

    // Process video embeds with comprehensive video support
    html = html.replace(/\[VIDEO:([^\]]+)\]/gim, (match, videoUrl) => {
      return renderVideoEmbed(videoUrl);
    });

    html = html.replace(/\n/gim, '<br />');

    // Wrap consecutive <li> tags with <ul> or <ol>
    html = html.replace(/(<li>.*?<\/li>)/gis, '<ul class="list-disc list-inside my-4">$1</ul>');
    html = html.replace(/(<li>\d+\..*?<\/li>)/gis, '<ol class="list-decimal list-inside my-4">$1</ol>');

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
    {
      icon: Video,
      action: () => setVideoDialog(true),
      title: 'Insert Video'
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

      {/* Video Dialog */}
      <Dialog open={videoDialog} onOpenChange={setVideoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Video</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="video-url">Video URL</Label>
              <Input
                id="video-url"
                placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Supports YouTube URLs in any format
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVideoDialog(false)}>
              Cancel
            </Button>
            <Button onClick={insertVideo} disabled={!videoUrl}>
              Insert Video
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
