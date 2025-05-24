
import React from 'react';
import { PortfolioPage } from '@/types/portfolio';
import { EnhancedProjectCard } from '../EnhancedProjectCard';
import { Badge } from '@/components/ui/badge';

interface SidebarLayoutProps {
  portfolioPage: PortfolioPage;
}

export function SidebarLayout({ portfolioPage }: SidebarLayoutProps) {
  const getThemeStyles = () => {
    switch (portfolioPage.theme) {
      case 'minimal':
        return {
          backgroundColor: "#ffffff",
          fontFamily: "'Inter', sans-serif",
          color: "#333333",
          accentColor: "#6b7280",
          sidebarBg: "#f9fafb",
          primaryColor: "#6b7280",
          secondaryColor: "#9ca3af"
        };
      case 'professional':
        return {
          backgroundColor: "#f8f9fa",
          fontFamily: "'Georgia', serif",
          color: "#2c3e50",
          accentColor: "#3b82f6",
          sidebarBg: "#ffffff",
          primaryColor: "#3b82f6",
          secondaryColor: "#1e40af"
        };
      case 'creative':
        return {
          backgroundColor: "#fff8f3",
          fontFamily: "'Poppins', sans-serif",
          color: "#333333",
          accentColor: "#a855f7",
          sidebarBg: "#fef7ff",
          primaryColor: "#a855f7",
          secondaryColor: "#7c3aed"
        };
      case 'modern':
        return {
          backgroundColor: "#f0fdf4",
          fontFamily: "'Inter', sans-serif",
          color: "#065f46",
          accentColor: "#10b981",
          sidebarBg: "#ffffff",
          primaryColor: "#10b981",
          secondaryColor: "#059669"
        };
      case 'elegant':
        return {
          backgroundColor: "#fef2f2",
          fontFamily: "'Playfair Display', serif",
          color: "#7f1d1d",
          accentColor: "#dc2626",
          sidebarBg: "#ffffff",
          primaryColor: "#dc2626",
          secondaryColor: "#b91c1c"
        };
      default:
        return {
          backgroundColor: "#ffffff",
          fontFamily: "'system-ui', sans-serif",
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

          {portfolioPage.profile_data?.skills && portfolioPage.profile_data.skills.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-3">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {portfolioPage.profile_data.skills.map((skill, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary"
                    style={{ 
                      backgroundColor: `${themeStyles.accentColor}20`,
                      color: themeStyles.accentColor,
                      borderColor: themeStyles.accentColor
                    }}
                  >
                    {skill}
                  </Badge>
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
