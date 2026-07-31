
import React from 'react';
import { Card } from '@/components/ui/card';
import { Check } from 'lucide-react';

interface LayoutPreviewProps {
  layout: string;
  isSelected: boolean;
  onSelect: () => void;
}

export function LayoutPreview({ layout, isSelected, onSelect }: LayoutPreviewProps) {
  const renderPreview = () => {
    switch (layout) {
      case 'sidebar':
        return (
          <div className="w-full h-32 bg-background border rounded-md overflow-hidden relative">
            <div className="absolute left-0 top-0 w-1/3 h-full bg-ss-lav-chip border-r">
              <div className="p-2 space-y-2">
                <div className="w-8 h-8 bg-primary rounded-full mx-auto"></div>
                <div className="h-2 bg-muted-foreground/30 rounded w-3/4 mx-auto"></div>
                <div className="h-1 bg-muted-foreground/20 rounded w-1/2 mx-auto"></div>
                <div className="space-y-1 mt-3">
                  <div className="h-1 bg-muted-foreground/20 rounded w-2/3 mx-auto"></div>
                  <div className="h-1 bg-muted-foreground/20 rounded w-1/2 mx-auto"></div>
                </div>
              </div>
            </div>
            <div className="absolute left-1/3 top-0 right-0 h-full p-2">
              <div className="grid grid-cols-1 gap-2 h-full">
                <div className="bg-card rounded border p-2">
                  <div className="h-1 bg-muted-foreground/30 rounded mb-1"></div>
                  <div className="h-1 bg-muted-foreground/20 rounded w-3/4"></div>
                </div>
                <div className="bg-card rounded border p-2">
                  <div className="h-1 bg-muted-foreground/30 rounded mb-1"></div>
                  <div className="h-1 bg-muted-foreground/20 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'hero-timeline':
        return (
          <div className="w-full h-32 bg-background border rounded-md overflow-hidden">
            <div className="h-12 bg-gradient-to-r from-ss-lav to-ss-lav-deep relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-6 h-6 bg-primary-foreground rounded-full mx-auto mb-1"></div>
                  <div className="h-1 bg-primary-foreground/80 rounded w-16 mx-auto"></div>
                </div>
              </div>
            </div>
            <div className="p-2 space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-ss-lav rounded-full mt-1 flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="h-2 bg-muted-foreground/20 rounded w-3/4 mb-1"></div>
                  <div className="h-1 bg-muted rounded w-1/2"></div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-ss-lav rounded-full mt-1 flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="h-2 bg-muted-foreground/20 rounded w-2/3 mb-1"></div>
                  <div className="h-1 bg-muted rounded w-1/3"></div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'grid':
        return (
          <div className="w-full h-32 bg-background border rounded-md overflow-hidden">
            <div className="h-6 bg-muted border-b flex items-center px-2">
              <div className="w-4 h-4 bg-muted-foreground/30 rounded-full mr-2"></div>
              <div className="h-1 bg-muted-foreground/30 rounded flex-1"></div>
            </div>
            <div className="p-2">
              <div className="grid grid-cols-3 gap-1 h-20">
                <div className="bg-muted rounded p-1">
                  <div className="h-1 bg-muted-foreground/30 rounded mb-1"></div>
                  <div className="h-1 bg-muted-foreground/20 rounded w-2/3"></div>
                </div>
                <div className="bg-muted rounded p-1">
                  <div className="h-1 bg-muted-foreground/30 rounded mb-1"></div>
                  <div className="h-1 bg-muted-foreground/20 rounded w-3/4"></div>
                </div>
                <div className="bg-muted rounded p-1">
                  <div className="h-1 bg-muted-foreground/30 rounded mb-1"></div>
                  <div className="h-1 bg-muted-foreground/20 rounded w-1/2"></div>
                </div>
                <div className="bg-muted/60 rounded p-1">
                  <div className="h-1 bg-muted-foreground/30 rounded mb-1"></div>
                  <div className="h-1 bg-muted-foreground/20 rounded w-3/4"></div>
                </div>
                <div className="bg-muted/60 rounded p-1">
                  <div className="h-1 bg-muted-foreground/30 rounded mb-1"></div>
                  <div className="h-1 bg-muted-foreground/20 rounded w-1/2"></div>
                </div>
                <div className="bg-muted/60 rounded p-1">
                  <div className="h-1 bg-muted-foreground/30 rounded mb-1"></div>
                  <div className="h-1 bg-muted-foreground/20 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'classic':
        return (
          <div className="w-full h-32 bg-background border rounded-md overflow-hidden">
            <div className="h-8 bg-muted border-b flex flex-col items-center justify-center">
              <div className="w-4 h-4 bg-muted-foreground/30 rounded-full mb-1"></div>
              <div className="h-1 bg-muted-foreground/30 rounded w-12"></div>
            </div>
            <div className="p-2 space-y-2">
              <div className="h-2 bg-muted-foreground/20 rounded w-full"></div>
              <div className="h-1 bg-muted rounded w-3/4"></div>
              <div className="h-1 bg-muted rounded w-1/2"></div>
              <div className="mt-2 space-y-1">
                <div className="h-4 bg-card rounded border p-1">
                  <div className="h-1 bg-muted-foreground/20 rounded w-2/3"></div>
                </div>
                <div className="h-4 bg-card rounded border p-1">
                  <div className="h-1 bg-muted-foreground/20 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'split':
        return (
          <div className="w-full h-32 bg-background border rounded-md overflow-hidden">
            <div className="flex h-full">
              <div className="w-1/2 bg-muted border-r p-2">
                <div className="text-center space-y-1">
                  <div className="w-6 h-6 bg-ss-lav rounded-full mx-auto"></div>
                  <div className="h-1 bg-muted-foreground/30 rounded w-3/4 mx-auto"></div>
                  <div className="h-1 bg-muted-foreground/20 rounded w-1/2 mx-auto"></div>
                  <div className="space-y-1 mt-2">
                    <div className="h-1 bg-muted-foreground/20 rounded w-2/3 mx-auto"></div>
                    <div className="h-1 bg-muted-foreground/20 rounded w-1/2 mx-auto"></div>
                  </div>
                </div>
              </div>
              <div className="w-1/2 p-2 space-y-1">
                <div className="h-4 bg-muted rounded border p-1">
                  <div className="h-1 bg-muted-foreground/30 rounded"></div>
                </div>
                <div className="h-4 bg-muted rounded border p-1">
                  <div className="h-1 bg-muted-foreground/30 rounded w-3/4"></div>
                </div>
                <div className="h-4 bg-muted rounded border p-1">
                  <div className="h-1 bg-muted-foreground/30 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'hero-focus':
        return (
          <div className="w-full h-32 bg-background border rounded-md overflow-hidden">
            <div className="h-20 bg-gradient-to-r from-ss-lav to-ss-lav-deep relative">
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-8 h-8 bg-primary-foreground rounded-full mb-2"></div>
                <div className="h-1 bg-primary-foreground/80 rounded w-20 mb-1"></div>
                <div className="h-1 bg-primary-foreground/60 rounded w-16"></div>
              </div>
            </div>
            <div className="p-2">
              <div className="h-6 bg-muted rounded border p-1">
                <div className="h-1 bg-muted-foreground/30 rounded w-3/4"></div>
              </div>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="w-full h-32 bg-muted rounded-md flex items-center justify-center">
            <span className="text-muted-foreground text-sm">Preview</span>
          </div>
        );
    }
  };

  const getLayoutName = () => {
    const names = {
      'sidebar': 'Sidebar Profile',
      'hero-timeline': 'Hero Banner + Timeline',
      'grid': 'Project Grid',
      'classic': 'Classic',
      'split': 'Split View',
      'hero-focus': 'Hero Focus'
    };
    return names[layout] || layout;
  };

  return (
    <Card 
      className={`relative cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${
        isSelected
          ? 'ring-2 ring-primary bg-ss-lav-chip shadow-md'
          : 'border-border hover:border-ss-lav'
      }`}
      onClick={onSelect}
    >
      {isSelected && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-primary-foreground" />
          </div>
        </div>
      )}
      
      <div className="p-4">
        <div className="mb-3">
          {renderPreview()}
        </div>
        
        <div className="space-y-1">
          <h3 className="font-semibold text-sm text-foreground">{getLayoutName()}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {layout === 'sidebar' && 'Profile sidebar with project grid layout'}
            {layout === 'hero-timeline' && 'Large hero header with timeline-style projects'}
            {layout === 'grid' && 'Clean project grid layout for easy browsing'}
            {layout === 'classic' && 'Traditional top-down portfolio layout'}
            {layout === 'split' && 'Side-by-side profile and projects view'}
            {layout === 'hero-focus' && 'Prominent hero section with featured project'}
          </p>
        </div>
      </div>
    </Card>
  );
}
