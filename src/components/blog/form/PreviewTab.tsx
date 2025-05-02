
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';

interface PreviewTabProps {
  title: string;
  content: string;
  imageUrl: string;
}

export function PreviewTab({ title, content, imageUrl }: PreviewTabProps) {
  return (
    <Card className="bg-background">
      <CardContent className="p-6">
        {imageUrl && (
          <div className="w-full h-[250px] mb-6 rounded-lg overflow-hidden">
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/placeholder.svg';
              }}
            />
          </div>
        )}
        <div className="prose max-w-none dark:prose-invert">
          <h1 className="text-3xl font-bold mb-4">{title}</h1>
          <div className="mt-6">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
