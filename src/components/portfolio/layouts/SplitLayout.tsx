
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  Mail, 
  MapPin, 
  Github, 
  Linkedin, 
  Briefcase,
  GraduationCap
} from 'lucide-react';
import { PortfolioPage, ProfileData } from '@/types/portfolio';
import { EnhancedProjectCard } from '../EnhancedProjectCard';

interface SplitLayoutProps {
  portfolioPage: PortfolioPage;
}

export function SplitLayout({ portfolioPage }: SplitLayoutProps) {
  const profileData: ProfileData = portfolioPage.profile_data || {};

  const getThemeStyles = () => {
    switch (portfolioPage.theme) {
      case 'minimal':
        return {
          backgroundColor: "#ffffff",
          fontFamily: `'${portfolioPage.font_family || 'Inter'}', sans-serif`,
          color: "#333333",
          accentColor: "#6b7280",
          primaryColor: "#6b7280",
          secondaryColor: "#9ca3af",
          cardBg: "#f9fafb",
          borderColor: "#e5e7eb"
        };
      case 'professional':
        return {
          backgroundColor: "#f8f9fa",
          fontFamily: `'${portfolioPage.font_family || 'Georgia'}', serif`,
          color: "#2c3e50",
          accentColor: "#3b82f6",
          primaryColor: "#3b82f6",
          secondaryColor: "#1e40af",
          cardBg: "#ffffff",
          borderColor: "#d1d5db"
        };
      case 'creative':
        return {
          backgroundColor: "#fff8f3",
          fontFamily: `'${portfolioPage.font_family || 'Poppins'}', sans-serif`,
          color: "#333333",
          accentColor: "#a855f7",
          primaryColor: "#a855f7",
          secondaryColor: "#7c3aed",
          cardBg: "#fef7ff",
          borderColor: "#e879f9"
        };
      case 'modern':
        return {
          backgroundColor: "#f0fdf4",
          fontFamily: `'${portfolioPage.font_family || 'Inter'}', sans-serif`,
          color: "#065f46",
          accentColor: "#10b981",
          primaryColor: "#10b981",
          secondaryColor: "#059669",
          cardBg: "#ffffff",
          borderColor: "#6ee7b7"
        };
      case 'elegant':
        return {
          backgroundColor: "#fef2f2",
          fontFamily: `'${portfolioPage.font_family || 'Playfair Display'}', serif`,
          color: "#7f1d1d",
          accentColor: "#dc2626",
          primaryColor: "#dc2626",
          secondaryColor: "#b91c1c",
          cardBg: "#ffffff",
          borderColor: "#fca5a5"
        };
      default:
        return {
          backgroundColor: "#ffffff",
          fontFamily: `'${portfolioPage.font_family || 'system-ui'}', sans-serif`,
          color: "#111827",
          accentColor: "#3b82f6",
          primaryColor: "#3b82f6",
          secondaryColor: "#a855f7",
          cardBg: "#f9fafb",
          borderColor: "#e5e7eb"
        };
    }
  };

  const themeStyles = getThemeStyles();

  const getInitials = () => {
    if (profileData.professional_summary) {
      const words = profileData.professional_summary.split(' ');
      if (words.length >= 2) {
        return `${words[0][0]}${words[1][0]}`.toUpperCase();
      }
    }
    return 'DS';
  };

  const handleHireMe = () => {
    if (profileData.email) {
      const subject = encodeURIComponent("Hire Me - Portfolio Inquiry");
      const body = encodeURIComponent(`Hi, I saw your portfolio and I'm interested in discussing opportunities with you.`);
      window.open(`mailto:${profileData.email}?subject=${subject}&body=${body}`);
    }
  };

  const formatDateRange = (startDate?: string, endDate?: string) => {
    if (!startDate) return '';
    
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      try {
        const [year, month] = dateStr.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
      } catch {
        return dateStr;
      }
    };

    const start = formatDate(startDate);
    const end = endDate ? formatDate(endDate) : 'Present';
    return `${start} - ${end}`;
  };

  // Helper function to get location display
  const getLocationDisplay = () => {
    const location = profileData?.location_details;
    if (!location) {
      // Fallback to old location field for backward compatibility
      return profileData?.location || '';
    }
    
    const parts = [];
    if (location.city) parts.push(location.city);
    if (location.state) parts.push(location.state);
    if (location.country) parts.push(location.country);
    
    return parts.length > 0 ? `You can find me in ${parts.join(', ')}` : '';
  };

  return (
    <div 
      className="min-h-screen"
      style={{ 
        backgroundColor: themeStyles.backgroundColor,
        fontFamily: themeStyles.fontFamily,
        color: themeStyles.color
      }}
    >
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid lg:grid-cols-2 gap-8 min-h-screen">
          {/* Left Side - Profile */}
          <div 
            className="rounded-lg shadow-lg p-8 h-fit sticky top-6"
            style={{ backgroundColor: themeStyles.cardBg }}
          >
            <div className="text-center mb-8">
              <Avatar className="w-32 h-32 mx-auto mb-6 border-4 border-white shadow-lg">
                <AvatarImage src={profileData.avatar_url} />
                <AvatarFallback 
                  className="text-2xl text-white"
                  style={{ backgroundColor: themeStyles.primaryColor }}
                >
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <h1 className="text-3xl font-bold mb-4" style={{ color: themeStyles.color }}>
                {portfolioPage.title}
              </h1>
              {portfolioPage.description && (
                <p className="text-lg mb-6" style={{ color: themeStyles.accentColor }}>
                  {portfolioPage.description}
                </p>
              )}
              {profileData.professional_summary && (
                <p className="mb-6" style={{ color: themeStyles.accentColor }}>
                  {profileData.professional_summary}
                </p>
              )}
            </div>

            {/* Contact Info */}
            <div className="space-y-4 mb-8">
              {getLocationDisplay() && (
                <div className="flex items-center gap-3" style={{ color: themeStyles.accentColor }}>
                  <MapPin className="h-5 w-5" />
                  {getLocationDisplay()}
                </div>
              )}
              {profileData.github_url && (
                <a 
                  href={profileData.github_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-3 transition-colors"
                  style={{ color: themeStyles.accentColor }}
                  onMouseEnter={(e) => e.currentTarget.style.color = themeStyles.primaryColor}
                  onMouseLeave={(e) => e.currentTarget.style.color = themeStyles.accentColor}
                >
                  <Github className="h-5 w-5" />
                  GitHub
                </a>
              )}
              {profileData.linkedin_url && (
                <a 
                  href={profileData.linkedin_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-3 transition-colors"
                  style={{ color: themeStyles.accentColor }}
                  onMouseEnter={(e) => e.currentTarget.style.color = themeStyles.primaryColor}
                  onMouseLeave={(e) => e.currentTarget.style.color = themeStyles.accentColor}
                >
                  <Linkedin className="h-5 w-5" />
                  LinkedIn
                </a>
              )}
              {profileData.email && (
                <Button 
                  onClick={handleHireMe} 
                  className="w-full text-white transition-all shadow-md"
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
                  <Mail className="h-5 w-5 mr-2" />
                  Hire Me
                </Button>
              )}
            </div>

            {/* Skills */}
            {profileData.skills && profileData.skills.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4" style={{ color: themeStyles.color }}>
                  Skills & Technologies
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profileData.skills.map((skill, index) => (
                    <Badge 
                      key={index} 
                      variant="outline" 
                      className="px-3 py-1 text-white border-0"
                      style={{ backgroundColor: themeStyles.primaryColor }}
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Experience */}
            {profileData.experience && profileData.experience.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: themeStyles.color }}>
                  <Briefcase className="h-5 w-5" />
                  Experience
                </h3>
                <div className="space-y-4">
                  {profileData.experience.map((exp) => (
                    <div key={exp.id} className="border-l-4 pl-4" style={{ borderColor: themeStyles.primaryColor }}>
                      <h4 className="font-semibold" style={{ color: themeStyles.color }}>{exp.role}</h4>
                      <p className="font-medium" style={{ color: themeStyles.primaryColor }}>{exp.company}</p>
                      <p className="text-sm" style={{ color: themeStyles.accentColor }}>
                        {formatDateRange(exp.startDate, exp.endDate)}
                      </p>
                      {exp.description && (
                        <p className="text-sm mt-1" style={{ color: themeStyles.accentColor }}>{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {profileData.education && profileData.education.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: themeStyles.color }}>
                  <GraduationCap className="h-5 w-5" />
                  Education
                </h3>
                <div className="space-y-4">
                  {profileData.education.map((edu) => (
                    <div key={edu.id} className="border-l-4 pl-4" style={{ borderColor: themeStyles.secondaryColor }}>
                      <h4 className="font-semibold" style={{ color: themeStyles.color }}>{edu.degree}</h4>
                      <p className="font-medium" style={{ color: themeStyles.secondaryColor }}>{edu.institution}</p>
                      <p className="text-sm" style={{ color: themeStyles.accentColor }}>{edu.graduationYear}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Side - Projects */}
          <div className="space-y-8">
            <h2 className="text-2xl font-bold" style={{ color: themeStyles.color }}>
              Featured Projects
            </h2>
            {portfolioPage.projects && portfolioPage.projects.length > 0 ? (
              <div className="space-y-6">
                {portfolioPage.projects.map((projectItem) => (
                  <EnhancedProjectCard
                    key={projectItem.id}
                    projectItem={projectItem}
                    layout="split"
                    theme={portfolioPage.theme}
                    themeColors={{
                      primary: themeStyles.primaryColor,
                      secondary: themeStyles.secondaryColor,
                      accent: themeStyles.accentColor
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-xl" style={{ color: themeStyles.accentColor }}>
                  No projects to showcase yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
