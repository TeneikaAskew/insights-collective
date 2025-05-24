
import React from 'react';
import { PortfolioPage } from '@/types/portfolio';
import { EnhancedProjectCard } from '../EnhancedProjectCard';
import { Badge } from '@/components/ui/badge';
import { Mail } from 'lucide-react';

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
          accentColor: "#6b7280",
          primaryColor: "#6b7280",
          secondaryColor: "#9ca3af"
        };
      case 'professional':
        return {
          backgroundColor: "#f8f9fa",
          fontFamily: "'Georgia', serif",
          color: "#2c3e50",
          accentColor: "#3b82f6",
          primaryColor: "#3b82f6",
          secondaryColor: "#1e40af"
        };
      case 'creative':
        return {
          backgroundColor: "#fff8f3",
          fontFamily: "'Poppins', sans-serif",
          color: "#333333",
          accentColor: "#a855f7",
          primaryColor: "#a855f7",
          secondaryColor: "#7c3aed"
        };
      case 'modern':
        return {
          backgroundColor: "#f0fdf4",
          fontFamily: "'Inter', sans-serif",
          color: "#065f46",
          accentColor: "#10b981",
          primaryColor: "#10b981",
          secondaryColor: "#059669"
        };
      case 'elegant':
        return {
          backgroundColor: "#fef2f2",
          fontFamily: "'Playfair Display', serif",
          color: "#7f1d1d",
          accentColor: "#dc2626",
          primaryColor: "#dc2626",
          secondaryColor: "#b91c1c"
        };
      default:
        return {
          backgroundColor: "#ffffff",
          fontFamily: "'system-ui', sans-serif",
          color: "#111827",
          accentColor: "#3b82f6",
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

        {/* Contact Information */}
        {portfolioPage.profile_data?.location && (
          <div className="text-center mb-6">
            <p className="text-gray-600">📍 You can find me in {portfolioPage.profile_data.location}</p>
          </div>
        )}

        {/* Hire Me Button */}
        {portfolioPage.profile_data?.email && (
          <div className="text-center mb-8">
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

        {/* Skills Section */}
        {portfolioPage.profile_data?.skills && portfolioPage.profile_data.skills.length > 0 && (
          <div className="max-w-4xl mx-auto mb-16 text-center">
            <h3 className="text-2xl font-bold mb-6" style={{ color: themeStyles.color }}>Skills & Technologies</h3>
            <div className="flex flex-wrap justify-center gap-3">
              {portfolioPage.profile_data.skills.map((skill, index) => (
                <Badge 
                  key={index} 
                  variant="secondary" 
                  className="text-sm px-4 py-2 text-white font-medium"
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

        {/* Experience and Education in Grid */}
        <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto mb-16">
          {/* Experience Section */}
          {portfolioPage.profile_data?.experience && portfolioPage.profile_data.experience.length > 0 && (
            <div>
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2" style={{ color: themeStyles.color }}>
                💼 Experience
              </h3>
              <div className="space-y-6">
                {portfolioPage.profile_data.experience.map((exp, index) => (
                  <div key={index} className="border-l-4 pl-4" style={{ borderColor: themeStyles.primaryColor }}>
                    <h4 className="text-lg font-semibold" style={{ color: themeStyles.color }}>{exp.position}</h4>
                    <p className="font-medium" style={{ color: themeStyles.primaryColor }}>{exp.company}</p>
                    <p className="text-gray-600 text-sm">{exp.start_date} - {exp.end_date || 'Present'}</p>
                    {exp.description && (
                      <p className="text-gray-700 text-sm mt-2">{exp.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education Section */}
          {portfolioPage.profile_data?.education && portfolioPage.profile_data.education.length > 0 && (
            <div>
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2" style={{ color: themeStyles.color }}>
                🎓 Education
              </h3>
              <div className="space-y-6">
                {portfolioPage.profile_data.education.map((edu, index) => (
                  <div key={index} className="border-l-4 pl-4" style={{ borderColor: themeStyles.secondaryColor }}>
                    <h4 className="text-lg font-semibold" style={{ color: themeStyles.color }}>{edu.degree}</h4>
                    <p className="font-medium" style={{ color: themeStyles.secondaryColor }}>{edu.institution}</p>
                    {edu.graduation_date && (
                      <p className="text-gray-600 text-sm">{edu.graduation_date}</p>
                    )}
                    {edu.gpa && (
                      <p className="text-gray-700 text-sm">GPA: {edu.gpa}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Projects Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center" style={{ color: themeStyles.color }}>
            Projects
          </h2>
          
          {portfolioPage.projects && portfolioPage.projects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {portfolioPage.projects.map((projectItem) => (
                <EnhancedProjectCard
                  key={projectItem.id}
                  projectItem={projectItem}
                  theme={portfolioPage.theme}
                  layout="grid"
                  themeColors={{
                    primary: themeStyles.primaryColor,
                    secondary: themeStyles.secondaryColor,
                    accent: themeStyles.accentColor
                  }}
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
    </div>
  );
}
