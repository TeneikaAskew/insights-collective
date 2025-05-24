
import React from 'react';
import { PortfolioPage } from '@/types/portfolio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Github, ExternalLink, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ClassicLayoutProps {
  portfolioPage: PortfolioPage;
}

export function ClassicLayout({ portfolioPage }: ClassicLayoutProps) {
  // Utility function to ensure URLs have proper protocol
  const formatUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  };

  // Apply theme styles based on the portfolio theme
  const getThemeStyles = () => {
    switch (portfolioPage.theme) {
      case 'minimal':
        return {
          backgroundColor: "#ffffff",
          fontFamily: `'${portfolioPage.font_family || 'Inter'}', sans-serif`,
          color: "#333333",
          accentColor: "#6b7280",
          cardBg: "#f9fafb",
          borderColor: "#e5e7eb",
          primaryColor: "#6b7280",
          secondaryColor: "#9ca3af"
        };
      case 'professional':
        return {
          backgroundColor: "#f8f9fa",
          fontFamily: `'${portfolioPage.font_family || 'Georgia'}', serif`,
          color: "#2c3e50",
          accentColor: "#3b82f6",
          cardBg: "#ffffff",
          borderColor: "#d1d5db",
          primaryColor: "#3b82f6",
          secondaryColor: "#1e40af"
        };
      case 'creative':
        return {
          backgroundColor: "#fff8f3",
          fontFamily: `'${portfolioPage.font_family || 'Poppins'}', sans-serif`,
          color: "#333333",
          accentColor: "#a855f7",
          cardBg: "#fef7ff",
          borderColor: "#e879f9",
          primaryColor: "#a855f7",
          secondaryColor: "#7c3aed"
        };
      case 'modern':
        return {
          backgroundColor: "#f0fdf4",
          fontFamily: `'${portfolioPage.font_family || 'Inter'}', sans-serif`,
          color: "#065f46",
          accentColor: "#10b981",
          cardBg: "#ffffff",
          borderColor: "#6ee7b7",
          primaryColor: "#10b981",
          secondaryColor: "#059669"
        };
      case 'elegant':
        return {
          backgroundColor: "#fef2f2",
          fontFamily: `'${portfolioPage.font_family || 'Playfair Display'}', serif`,
          color: "#7f1d1d",
          accentColor: "#dc2626",
          cardBg: "#ffffff",
          borderColor: "#fca5a5",
          primaryColor: "#dc2626",
          secondaryColor: "#b91c1c"
        };
      default:
        return {
          backgroundColor: "#ffffff",
          fontFamily: `'${portfolioPage.font_family || 'system-ui'}', sans-serif`,
          color: "#111827",
          accentColor: "#3b82f6",
          cardBg: "#f9fafb",
          borderColor: "#e5e7eb",
          primaryColor: "#3b82f6",
          secondaryColor: "#a855f7"
        };
    }
  };

  const themeStyles = getThemeStyles();

  return (
    <div 
      style={{ 
        backgroundColor: themeStyles.backgroundColor,
        fontFamily: themeStyles.fontFamily,
        color: themeStyles.color,
        minHeight: '100vh'
      }}
      className="pb-12"
    >
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-3" style={{ color: themeStyles.color }}>
            {portfolioPage.title}
          </h1>
          {portfolioPage.description && (
            <p className="text-lg opacity-75 max-w-2xl mx-auto">
              {portfolioPage.description}
            </p>
          )}
        </header>
        
        {/* Profile section */}
        {portfolioPage.profile_data && (
          <div className="mb-12 text-center">
            {portfolioPage.profile_data.professional_summary && (
              <p className="text-lg mb-6 max-w-3xl mx-auto">
                {portfolioPage.profile_data.professional_summary}
              </p>
            )}

            {/* Contact Information */}
            {portfolioPage.profile_data.location && (
              <div className="mb-4">
                <p style={{ color: themeStyles.accentColor }}>📍 You can find me in {portfolioPage.profile_data.location}</p>
              </div>
            )}

            {/* Hire Me Button */}
            {portfolioPage.profile_data.email && (
              <div className="mb-6">
                <a
                  href={`mailto:${portfolioPage.profile_data.email}`}
                  className="inline-flex items-center gap-2 px-8 py-3 text-white rounded-lg hover:opacity-90 transition-colors text-lg font-medium"
                  style={{ backgroundColor: themeStyles.primaryColor }}
                >
                  <Mail className="h-5 w-5" />
                  Hire Me
                </a>
              </div>
            )}
            
            {portfolioPage.profile_data.skills && portfolioPage.profile_data.skills.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4" style={{ color: themeStyles.color }}>Skills & Technologies</h3>
                <div className="flex flex-wrap justify-center gap-2">
                  {portfolioPage.profile_data.skills.map((skill, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className="text-sm px-3 py-1 text-white font-medium border-0"
                      style={{ backgroundColor: themeStyles.primaryColor }}
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Experience Section */}
            {portfolioPage.profile_data.experience && portfolioPage.profile_data.experience.length > 0 && (
              <div className="mb-8 text-left max-w-3xl mx-auto">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-2" style={{ color: themeStyles.color }}>
                  💼 Experience
                </h3>
                <div className="space-y-6">
                  {portfolioPage.profile_data.experience.map((exp, index) => (
                    <div key={index} className="border-l-4 pl-4" style={{ borderColor: themeStyles.primaryColor }}>
                      <h4 className="text-lg font-semibold" style={{ color: themeStyles.color }}>{exp.role}</h4>
                      <p className="font-medium" style={{ color: themeStyles.primaryColor }}>{exp.company}</p>
                      <p className="text-sm" style={{ color: themeStyles.accentColor }}>{exp.startDate} - {exp.endDate || 'Present'}</p>
                      {exp.description && (
                        <p className="text-sm mt-2" style={{ color: themeStyles.accentColor }}>{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education Section */}
            {portfolioPage.profile_data.education && portfolioPage.profile_data.education.length > 0 && (
              <div className="mb-8 text-left max-w-3xl mx-auto">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-2" style={{ color: themeStyles.color }}>
                  🎓 Education
                </h3>
                <div className="space-y-6">
                  {portfolioPage.profile_data.education.map((edu, index) => (
                    <div key={index} className="border-l-4 pl-4" style={{ borderColor: themeStyles.secondaryColor }}>
                      <h4 className="text-lg font-semibold" style={{ color: themeStyles.color }}>{edu.degree}</h4>
                      <p className="font-medium" style={{ color: themeStyles.secondaryColor }}>{edu.institution}</p>
                      {edu.graduationYear && (
                        <p className="text-sm" style={{ color: themeStyles.accentColor }}>{edu.graduationYear}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Projects Section */}
        {portfolioPage.projects && portfolioPage.projects.length > 0 ? (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-center mb-8" style={{ color: themeStyles.color }}>
              Projects
            </h2>
            {portfolioPage.projects.map((projectItem) => (
              <div 
                key={projectItem.id} 
                className="rounded-lg shadow-lg p-6 border hover:shadow-xl transition-shadow"
                style={{ 
                  backgroundColor: themeStyles.cardBg,
                  borderColor: themeStyles.borderColor
                }}
              >
                <h3 className="text-xl font-bold mb-3" style={{ color: themeStyles.color }}>
                  {projectItem.project?.title}
                </h3>
                <p className="mb-4" style={{ color: themeStyles.accentColor }}>
                  {projectItem.custom_description || projectItem.project?.description}
                </p>
                
                {/* Skills tags */}
                {projectItem.project?.required_skills && projectItem.project.required_skills.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {projectItem.project.required_skills.map((skill, index) => (
                        <Badge 
                          key={index} 
                          variant="outline" 
                          className="text-xs text-white border-0"
                          style={{ backgroundColor: themeStyles.primaryColor }}
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Project links */}
                {(projectItem.project?.github_url || projectItem.project?.live_url) && (
                  <div className="flex gap-3">
                    {projectItem.project?.github_url && (
                      <a
                        href={formatUrl(projectItem.project.github_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: themeStyles.primaryColor }}
                      >
                        <Github className="h-4 w-4" />
                        View Code
                      </a>
                    )}
                    {projectItem.project?.live_url && (
                      <a
                        href={formatUrl(projectItem.project.live_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-gray-50 transition-colors"
                        style={{ 
                          color: themeStyles.primaryColor,
                          borderColor: themeStyles.primaryColor
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                        Live Demo
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-xl opacity-60">No projects to display</p>
          </div>
        )}
      </div>
    </div>
  );
}
