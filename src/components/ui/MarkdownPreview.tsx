import React from 'react';

interface MarkdownPreviewProps {
  content: string;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content }) => {
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

  const renderVideoEmbed = (videoUrl: string) => {
    const embedUrl = getEmbedUrl(videoUrl);
    if (embedUrl) {
      // Check if it's a direct video file
      if (embedUrl.match(/\.(mp4|webm|ogg|avi|mov)(\?.*)?$/i)) {
        return (
          <div className="mb-8">
            <video 
              src={embedUrl} 
              controls 
              className="w-full rounded-lg"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        );
      } else {
        // It's an embed (YouTube, Vimeo, etc.) - using exact legacy logic
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
          </div>
        );
      }
    }
    return (
      <p className="text-gray-500 mb-8">Invalid video URL</p>
    );
  };

  const parseContent = () => {
    // First, handle video embeds in the entire content to support multiple videos and inline videos
    const contentWithVideosProcessed = content.replace(/\[VIDEO:([^\]]+)\]/g, (match, videoUrl) => {
      return `__VIDEO_PLACEHOLDER_${videoUrl}__`;
    });

    const lines = contentWithVideosProcessed.split('\n');
    const elements: React.ReactNode[] = [];
    let currentListItems: string[] = [];
    let currentOrderedItems: string[] = [];
    let key = 0;

    const flushList = () => {
      if (currentListItems.length > 0) {
        elements.push(
          <ul key={key++} className="list-disc list-inside my-4">
            {currentListItems.map((item, index) => (
              <li key={index} dangerouslySetInnerHTML={{ __html: processInlineMarkdown(item) }} />
            ))}
          </ul>
        );
        currentListItems = [];
      }
    };

    const flushOrderedList = () => {
      if (currentOrderedItems.length > 0) {
        elements.push(
          <ol key={key++} className="list-decimal list-inside my-4">
            {currentOrderedItems.map((item, index) => (
              <li key={index} dangerouslySetInnerHTML={{ __html: processInlineMarkdown(item) }} />
            ))}
          </ol>
        );
        currentOrderedItems = [];
      }
    };

    const processInlineMarkdown = (text: string): string => {
      return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>');
    };

    const processLineForVideosAndContent = (line: string) => {
      // Check if line contains video placeholders
      const videoPlaceholderRegex = /__VIDEO_PLACEHOLDER_([^_]+)__/g;
      const parts = line.split(videoPlaceholderRegex);
      const lineElements: React.ReactNode[] = [];
      let lineKey = 0;

      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
          // Regular content
          if (parts[i].trim()) {
            lineElements.push(
              <span key={lineKey++} dangerouslySetInnerHTML={{ __html: processInlineMarkdown(parts[i]) }} />
            );
          }
        } else {
          // Video URL
          lineElements.push(
            <div key={lineKey++}>
              {renderVideoEmbed(parts[i])}
            </div>
          );
        }
      }

      return lineElements;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this line is just a video placeholder
      const videoPlaceholderMatch = line.match(/^__VIDEO_PLACEHOLDER_([^_]+)__$/);
      if (videoPlaceholderMatch) {
        flushList();
        flushOrderedList();
        elements.push(
          <div key={key++}>
            {renderVideoEmbed(videoPlaceholderMatch[1])}
          </div>
        );
        continue;
      }

      // Check if line contains video placeholders mixed with other content
      if (line.includes('__VIDEO_PLACEHOLDER_')) {
        flushList();
        flushOrderedList();
        const lineElements = processLineForVideosAndContent(line);
        if (lineElements.length > 0) {
          elements.push(
            <div key={key++} className="mb-4">
              {lineElements}
            </div>
          );
        }
        continue;
      }

      // Handle images
      const imageMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if (imageMatch) {
        flushList();
        flushOrderedList();
        elements.push(
          <img 
            key={key++} 
            src={imageMatch[2]} 
            alt={imageMatch[1]} 
            className="max-w-full h-auto rounded-lg my-4" 
          />
        );
        continue;
      }

      // Handle headings
      if (line.startsWith('### ')) {
        flushList();
        flushOrderedList();
        elements.push(
          <h3 key={key++} className="text-lg font-medium mb-2">
            {line.substring(4)}
          </h3>
        );
        continue;
      }
      
      if (line.startsWith('## ')) {
        flushList();
        flushOrderedList();
        elements.push(
          <h2 key={key++} className="text-xl font-semibold mb-3">
            {line.substring(3)}
          </h2>
        );
        continue;
      }
      
      if (line.startsWith('# ')) {
        flushList();
        flushOrderedList();
        elements.push(
          <h1 key={key++} className="text-2xl font-bold mb-4">
            {line.substring(2)}
          </h1>
        );
        continue;
      }

      // Handle blockquotes
      if (line.startsWith('> ')) {
        flushList();
        flushOrderedList();
        elements.push(
          <blockquote key={key++} className="border-l-4 border-primary/20 pl-4 italic my-4">
            <span dangerouslySetInnerHTML={{ __html: processInlineMarkdown(line.substring(2)) }} />
          </blockquote>
        );
        continue;
      }

      // Handle unordered lists
      if (line.startsWith('* ')) {
        flushOrderedList();
        currentListItems.push(line.substring(2));
        continue;
      }

      // Handle ordered lists
      const orderedMatch = line.match(/^(\d+)\. (.*)$/);
      if (orderedMatch) {
        flushList();
        currentOrderedItems.push(orderedMatch[2]);
        continue;
      }

      // Handle empty lines
      if (line.trim() === '') {
        flushList();
        flushOrderedList();
        if (elements.length > 0) {
          elements.push(<br key={key++} />);
        }
        continue;
      }

      // Handle regular paragraphs
      flushList();
      flushOrderedList();
      if (line.trim()) {
        elements.push(
          <p key={key++} className="mb-4">
            <span dangerouslySetInnerHTML={{ __html: processInlineMarkdown(line) }} />
          </p>
        );
      }
    }

    // Flush any remaining lists
    flushList();
    flushOrderedList();

    return elements;
  };

  return (
    <div className="prose prose-sm max-w-none">
      {parseContent()}
    </div>
  );
};