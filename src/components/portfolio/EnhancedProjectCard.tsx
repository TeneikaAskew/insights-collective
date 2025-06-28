
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Github, ChevronLeft, ChevronRight } from 'lucide-react';
import { PortfolioPageProject } from '@/types/portfolio';

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface EnhancedProjectCardProps {
  projectItem: PortfolioPageProject;
  layout?: string;
  theme?: string;
  themeColors?: ThemeColors;
}

export function EnhancedProjectCard({ 
  projectItem, 
  layout = 'default', 
  theme = 'default',
  themeColors
}: EnhancedProjectCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  const project = projectItem.project;
  if (!project) return null;

  const description = projectItem.custom_description || project.description || '';
  const shouldShowReadMore = description.length > 200;
  const displayDescription = shouldShowReadMore && !isExpanded 
    ? description.substring(0, 200) + '...' 
    : description;

  const projectImages = project.project_images || [];
  const hasImages = projectImages.length > 0;

  // Utility function to ensure URLs have proper protocol
  const formatUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  };

  const getThemeStyles = () => {
    // Use passed theme colors if available, otherwise fall back to theme-based colors
    if (themeColors) {
      return {
        cardClass: 'border-gray-200 hover:border-gray-300 bg-white',
        textClass: 'text-gray-800',
        accentColor: themeColors.accent,
        primaryColor: themeColors.primary,
        secondaryColor: themeColors.secondary,
        bgColor: '#ffffff'
      };
    }

    switch (theme) {
      case 'minimal':
        return {
          cardClass: 'border-gray-200 hover:border-gray-300 bg-white',
          textClass: 'text-gray-800',
          accentColor: '#6b7280',
          primaryColor: '#6b7280',
          secondaryColor: '#9ca3af',
          bgColor: '#ffffff'
        };
      case 'professional':
        return {
          cardClass: 'border-gray-300 hover:border-blue-300 shadow-sm bg-white',
          textClass: 'text-gray-900',
          accentColor: '#3b82f6',
          primaryColor: '#3b82f6',
          secondaryColor: '#1e40af',
          bgColor: '#ffffff'
        };
      case 'creative':
        return {
          cardClass: 'border-purple-200 hover:border-purple-300 bg-white',
          textClass: 'text-purple-900',
          accentColor: '#a855f7',
          primaryColor: '#a855f7',
          secondaryColor: '#7c3aed',
          bgColor: '#ffffff'
        };
      case 'modern':
        return {
          cardClass: 'border-green-200 hover:border-green-300 bg-white',
          textClass: 'text-green-900',
          accentColor: '#10b981',
          primaryColor: '#10b981',
          secondaryColor: '#059669',
          bgColor: '#ffffff'
        };
      case 'elegant':
        return {
          cardClass: 'border-red-200 hover:border-red-300 bg-white',
          textClass: 'text-red-900',
          accentColor: '#dc2626',
          primaryColor: '#dc2626',
          secondaryColor: '#b91c1c',
          bgColor: '#ffffff'
        };
      default:
        return {
          cardClass: 'border-gray-200 hover:border-blue-300 bg-white',
          textClass: 'text-gray-800',
          accentColor: '#3b82f6',
          primaryColor: '#3b82f6',
          secondaryColor: '#a855f7',
          bgColor: '#ffffff'
        };
    }
  };

  const themeStyles = getThemeStyles();

  const handleLinkClick = (url?: string) => {
    if (url) {
      const formattedUrl = formatUrl(url);
      window.open(formattedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % projectImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + projectImages.length) % projectImages.length);
  };

  const renderProjectImage = () => {
    if (hasImages) {
      return (
        <div className="relative w-full h-48 rounded-lg overflow-hidden">
          <img
            src={projectImages[currentImageIndex]}
            alt={`${project.title} screenshot ${currentImageIndex + 1}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          
          <div className="hidden w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <div className="text-center">
              <div 
                className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-2xl font-bold"
                style={{ backgroundColor: themeStyles.accentColor }}
              >
                {project.title.charAt(0)}
              </div>
              <p className="text-sm text-gray-500">Project Preview</p>
            </div>
          </div>

          {projectImages.length > 1 && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="absolute left-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 bg-white/80 hover:bg-white"
                onClick={prevImage}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 bg-white/80 hover:bg-white"
                onClick={nextImage}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                {projectImages.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${
                      index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div 
            className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-2xl font-bold"
            style={{ backgroundColor: themeStyles.accentColor }}
          >
            {project.title.charAt(0)}
          </div>
          <p className="text-sm text-gray-500">Project Preview</p>
        </div>
      </div>
    );
  };

  return (
    <Card className={`${themeStyles.cardClass} transition-all hover:shadow-lg overflow-hidden`}>
      <CardContent className="p-0">
        <div className="p-4 pb-0">
          {renderProjectImage()}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <h3 className={`text-xl font-bold ${themeStyles.textClass}`}>
              {project.title}
            </h3>
            <div className="flex gap-2 ml-4">
              {project.live_url && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 w-8 p-0 transition-all"
                  onClick={() => handleLinkClick(project.live_url)}
                  title="View live demo"
                  style={{ 
                    borderColor: themeStyles.primaryColor, 
                    color: themeStyles.primaryColor,
                    backgroundColor: 'white'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = themeStyles.primaryColor;
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = themeStyles.primaryColor;
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              {project.github_url && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 w-8 p-0 transition-all"
                  onClick={() => handleLinkClick(project.github_url)}
                  title="View source code"
                  style={{ 
                    borderColor: themeStyles.secondaryColor, 
                    color: themeStyles.secondaryColor,
                    backgroundColor: 'white'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = themeStyles.secondaryColor;
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = themeStyles.secondaryColor;
                  }}
                >
                  <Github className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="mb-4">
            <p className={`text-sm leading-relaxed ${themeStyles.textClass}`}>
              {displayDescription}
            </p>
            {shouldShowReadMore && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 p-0 h-auto text-xs"
                style={{ color: themeStyles.accentColor }}
              >
                {isExpanded ? 'Show less' : 'Read more'}
              </Button>
            )}
          </div>

          {project.required_skills && project.required_skills.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 opacity-70">
                Tech Stack
              </h4>
              <div className="flex flex-wrap gap-1">
                {project.required_skills.map((skill, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="text-xs px-2 py-1 border-0 text-white"
                    style={{ 
                      backgroundColor: themeStyles.accentColor,
                      color: 'white'
                    }}
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-xs">
            {project.effort_level && (
              <div>
                <span className="font-medium opacity-70">Effort: </span>
                <span className={themeStyles.textClass}>{project.effort_level}</span>
              </div>
            )}
            {project.impact && (
              <div>
                <span className="font-medium opacity-70">Impact: </span>
                <span className={themeStyles.textClass}>{project.impact}</span>
              </div>
            )}
          </div>

          {project.roadmap && project.roadmap.milestones && project.roadmap.milestones.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 opacity-70">
                Key Achievements
              </h4>
              <ul className="space-y-1">
                {project.roadmap.milestones.slice(0, 3).map((milestone, idx) => (
                  <li key={idx} className="flex items-start text-xs">
                    <div 
                      className="w-1.5 h-1.5 rounded-full mt-1.5 mr-2 flex-shrink-0"
                      style={{ backgroundColor: themeStyles.accentColor }}
                    ></div>
                    <span className={themeStyles.textClass}>{milestone}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
