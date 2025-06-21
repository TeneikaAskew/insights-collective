
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Edit, 
  Trash2, 
  Download, 
  Play, 
  Code, 
  Quote,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle
} from 'lucide-react';
import { ContentBlock } from '@/hooks/useContentBlocks';
import { cn } from '@/lib/utils';

interface ContentBlockRendererProps {
  block: ContentBlock;
  isEditing?: boolean;
  onEdit?: (block: ContentBlock) => void;
  onDelete?: (blockId: string) => void;
  showControls?: boolean;
}

const ContentBlockRenderer: React.FC<ContentBlockRendererProps> = ({
  block,
  isEditing = false,
  onEdit,
  onDelete,
  showControls = true
}) => {
  const getBlockIcon = () => {
    switch (block.block_type) {
      case 'image':
        return '🖼️';
      case 'video':
        return '🎥';
      case 'file':
        return '📁';
      case 'quote':
        return '💬';
      case 'code':
        return '💻';
      case 'embed':
        return '🔗';
      case 'quiz':
        return '❓';
      default:
        return '📝';
    }
  };

  const renderContent = () => {
    switch (block.block_type) {
      case 'text':
        return (
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: block.content }}
          />
        );

      case 'image':
        return (
          <div className="space-y-2">
            <img 
              src={block.file_url} 
              alt={block.metadata?.altText || block.title || 'Course image'}
              className="max-w-full h-auto rounded-lg"
            />
            {block.title && (
              <p className="text-sm text-gray-600 italic text-center">{block.title}</p>
            )}
          </div>
        );

      case 'video':
        if (block.file_url) {
          return (
            <div className="space-y-2">
              <video 
                src={block.file_url} 
                controls 
                className="w-full rounded-lg"
                poster={block.metadata?.thumbnail}
              >
                Your browser does not support the video tag.
              </video>
              {block.title && (
                <p className="text-sm font-medium">{block.title}</p>
              )}
            </div>
          );
        } else if (block.content) {
          // Handle YouTube/Vimeo embeds
          const embedUrl = getEmbedUrl(block.content);
          if (embedUrl) {
            return (
              <div className="space-y-2">
                <div className="aspect-video">
                  <iframe
                    src={embedUrl}
                    className="w-full h-full rounded-lg"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                {block.title && (
                  <p className="text-sm font-medium">{block.title}</p>
                )}
              </div>
            );
          }
        }
        return <p className="text-gray-500">Invalid video URL</p>;

      case 'file':
        return (
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded">
                  <Download className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium">{block.title || block.metadata?.originalName}</p>
                  {block.file_size && (
                    <p className="text-sm text-gray-500">
                      {(block.file_size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  )}
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={block.file_url} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        );

      case 'quote':
        const style = block.metadata?.style || 'info';
        const styleConfig = {
          info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: Info, iconColor: 'text-blue-600' },
          warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: AlertTriangle, iconColor: 'text-yellow-600' },
          success: { bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle, iconColor: 'text-green-600' },
          error: { bg: 'bg-red-50', border: 'border-red-200', icon: AlertCircle, iconColor: 'text-red-600' }
        };
        const config = styleConfig[style as keyof typeof styleConfig] || styleConfig.info;
        const Icon = config.icon;
        
        return (
          <div className={cn('p-4 rounded-lg border-l-4', config.bg, config.border)}>
            <div className="flex items-start space-x-3">
              <Icon className={cn('h-5 w-5 mt-0.5', config.iconColor)} />
              <div>
                {block.title && (
                  <p className="font-medium mb-1">{block.title}</p>
                )}
                <p className="text-gray-700">{block.content}</p>
              </div>
            </div>
          </div>
        );

      case 'code':
        return (
          <div className="space-y-2">
            {block.title && (
              <div className="flex items-center space-x-2">
                <Code className="h-4 w-4" />
                <span className="font-medium">{block.title}</span>
                {block.metadata?.language && (
                  <Badge variant="secondary" className="text-xs">
                    {block.metadata.language}
                  </Badge>
                )}
              </div>
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
            <div className="space-y-2">
              {block.title && (
                <p className="font-medium">{block.title}</p>
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
        return <p className="text-gray-500">Invalid embed URL</p>;

      case 'quiz':
        return (
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded">
                  <Play className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">{block.title}</p>
                  {block.content && (
                    <p className="text-sm text-gray-600">{block.content}</p>
                  )}
                  <div className="flex space-x-4 mt-1">
                    {block.metadata?.timeLimit && (
                      <span className="text-xs text-gray-500">
                        Time: {block.metadata.timeLimit} min
                      </span>
                    )}
                    {block.metadata?.passingScore && (
                      <span className="text-xs text-gray-500">
                        Passing: {block.metadata.passingScore}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Start Quiz
              </Button>
            </div>
          </div>
        );

      default:
        return <p className="text-gray-500">Unknown content type</p>;
    }
  };

  const getEmbedUrl = (url: string): string | null => {
    // YouTube
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }

    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    return null;
  };

  return (
    <Card className={cn('relative', isEditing && 'ring-2 ring-blue-500')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{getBlockIcon()}</span>
            <CardTitle className="text-base">
              {block.title || `${block.block_type.charAt(0).toUpperCase() + block.block_type.slice(1)} Block`}
            </CardTitle>
            <div className="flex space-x-1">
              {block.is_interactive && (
                <Badge variant="secondary" className="text-xs">Interactive</Badge>
              )}
              {block.completion_required && (
                <Badge variant="outline" className="text-xs">Required</Badge>
              )}
            </div>
          </div>
          {showControls && (
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit?.(block)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete?.(block.id)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  );
};

export default ContentBlockRenderer;
