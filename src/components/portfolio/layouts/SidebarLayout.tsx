
import React from 'react';
import { PortfolioPage } from '@/types/portfolio';
import { EnhancedProjectCard } from '../EnhancedProjectCard';
import { Badge } from '@/components/ui/badge';
import { Mail } from 'lucide-react';

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
          <h1 className="text-3xl font-bold mb-4" style={{ color: themeStyles.color }}>
            {portfolioPage.title}
          </h1>
          
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

          {/* Contact Information */}
          {portfolioPage.profile_data?.location && (
            <div className="mb-4">
              <p style={{ color: themeStyles.accentColor }}>📍 You can find me in {portfolioPage.profile_data.location}</p>
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
              <h2 className="text-xl font-semibold mb-3">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {portfolioPage.profile_data.skills.map((skill, index) => (
                  <Badge 
                    key={index} 
                    variant="outline"
                    className="text-white font-medium border-0 transition-all"
                    style={{ 
                      backgroundColor: themeStyles.primaryColor,
                      color: 'white'
                    }}
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Experience Section */}
          {portfolioPage.profile_data?.experience && portfolioPage.profile_data.experience.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-3" style={{ color: themeStyles.color }}>💼 Experience</h2>
              <div className="space-y-4">
                {portfolioPage.profile_data.experience.slice(0, 2).map((exp, index) => (
                  <div key={index} className="border-l-3 pl-4" style={{ borderColor: themeStyles.primaryColor }}>
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
              <h2 className="text-xl font-semibold mb-3" style={{ color: themeStyles.color }}>🎓 Education</h2>
              <div className="space-y-4">
                {portfolioPage.profile_data.education.slice(0, 2).map((edu, index) => (
                  <div key={index} className="border-l-3 pl-4" style={{ borderColor: themeStyles.secondaryColor }}>
                    <h4 className="font-semibold" style={{ color: themeStyles.color }}>{edu.degree}</h4>
                    <p className="text-sm font-medium" style={{ color: themeStyles.secondaryColor }}>{edu.institution}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-8" style={{ color: themeStyles.color }}>
          Projects
        </h2>
        
        {portfolioPage.projects && portfolioPage.projects.length > 0 ? (
          <div className="grid gap-8">
            {portfolioPage.projects.map((projectItem) => (
              <EnhancedProjectCard
                key={projectItem.id}
                projectItem={projectItem}
                theme={portfolioPage.theme}
                layout="sidebar"
                themeColors={{
                  primary: themeStyles.primaryColor,
                  secondary: themeStyles.secondaryColor,
                  accent: themeStyles.accentColor
                }}
              />
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
