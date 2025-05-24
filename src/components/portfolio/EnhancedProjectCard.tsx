
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Github, ExternalLink, Calendar, Target, Zap } from 'lucide-react';
import { PortfolioPageProject } from '@/types/portfolio';

interface EnhancedProjectCardProps {
  projectItem: PortfolioPageProject;
  layout?: string;
  theme?: string;
  themeColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export function EnhancedProjectCard({ 
  projectItem, 
  layout = 'classic',
  theme = 'default',
  themeColors = {
    primary: '#3b82f6',
    secondary: '#a855f7',
    accent: '#6b7280'
  }
}: EnhancedProjectCardProps) {
  const project = projectItem.project;
  
  if (!project) return null;

  const formatUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  };

  const getLayoutStyles = () => {
    const baseCardStyle = {
      backgroundColor: '#ffffff',
      border: `1px solid ${themeColors.primary}20`,
      borderRadius: '8px',
      padding: '24px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      transition: 'all 0.3s ease'
    };

    switch (layout) {
      case 'hero-focus':
      case 'hero-timeline':
        return {
          ...baseCardStyle,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)'
        };
      case 'grid':
        return {
          ...baseCardStyle,
          height: '100%',
          display: 'flex',
          flexDirection: 'column' as const
        };
      case 'split':
        return {
          ...baseCardStyle,
          marginBottom: '24px'
        };
      default:
        return baseCardStyle;
    }
  };

  const cardStyle = getLayoutStyles();

  return (
    <Card 
      className="hover:shadow-xl transition-all duration-300 group"
      style={cardStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 10px 25px -5px ${themeColors.primary}20`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = cardStyle.boxShadow;
      }}
    >
      <div className={layout === 'grid' ? 'flex flex-col h-full' : ''}>
        <div className="mb-4">
          <h3 
            className="text-xl font-bold mb-2 group-hover:text-opacity-80 transition-colors"
            style={{ color: themeColors.primary }}
          >
            {project.title}
          </h3>
          <p 
            className="leading-relaxed"
            style={{ color: themeColors.accent }}
          >
            {projectItem.custom_description || project.description}
          </p>
        </div>

        {/* Project Stats */}
        {(project.effort_level || project.impact) && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            {project.effort_level && (
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" style={{ color: themeColors.secondary }} />
                <div>
                  <span className="text-xs font-medium" style={{ color: themeColors.accent }}>Effort:</span>
                  <span className="ml-1 text-sm" style={{ color: themeColors.primary }}>{project.effort_level}</span>
                </div>
              </div>
            )}
            {project.impact && (
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" style={{ color: themeColors.secondary }} />
                <div>
                  <span className="text-xs font-medium" style={{ color: themeColors.accent }}>Impact:</span>
                  <span className="ml-1 text-sm" style={{ color: themeColors.primary }}>{project.impact}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tech Stack */}
        {project.required_skills && project.required_skills.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold mb-2" style={{ color: themeColors.accent }}>
              Tech Stack
            </h4>
            <div className="flex flex-wrap gap-2">
              {project.required_skills.slice(0, layout === 'grid' ? 4 : 6).map((skill, index) => (
                <Badge
                  key={index}
                  className="text-xs px-2 py-1 text-white border-0"
                  style={{ backgroundColor: themeColors.primary }}
                >
                  {skill}
                </Badge>
              ))}
              {project.required_skills.length > (layout === 'grid' ? 4 : 6) && (
                <span className="text-xs px-2 py-1" style={{ color: themeColors.accent }}>
                  +{project.required_skills.length - (layout === 'grid' ? 4 : 6)} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Key Achievements */}
        {project.roadmap?.milestones && project.roadmap.milestones.length > 0 && layout !== 'grid' && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold mb-2" style={{ color: themeColors.accent }}>
              Key Achievements
            </h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {project.roadmap.milestones.slice(0, 3).map((milestone, index) => (
                <li key={index} style={{ color: themeColors.primary }}>{milestone}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Project Links */}
        <div className={`flex gap-3 ${layout === 'grid' ? 'mt-auto' : ''}`}>
          {project.github_url && (
            <Button
              asChild
              size="sm"
              className="text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: themeColors.primary }}
            >
              <a
                href={formatUrl(project.github_url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-4 w-4 mr-2" />
                Code
              </a>
            </Button>
          )}
          {project.live_url && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border hover:bg-gray-50 transition-colors"
              style={{ 
                color: themeColors.primary,
                borderColor: themeColors.primary
              }}
            >
              <a
                href={formatUrl(project.live_url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Demo
              </a>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
