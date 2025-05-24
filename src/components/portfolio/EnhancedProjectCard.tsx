
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Github } from 'lucide-react';
import { PortfolioPageProject } from '@/types/portfolio';

interface EnhancedProjectCardProps {
  projectItem: PortfolioPageProject;
  layout?: string;
  theme?: string;
}

export function EnhancedProjectCard({ projectItem, layout = 'default', theme = 'default' }: EnhancedProjectCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const project = projectItem.project;
  if (!project) return null;

  const description = projectItem.custom_description || project.description || '';
  const shouldShowReadMore = description.length > 200;
  const displayDescription = shouldShowReadMore && !isExpanded 
    ? description.substring(0, 200) + '...' 
    : description;

  const getThemeStyles = () => {
    switch (theme) {
      case 'minimal':
        return {
          cardClass: 'border-gray-200 hover:border-gray-300',
          textClass: 'text-gray-800',
          accentColor: '#6b7280'
        };
      case 'professional':
        return {
          cardClass: 'border-gray-300 hover:border-blue-300 shadow-sm',
          textClass: 'text-gray-900',
          accentColor: '#6366f1'
        };
      case 'creative':
        return {
          cardClass: 'border-purple-200 hover:border-purple-300 bg-gradient-to-br from-white to-purple-50',
          textClass: 'text-purple-900',
          accentColor: '#a855f7'
        };
      default:
        return {
          cardClass: 'border-gray-200 hover:border-[#9b87f5]',
          textClass: 'text-gray-800',
          accentColor: '#9b87f5'
        };
    }
  };

  const themeStyles = getThemeStyles();

  const handleLinkClick = (url?: string) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const renderProjectImage = () => {
    // For now, show placeholder since project_images column doesn't exist
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
        {/* Project Image */}
        <div className="p-4 pb-0">
          {renderProjectImage()}
        </div>

        {/* Project Content */}
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
                  className="h-8 w-8 p-0"
                  onClick={() => handleLinkClick(project.live_url)}
                  title="View live demo"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              {project.github_url && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 w-8 p-0"
                  onClick={() => handleLinkClick(project.github_url)}
                  title="View source code"
                >
                  <Github className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Description */}
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

          {/* Skills/Tech Stack */}
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
                    className="text-xs px-2 py-1"
                    style={{ 
                      borderColor: themeStyles.accentColor,
                      color: themeStyles.accentColor,
                      backgroundColor: `${themeStyles.accentColor}10`
                    }}
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Project Details */}
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

          {/* Key Achievements */}
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
