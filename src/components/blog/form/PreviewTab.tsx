
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Calendar, Clock, Eye } from 'lucide-react';

interface PreviewTabProps {
  title: string;
  content: string;
  imageUrl?: string;
}

export function PreviewTab({ title, content, imageUrl }: PreviewTabProps) {
  const renderContent = useMemo(() => {
    // Simple markdown to HTML conversion
    let html = content
      .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mb-3 mt-6">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mb-4 mt-8">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mb-6 mt-10">$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em class="italic">$1</em>')
      .replace(/~~(.*?)~~/gim, '<del class="line-through">$1</del>')
      .replace(/`([^`]+)`/gim, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      .replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-muted-foreground pl-4 italic my-4">$1</blockquote>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-4" />')
      .replace(/^\* (.*$)/gim, '<li class="ml-4">$1</li>')
      .replace(/^(\d+)\. (.*$)/gim, '<li class="ml-4">$2</li>')
      .replace(/\n\n/gim, '</p><p class="mb-4">')
      .replace(/\n/gim, '<br />');

    // Wrap with paragraph tags
    html = '<p class="mb-4">' + html + '</p>';

    // Wrap consecutive <li> tags with <ul> or <ol>
    html = html.replace(/(<li class="ml-4">.*?<\/li>)/gis, '<ul class="list-disc pl-4 mb-4">$1</ul>');
    html = html.replace(/(<li class="ml-4">\d+\..*?<\/li>)/gis, '<ol class="list-decimal pl-4 mb-4">$1</ol>');

    return html;
  }, [content]);

  const calculateReadTime = (text: string) => {
    const wordsPerMinute = 200;
    const wordCount = text.trim().split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader className="space-y-4">
          {/* Featured Image */}
          {imageUrl && (
            <div className="rounded-lg overflow-hidden">
              <img 
                src={imageUrl} 
                alt={title}
                className="w-full h-64 object-cover"
              />
            </div>
          )}

          {/* Title */}
          <div>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">
              {title || 'Your Blog Post Title'}
            </h1>
          </div>

          {/* Meta Information */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{new Date().toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{calculateReadTime(content)} min read</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              <span>Preview Mode</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Content */}
          <div className="prose prose-lg prose-gray max-w-none">
            {content ? (
              <div 
                dangerouslySetInnerHTML={{ __html: renderContent }}
                className="leading-relaxed"
              />
            ) : (
              <p className="text-muted-foreground italic">
                Start writing your content to see the preview...
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
