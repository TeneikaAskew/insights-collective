
import React from 'react';
import { ContentBlock } from '@/types/moduleContent';
import { cn } from '@/lib/utils';

interface StudentContentRendererProps {
  block: ContentBlock;
}

const StudentContentRenderer: React.FC<StudentContentRendererProps> = ({ block }) => {
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

  const renderContent = () => {
    switch (block.block_type) {
      case 'text':
        return (
          <div 
            className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-em:text-foreground prose-code:text-foreground prose-blockquote:text-foreground prose-li:text-foreground prose-a:text-primary mb-8"
            dangerouslySetInnerHTML={{ __html: block.content }}
          />
        );

      case 'image':
        return (
          <div className="mb-8">
            <img 
              src={block.file_url} 
              alt={block.metadata?.altText || block.title || 'Course image'}
              className="max-w-full h-auto rounded-lg mx-auto"
            />
            {block.title && (
              <p className="text-sm text-gray-600 italic text-center mt-2">{block.title}</p>
            )}
          </div>
        );

      case 'video':
        if (block.file_url) {
          return (
            <div className="mb-8">
              <video 
                src={block.file_url} 
                controls 
                className="w-full rounded-lg"
                poster={block.metadata?.thumbnail}
              >
                Your browser does not support the video tag.
              </video>
              {block.title && (
                <p className="text-sm font-medium mt-2">{block.title}</p>
              )}
            </div>
          );
        } else if (block.content) {
          const embedUrl = getEmbedUrl(block.content);
          if (embedUrl) {
            return (
              <div className="mb-8">
                <div className="aspect-video">
                  <iframe
                    src={embedUrl}
                    className="w-full h-full rounded-lg"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                {block.title && (
                  <p className="text-sm font-medium mt-2">{block.title}</p>
                )}
              </div>
            );
          }
        }
        return <p className="text-gray-500 mb-8">Invalid video URL</p>;

      case 'quote':
        const style = block.metadata?.style || 'info';
        const styleConfig = {
          info: { bg: 'bg-blue-50', border: 'border-l-blue-400', text: 'text-blue-800' },
          warning: { bg: 'bg-yellow-50', border: 'border-l-yellow-400', text: 'text-yellow-800' },
          success: { bg: 'bg-green-50', border: 'border-l-green-400', text: 'text-green-800' },
          error: { bg: 'bg-red-50', border: 'border-l-red-400', text: 'text-red-800' }
        };
        const config = styleConfig[style as keyof typeof styleConfig] || styleConfig.info;
        
        return (
          <div className={cn('p-6 rounded-lg border-l-4 mb-8', config.bg, config.border)}>
            {block.title && (
              <p className={cn('font-semibold mb-2', config.text)}>{block.title}</p>
            )}
            <p className={cn('', config.text)}>{block.content}</p>
          </div>
        );

      case 'code':
        return (
          <div className="mb-8">
            {block.title && (
              <h4 className="font-medium mb-2">{block.title}</h4>
            )}
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
              <code className="text-sm">{block.content}</code>
            </pre>
          </div>
        );

      case 'embed':
        const embedUrl = getEmbedUrl(block.content);
        if (embedUrl) {
          const aspectRatio = block.metadata?.aspectRatio || '16:9';
          const aspectClass = aspectRatio === '4:3' ? 'aspect-[4/3]' : 
                            aspectRatio === '1:1' ? 'aspect-square' : 'aspect-video';
          
          return (
            <div className="mb-8">
              {block.title && (
                <h4 className="font-medium mb-2">{block.title}</h4>
              )}
              <div className={aspectClass}>
                <iframe
                  src={embedUrl}
                  className="w-full h-full rounded-lg"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          );
        }
        return <p className="text-gray-500 mb-8">Invalid embed URL</p>;

      default:
        return null;
    }
  };

  return renderContent();
};

export default StudentContentRenderer;
