
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, MapPin, Mail, Github, Linkedin } from 'lucide-react';

interface LayoutPreviewProps {
  layout: string;
  isSelected: boolean;
  onSelect: () => void;
}

export function LayoutPreview({ layout, isSelected, onSelect }: LayoutPreviewProps) {
  const renderPreview = () => {
    const commonElements = {
      profile: (
        <div className="bg-gray-100 rounded p-1 text-xs">
          <div className="w-4 h-4 bg-gray-300 rounded-full mb-1 mx-auto"></div>
          <div className="h-1 bg-gray-300 rounded mb-0.5"></div>
          <div className="h-0.5 bg-gray-200 rounded"></div>
        </div>
      ),
      project: (
        <div className="bg-gray-50 rounded p-1 text-xs">
          <div className="h-2 bg-gray-200 rounded mb-0.5"></div>
          <div className="h-0.5 bg-gray-300 rounded mb-0.5"></div>
          <div className="h-0.5 bg-gray-300 rounded w-3/4"></div>
        </div>
      )
    };

    switch (layout) {
      case 'sidebar':
        return (
          <div className="flex gap-1 h-16">
            <div className="w-1/3 space-y-1">
              {commonElements.profile}
              <div className="flex gap-0.5">
                <div className="w-1 h-1 bg-[#9b87f5] rounded-full"></div>
                <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-1">
              {Array(4).fill(0).map((_, i) => (
                <div key={i}>{commonElements.project}</div>
              ))}
            </div>
          </div>
        );
      
      case 'hero-timeline':
        return (
          <div className="space-y-1 h-16">
            <div className="bg-gradient-to-r from-[#9b87f5] to-purple-600 rounded p-1 text-center h-6">
              <div className="w-3 h-3 bg-white rounded-full mx-auto mb-0.5"></div>
              <div className="h-0.5 bg-white rounded w-1/2 mx-auto"></div>
            </div>
            <div className="space-y-0.5 flex-1">
              {Array(2).fill(0).map((_, i) => (
                <div key={i} className="flex gap-1 items-start">
                  <div className="w-1 h-1 bg-[#9b87f5] rounded-full mt-0.5 flex-shrink-0"></div>
                  <div className="flex-1">{commonElements.project}</div>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'grid':
        return (
          <div className="space-y-1 h-16">
            <div className="bg-gray-100 rounded p-0.5 flex items-center gap-1 h-4">
              <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
              <div className="h-0.5 bg-gray-300 rounded flex-1"></div>
            </div>
            <div className="grid grid-cols-3 gap-0.5 flex-1">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="bg-gray-50 rounded aspect-square"></div>
              ))}
            </div>
          </div>
        );
      
      case 'classic':
        return (
          <div className="space-y-1 h-16">
            <div className="bg-gray-100 rounded p-1 text-center h-6">
              <div className="w-3 h-3 bg-gray-300 rounded-full mx-auto mb-0.5"></div>
              <div className="h-0.5 bg-gray-300 rounded w-3/4 mx-auto"></div>
            </div>
            <div className="space-y-0.5 flex-1">
              {Array(2).fill(0).map((_, i) => (
                <div key={i}>{commonElements.project}</div>
              ))}
            </div>
          </div>
        );
      
      case 'split':
        return (
          <div className="flex gap-1 h-16">
            <div className="w-1/2">
              {commonElements.profile}
            </div>
            <div className="w-1/2 space-y-0.5">
              {Array(2).fill(0).map((_, i) => (
                <div key={i}>{commonElements.project}</div>
              ))}
            </div>
          </div>
        );
      
      case 'hero-focus':
        return (
          <div className="space-y-1 h-16">
            <div className="bg-gradient-to-r from-[#9b87f5] to-purple-600 rounded p-1 h-10 flex items-center justify-center">
              <div className="text-center">
                <div className="w-4 h-4 bg-white rounded-full mx-auto mb-0.5"></div>
                <div className="h-0.5 bg-white rounded w-6 mx-auto"></div>
              </div>
            </div>
            <div className="flex-1">{commonElements.project}</div>
          </div>
        );
      
      default:
        return <div className="h-16 bg-gray-100 rounded flex items-center justify-center text-xs">Preview</div>;
    }
  };

  const getLayoutName = () => {
    const names = {
      'sidebar': 'Sidebar Profile',
      'hero-timeline': 'Hero Banner + Timeline',
      'grid': 'Grid Focus',
      'classic': 'Classic',
      'split': 'Split View',
      'hero-focus': 'Hero Focus'
    };
    return names[layout] || layout;
  };

  return (
    <Card 
      className={`p-4 cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-[#9b87f5] bg-[#9b87f5]/5' : ''
      }`}
      onClick={onSelect}
    >
      <div className="mb-3">
        {renderPreview()}
      </div>
      <h3 className="font-medium text-sm mb-1">{getLayoutName()}</h3>
      <p className="text-xs text-gray-500 leading-tight">
        {layout === 'sidebar' && 'Profile sidebar with project grid'}
        {layout === 'hero-timeline' && 'Hero header with timeline projects'}
        {layout === 'grid' && 'Masonry grid layout'}
        {layout === 'classic' && 'Traditional top-down layout'}
        {layout === 'split' && 'Side-by-side profile and projects'}
        {layout === 'hero-focus' && 'Large profile with featured project'}
      </p>
    </Card>
  );
}
