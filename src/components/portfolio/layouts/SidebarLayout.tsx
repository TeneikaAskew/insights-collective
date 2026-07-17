
import React from 'react';
import { PortfolioPage } from '@/types/portfolio';
import { EnhancedProjectCard } from '../EnhancedProjectCard';
import { Badge } from '@/components/ui/badge';
import { Mail, Github, Linkedin, MapPin, Briefcase, GraduationCap } from 'lucide-react';

interface SidebarLayoutProps {
  portfolioPage: PortfolioPage;
}

export function SidebarLayout({ portfolioPage }: SidebarLayoutProps) {
  const getThemeStyles = () => {
    switch (portfolioPage.theme) {
      case 'minimal':
        return {
          backgroundColor: "#ffffff",
          fontFamily: `'${portfolioPage.font_family || 'Inter'}', sans-serif`,
          color: "#333333",
          accentColor: "#6b7280",
          sidebarBg: "#f9fafb",
          primaryColor: "#6b7280",
          secondaryColor: "#9ca3af"
        };
      case 'professional':
        return {
          backgroundColor: "#f8f9fa",
          fontFamily: `'${portfolioPage.font_family || 'Georgia'}', serif`,
          color: "#2c3e50",
          accentColor: "#3b82f6",
          sidebarBg: "#ffffff",
          primaryColor: "#3b82f6",
          secondaryColor: "#1e40af"
        };
      case 'creative':
        return {
          backgroundColor: "#fff8f3",
          fontFamily: `'${portfolioPage.font_family || 'Poppins'}', sans-serif`,
          color: "#333333",
          accentColor: "#a855f7",
          sidebarBg: "#fef7ff",
          primaryColor: "#a855f7",
          secondaryColor: "#7c3aed"
        };
      case 'modern':
        return {
          backgroundColor: "#f0fdf4",
          fontFamily: `'${portfolioPage.font_family || 'Inter'}', sans-serif`,
          color: "#065f46",
          accentColor: "#10b981",
          sidebarBg: "#ffffff",
          primaryColor: "#10b981",
          secondaryColor: "#059669"
        };
      case 'elegant':
        return {
          backgroundColor: "#fef2f2",
          fontFamily: `'${portfolioPage.font_family || 'Playfair Display'}', serif`,
          color: "#7f1d1d",
          accentColor: "#dc2626",
          sidebarBg: "#ffffff",
          primaryColor: "#dc2626",
          secondaryColor: "#b91c1c"
        };
      default:
        return {
          backgroundColor: "#ffffff",
          fontFamily: `'${portfolioPage.font_family || 'system-ui'}', sans-serif`,
          color: "#111827",
          accentColor: "#3b82f6",
          sidebarBg: "#f9fafb",
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
      className="flex"
    >
      {/* Sidebar */}
      <div 
        className="w-1/3 p-8 min-h-screen"
        style={{ backgroundColor: themeStyles.sidebarBg }}
      >
        <div className="sticky top-8">
          {/* Profile Image */}
          {portfolioPage.profile_data?.avatar_url && (
            <div className="mb-6">
              <img 
                src={portfolioPage.profile_data.avatar_url} 
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover border-4"
                style={{ borderColor: themeStyles.primaryColor }}
              />
            </div>
          )}

          <h1 className="text-3xl font-bold mb-2" style={{ color: themeStyles.color }}>
            {portfolioPage.title}
          </h1>
          
          {portfolioPage.profile_data?.location && (
            <p className="mb-4 inline-flex items-center gap-1" style={{ color: themeStyles.accentColor }}>
              <MapPin className="h-4 w-4" /> {portfolioPage.profile_data.location}
            </p>
          )}

          {portfolioPage.description && (
            <p className="text-lg mb-6 opacity-80">
              {portfolioPage.description}
            </p>
          )}

          {portfolioPage.profile_data?.professional_summary && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-3">About</h2>
              <p className="leading-relaxed">
                {portfolioPage.profile_data.professional_summary}
              </p>
            </div>
          )}

          {/* Social Links */}
          {(portfolioPage.profile_data?.github_url || portfolioPage.profile_data?.linkedin_url) && (
            <div className="flex gap-3 mb-6">
              {portfolioPage.profile_data?.github_url && (
                <a
                  href={portfolioPage.profile_data.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:opacity-80 transition-all"
                  style={{ backgroundColor: themeStyles.primaryColor, color: 'white' }}
                >
                  <Github className="h-5 w-5" />
                </a>
              )}
              {portfolioPage.profile_data?.linkedin_url && (
                <a
                  href={portfolioPage.profile_data.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:opacity-80 transition-all"
                  style={{ backgroundColor: themeStyles.primaryColor, color: 'white' }}
                >
                  <Linkedin className="h-5 w-5" />
                </a>
              )}
            </div>
          )}

          {/* Hire Me Button */}
          {portfolioPage.profile_data?.email && (
            <div className="mb-6">
              <a
                href={`mailto:${portfolioPage.profile_data.email}`}
                className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-lg hover:opacity-90 transition-all font-medium w-full justify-center shadow-md"
                style={{ 
                  backgroundColor: themeStyles.primaryColor,
                  boxShadow: `0 4px 14px 0 ${themeStyles.primaryColor}30`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = `0 6px 20px 0 ${themeStyles.primaryColor}40`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = `0 4px 14px 0 ${themeStyles.primaryColor}30`;
                }}
              >
                <Mail className="h-4 w-4" />
                Hire Me
              </a>
            </div>
          )}

          {portfolioPage.profile_data?.skills && portfolioPage.profile_data.skills.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-3">Skills & Technologies</h2>
              <div className="flex flex-wrap gap-2">
                {portfolioPage.profile_data.skills.map((skill, index) => (
                  <span
                    key={index} 
                    className="px-3 py-1 rounded-full text-sm font-medium text-white transition-all"
                    style={{ 
                      backgroundColor: themeStyles.primaryColor
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Experience Section */}
          {portfolioPage.profile_data?.experience && portfolioPage.profile_data.experience.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" style={{ color: themeStyles.color }}>
                <Briefcase className="h-5 w-5" /> Experience
              </h2>
              <div className="space-y-4">
                {portfolioPage.profile_data.experience.slice(0, 2).map((exp, index) => (
                  <div key={index} className="border-l-4 pl-4" style={{ borderColor: themeStyles.primaryColor }}>
                    <h4 className="font-semibold" style={{ color: themeStyles.color }}>{exp.role}</h4>
                    <p className="text-sm font-medium" style={{ color: themeStyles.primaryColor }}>{exp.company}</p>
                    <p className="text-xs" style={{ color: themeStyles.accentColor }}>{exp.startDate} - {exp.endDate || 'Present'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education Section */}
          {portfolioPage.profile_data?.education && portfolioPage.profile_data.education.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" style={{ color: themeStyles.color }}>
                🎓 Education
              </h2>
              <div className="space-y-4">
                {portfolioPage.profile_data.education.slice(0, 2).map((edu, index) => (
                  <div key={index} className="border-l-4 pl-4" style={{ borderColor: themeStyles.secondaryColor }}>
                    <h4 className="font-semibold" style={{ color: themeStyles.color }}>{edu.degree}</h4>
                    <p className="text-sm font-medium" style={{ color: themeStyles.secondaryColor }}>{edu.institution}</p>
                    <p className="text-xs" style={{ color: themeStyles.accentColor }}>{edu.graduationYear}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-2" style={{ color: themeStyles.color }}>
          ⭐ Featured Project
        </h2>
        
        {portfolioPage.projects && portfolioPage.projects.length > 0 ? (
          <div className="grid gap-8">
            {portfolioPage.projects.map((projectItem) => (
              <div 
                key={projectItem.id}
                className="bg-white rounded-lg shadow-lg p-6 border hover:shadow-xl transition-all"
                style={{ borderColor: `${themeStyles.primaryColor}20` }}
              >
                <h3 className="text-xl font-bold mb-3" style={{ color: themeStyles.color }}>
                  {projectItem.project?.title}
                </h3>
                <p className="text-gray-600 mb-4 leading-relaxed">
                  {projectItem.custom_description || projectItem.project?.description}
                </p>
                
                {/* Tech Stack */}
                {projectItem.project?.required_skills && projectItem.project.required_skills.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide" style={{ color: themeStyles.accentColor }}>
                      Tech Stack
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {projectItem.project.required_skills.map((skill, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 rounded-full text-sm font-medium text-white"
                          style={{ backgroundColor: themeStyles.primaryColor }}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Project Stats */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {projectItem.project?.effort_level && (
                    <div>
                      <span className="text-sm font-medium" style={{ color: themeStyles.accentColor }}>Effort:</span>
                      <span className="ml-2 text-sm">{projectItem.project.effort_level}</span>
                    </div>
                  )}
                  {projectItem.project?.impact && (
                    <div>
                      <span className="text-sm font-medium" style={{ color: themeStyles.accentColor }}>Impact:</span>
                      <span className="ml-2 text-sm">{projectItem.project.impact}</span>
                    </div>
                  )}
                </div>

                {/* Key Achievements */}
                {projectItem.project?.roadmap?.milestones && projectItem.project.roadmap.milestones.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide" style={{ color: themeStyles.accentColor }}>
                      Key Achievements
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {projectItem.project.roadmap.milestones.slice(0, 3).map((milestone, index) => (
                        <li key={index} style={{ color: themeStyles.color }}>{milestone}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Project Links */}
                {(projectItem.project?.github_url || projectItem.project?.live_url) && (
                  <div className="flex gap-3">
                    {projectItem.project?.github_url && (
                      <a
                        href={projectItem.project.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg hover:opacity-90 transition-all text-white font-medium"
                        style={{ backgroundColor: themeStyles.primaryColor }}
                      >
                        <Github className="h-4 w-4" />
                        View Code
                      </a>
                    )}
                    {projectItem.project?.live_url && (
                      <a
                        href={projectItem.project.live_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg hover:opacity-90 transition-all font-medium border"
                        style={{ 
                          color: themeStyles.primaryColor,
                          borderColor: themeStyles.primaryColor
                        }}
                      >
                        Live Demo
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            {/* More Projects Section */}
            {portfolioPage.projects.length > 1 && (
              <div className="mt-12">
                <h2 className="text-2xl font-bold mb-8" style={{ color: themeStyles.color }}>
                  More Projects
                </h2>
                <div className="grid gap-6">
                  {portfolioPage.projects.slice(1).map((projectItem) => (
                    <div 
                      key={projectItem.id}
                      className="bg-white rounded-lg shadow-md p-4 border hover:shadow-lg transition-all"
                      style={{ borderColor: `${themeStyles.primaryColor}20` }}
                    >
                      <h3 className="text-lg font-semibold mb-2" style={{ color: themeStyles.color }}>
                        {projectItem.project?.title}
                      </h3>
                      <p className="text-gray-600 text-sm mb-3">
                        {projectItem.custom_description || projectItem.project?.description}
                      </p>
                      
                      {projectItem.project?.required_skills && projectItem.project.required_skills.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {projectItem.project.required_skills.slice(0, 3).map((skill, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 rounded text-xs font-medium text-white"
                              style={{ backgroundColor: themeStyles.primaryColor }}
                            >
                              {skill}
                            </span>
                          ))}
                          {projectItem.project.required_skills.length > 3 && (
                            <span className="px-2 py-1 rounded text-xs" style={{ color: themeStyles.accentColor }}>
                              +{projectItem.project.required_skills.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
