
import React from 'react';
import { PortfolioPage } from '@/types/portfolio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Github, ExternalLink, Mail, MapPin, Briefcase, GraduationCap } from 'lucide-react';
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
          fontFamily: "'Inter', sans-serif",
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
          fontFamily: "'Georgia', serif",
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
          fontFamily: "'Poppins', sans-serif",
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
          fontFamily: "'Inter', sans-serif",
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
          fontFamily: "'Playfair Display', serif",
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
          fontFamily: "'system-ui', sans-serif",
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
                <p style={{ color: themeStyles.accentColor }} className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> You can find me in {portfolioPage.profile_data.location}</p>
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
                <h3 className="text-xl font-semibold mb-4">Skills & Technologies</h3>
                <div className="flex flex-wrap justify-center gap-2">
                  {portfolioPage.profile_data.skills.map((skill, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className="text-sm px-3 py-1 text-white font-medium"
                      style={{ 
                        backgroundColor: themeStyles.primaryColor,
                        border: 'none'
                      }}
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
                    <div key={index} className="border-l-4 pl-6" style={{ borderColor: themeStyles.primaryColor }}>
                      <h4 className="text-xl font-semibold" style={{ color: themeStyles.color }}>{exp.role}</h4>
                      <p className="text-lg font-medium" style={{ color: themeStyles.primaryColor }}>{exp.company}</p>
                      <p style={{ color: themeStyles.accentColor }} className="mb-2">{exp.startDate} - {exp.endDate || 'Present'}</p>
                      {exp.description && (
                        <p style={{ color: themeStyles.accentColor }}>{exp.description}</p>
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
                    <div key={index} className="border-l-4 pl-6" style={{ borderColor: themeStyles.secondaryColor }}>
                      <h4 className="text-xl font-semibold" style={{ color: themeStyles.color }}>{edu.degree}</h4>
                      <p className="text-lg font-medium" style={{ color: themeStyles.secondaryColor }}>{edu.institution}</p>
                      {edu.graduationYear && (
                        <p style={{ color: themeStyles.accentColor }}>{edu.graduationYear}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Projects section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-8" style={{ color: themeStyles.color }}>
            Projects
          </h2>
          
          {(!portfolioPage.projects || !Array.isArray(portfolioPage.projects) || portfolioPage.projects.length === 0) ? (
            <div className="text-center py-16">
              <p className="text-xl" style={{ color: themeStyles.accentColor }}>
                This portfolio has no projects yet.
              </p>
            </div>
          ) : (
            <div className="space-y-16">
              {portfolioPage.projects.map((projectItem) => {
                const project = projectItem.project;
                if (!project) return null;
                
                return (
                  <div 
                    key={projectItem.id} 
                    className="border-b pb-14 last:border-0"
                    style={{ borderColor: themeStyles.borderColor }}
                  >
                    <div className="grid md:grid-cols-2 gap-8 mb-6">
                      {/* Project Image */}
                      <div className="order-2 md:order-1">
                        {project.project_images && project.project_images.length > 0 ? (
                          <div className="aspect-video rounded-lg overflow-hidden">
                            <img
                              src={project.project_images[0]}
                              alt={`${project.title} screenshot`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                            <div className="hidden aspect-video rounded-lg flex items-center justify-center"
                                 style={{ backgroundColor: themeStyles.cardBg }}>
                              <div className="text-center">
                                <div 
                                  className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-2xl font-bold"
                                  style={{ backgroundColor: themeStyles.accentColor }}
                                >
                                  {project.title.charAt(0)}
                                </div>
                                <p className="text-sm" style={{ color: themeStyles.accentColor }}>Project Preview</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="aspect-video rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: themeStyles.cardBg }}
                          >
                            <div className="text-center">
                              <div 
                                className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-2xl font-bold"
                                style={{ backgroundColor: themeStyles.accentColor }}
                              >
                                {project.title.charAt(0)}
                              </div>
                              <p className="text-sm" style={{ color: themeStyles.accentColor }}>Project Preview</p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Project Info */}
                      <div className="order-1 md:order-2">
                        <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: themeStyles.color }}>
                          {project.title}
                        </h2>
                        <p className="text-lg mb-6 leading-relaxed">
                          {projectItem.custom_description || project.description}
                        </p>
                        
                        {/* Action Links */}
                        <div className="flex gap-3 mb-6">
                          {project.github_url && (
                            <a
                              href={formatUrl(project.github_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
                              style={{ backgroundColor: themeStyles.primaryColor }}
                            >
                              <Github className="h-4 w-4" />
                              Code
                            </a>
                          )}
                          {project.live_url && (
                            <a
                              href={formatUrl(project.live_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
                              style={{ backgroundColor: themeStyles.secondaryColor }}
                            >
                              <ExternalLink className="h-4 w-4" />
                              Live Demo
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {project.required_skills && project.required_skills.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold uppercase tracking-wider opacity-70">Skills</h3>
                          <div className="flex flex-wrap gap-2">
                            {project.required_skills.map((skill, i) => (
                              <Badge
                                key={i} 
                                variant="secondary"
                                className="text-sm px-3 py-1 text-white border-0"
                                style={{ 
                                  backgroundColor: themeStyles.accentColor
                                }}
                              >
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold uppercase tracking-wider opacity-70">Project Details</h3>
                        <div className="space-y-2">
                          {project.effort_level && (
                            <div>
                              <span className="font-medium">Effort:</span> {project.effort_level}
                            </div>
                          )}
                          {project.impact && (
                            <div>
                              <span className="font-medium">Impact:</span> {project.impact}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {project.roadmap && project.roadmap.milestones && project.roadmap.milestones.length > 0 && (
                      <div className="mt-8">
                        <h3 className="text-sm font-semibold uppercase tracking-wider opacity-70 mb-3">Key Achievements</h3>
                        <ul className="space-y-2 list-disc list-inside">
                          {project.roadmap.milestones.map((milestone, idx) => (
                            <li key={idx} style={{ color: themeStyles.color }}>{milestone}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      <footer className="mt-20 pt-8 border-t text-center text-sm opacity-60" style={{ borderColor: themeStyles.borderColor }}>
        <div className="container mx-auto px-4">
          <p>Portfolio created with AI Portfolio Explorer</p>
        </div>
      </footer>
    </div>
  );
}
