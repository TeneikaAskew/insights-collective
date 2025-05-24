
import React from 'react';
import { PortfolioPage } from '@/types/portfolio';
import { EnhancedProjectCard } from '../EnhancedProjectCard';

interface GridLayoutProps {
  portfolioPage: PortfolioPage;
}

export function GridLayout({ portfolioPage }: GridLayoutProps) {
  const getThemeStyles = () => {
    switch (portfolioPage.theme) {
      case 'minimal':
        return {
          backgroundColor: "#ffffff",
          fontFamily: "'Inter', sans-serif",
          color: "#333333",
          accentColor: "#6b7280"
        };
      case 'professional':
        return {
          backgroundColor: "#f8f9fa",
          fontFamily: "'Georgia', serif",
          color: "#2c3e50",
          accentColor: "#3b82f6"
        };
      case 'creative':
        return {
          backgroundColor: "#fff8f3",
          fontFamily: "'Poppins', sans-serif",
          color: "#333333",
          accentColor: "#a855f7"
        };
      case 'modern':
        return {
          backgroundColor: "#f0fdf4",
          fontFamily: "'Inter', sans-serif",
          color: "#065f46",
          accentColor: "#10b981"
        };
      case 'elegant':
        return {
          backgroundColor: "#fef2f2",
          fontFamily: "'Playfair Display', serif",
          color: "#7f1d1d",
          accentColor: "#dc2626"
        };
      default:
        return {
          backgroundColor: "#ffffff",
          fontFamily: "'system-ui', sans-serif",
          color: "#111827",
          accentColor: "#3b82f6"
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
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-6" style={{ color: themeStyles.color }}>
            {portfolioPage.title}
          </h1>
          {portfolioPage.description && (
            <p className="text-xl max-w-2xl mx-auto opacity-80">
              {portfolioPage.description}
            </p>
          )}
        </div>

        {/* Profile Summary */}
        {portfolioPage.profile_data?.professional_summary && (
          <div className="max-w-4xl mx-auto mb-16 text-center">
            <p className="text-lg leading-relaxed">
              {portfolioPage.profile_data.professional_summary}
            </p>
          </div>
        )}

        {/* Projects Grid */}
        {portfolioPage.projects && portfolioPage.projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {portfolioPage.projects.map((projectItem) => (
              <EnhancedProjectCard
                key={projectItem.id}
                projectItem={projectItem}
                theme={portfolioPage.theme}
                layout="grid"
              />
            ))}
          </div>
        )}

        {(!portfolioPage.projects || portfolioPage.projects.length === 0) && (
          <div className="text-center py-20">
            <p className="text-xl opacity-60">No projects to display</p>
          </div>
        )}
      </div>
    </div>
  );
}
