
import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Link, 
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "Start typing...",
  className
}) => {
  const [isPreview, setIsPreview] = useState(false);

  const insertFormat = (before: string, after: string = '') => {
    const textarea = document.querySelector('textarea[data-rich-text]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    const newText = value.substring(0, start) + 
                   before + selectedText + after + 
                   value.substring(end);
    
    onChange(newText);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length, 
        start + before.length + selectedText.length
      );
    }, 0);
  };

  const formatButtons = [
    { icon: Bold, action: () => insertFormat('**', '**'), title: 'Bold' },
    { icon: Italic, action: () => insertFormat('*', '*'), title: 'Italic' },
    { icon: Underline, action: () => insertFormat('<u>', '</u>'), title: 'Underline' },
    { icon: Heading1, action: () => insertFormat('# '), title: 'Heading 1' },
    { icon: Heading2, action: () => insertFormat('## '), title: 'Heading 2' },
    { icon: Heading3, action: () => insertFormat('### '), title: 'Heading 3' },
    { icon: List, action: () => insertFormat('- '), title: 'Bullet List' },
    { icon: ListOrdered, action: () => insertFormat('1. '), title: 'Numbered List' },
    { icon: Quote, action: () => insertFormat('> '), title: 'Quote' },
    { icon: Code, action: () => insertFormat('`', '`'), title: 'Inline Code' },
    { icon: Link, action: () => insertFormat('[', '](url)'), title: 'Link' },
  ];

  const renderPreview = (markdown: string) => {
    // Simple markdown to HTML converter
    let html = markdown
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-2">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mb-2">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-medium mb-2">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>')
      .replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-gray-300 pl-4 italic">$1</blockquote>')
      .replace(/^- (.*$)/gim, '<li class="ml-4">• $1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li class="ml-4">$1</li>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline" target="_blank">$1</a>')
      .replace(/\n/g, '<br>');

    return html;
  };

  return (
    <div className={cn("border rounded-lg", className)}>
      <div className="flex items-center justify-between p-2 border-b bg-gray-50">
        <div className="flex flex-wrap gap-1">
          {formatButtons.map((button, index) => {
            const Icon = button.icon;
            return (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={button.action}
                title={button.title}
                type="button"
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
        </div>
        <div className="flex gap-1">
          <Button
            variant={!isPreview ? "default" : "ghost"}
            size="sm"
            onClick={() => setIsPreview(false)}
            type="button"
          >
            Edit
          </Button>
          <Button
            variant={isPreview ? "default" : "ghost"}
            size="sm"
            onClick={() => setIsPreview(true)}
            type="button"
          >
            Preview
          </Button>
        </div>
      </div>
      
      <div className="p-4">
        {isPreview ? (
          <div 
            className="prose prose-sm max-w-none min-h-[200px]"
            dangerouslySetInnerHTML={{ __html: renderPreview(value) }}
          />
        ) : (
          <Textarea
            data-rich-text
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="border-0 resize-none focus:ring-0 min-h-[200px]"
            rows={8}
          />
        )}
      </div>
    </div>
  );
};

export default RichTextEditor;
