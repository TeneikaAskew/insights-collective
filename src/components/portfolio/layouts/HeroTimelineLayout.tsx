
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
  Calendar,
  Briefcase,
  GraduationCap
} from 'lucide-react';
import { PortfolioPage, ProfileData } from '@/types/portfolio';
import { EnhancedProjectCard } from '../EnhancedProjectCard';

interface HeroTimelineLayoutProps {
  portfolioPage: PortfolioPage;
}

export function HeroTimelineLayout({ portfolioPage }: HeroTimelineLayoutProps) {
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
          heroGradient: "linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)"
        };
      case 'professional':
        return {
          backgroundColor: "#f8f9fa",
          fontFamily: `'${portfolioPage.font_family || 'Georgia'}', serif`,
          color: "#2c3e50",
          accentColor: "#3b82f6",
          primaryColor: "#3b82f6",
          secondaryColor: "#1e40af",
          heroGradient: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)"
        };
      case 'creative':
        return {
          backgroundColor: "#fff8f3",
          fontFamily: `'${portfolioPage.font_family || 'Poppins'}', sans-serif`,
          color: "#333333",
          accentColor: "#a855f7",
          primaryColor: "#a855f7",
          secondaryColor: "#7c3aed",
          heroGradient: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)"
        };
      case 'modern':
        return {
          backgroundColor: "#f0fdf4",
          fontFamily: `'${portfolioPage.font_family || 'Inter'}', sans-serif`,
          color: "#065f46",
          accentColor: "#10b981",
          primaryColor: "#10b981",
          secondaryColor: "#059669",
          heroGradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)"
        };
      case 'elegant':
        return {
          backgroundColor: "#fef2f2",
          fontFamily: `'${portfolioPage.font_family || 'Playfair Display'}', serif`,
          color: "#7f1d1d",
          accentColor: "#dc2626",
          primaryColor: "#dc2626",
          secondaryColor: "#b91c1c",
          heroGradient: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)"
        };
      default:
        return {
          backgroundColor: "#ffffff",
          fontFamily: `'${portfolioPage.font_family || 'system-ui'}', sans-serif`,
          color: "#111827",
          accentColor: "#3b82f6",
          primaryColor: "#3b82f6",
          secondaryColor: "#a855f7",
          heroGradient: "linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)"
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

  return (
    <div 
      className="min-h-screen"
      style={{ 
        backgroundColor: themeStyles.backgroundColor,
        fontFamily: themeStyles.fontFamily,
        color: themeStyles.color
      }}
    >
      {/* Hero Section */}
      <div 
        className="text-white py-20"
        style={{ background: themeStyles.heroGradient }}
      >
        <div className="max-w-4xl mx-auto text-center px-6">
          <Avatar className="w-32 h-32 mx-auto mb-6 border-4 border-white shadow-lg">
            <AvatarImage src={profileData.avatar_url} />
            <AvatarFallback className="text-2xl bg-white" style={{ color: themeStyles.primaryColor }}>
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-5xl font-bold mb-4">{portfolioPage.title}</h1>
          {portfolioPage.description && (
            <p className="text-xl mb-6 opacity-90">
              {portfolioPage.description}
            </p>
          )}
          {profileData.professional_summary && (
            <p className="text-lg mb-8 opacity-80 max-w-3xl mx-auto">
              {profileData.professional_summary}
            </p>
          )}
          
          {/* Contact Links */}
          <div className="flex justify-center gap-6 mb-8">
            {profileData.github_url && (
              <a href={profileData.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/90 hover:text-white transition-colors">
                <Github className="h-5 w-5" />
                GitHub
              </a>
            )}
            {profileData.linkedin_url && (
              <a href={profileData.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/90 hover:text-white transition-colors">
                <Linkedin className="h-5 w-5" />
                LinkedIn
              </a>
            )}
            {profileData.location && (
              <div className="flex items-center gap-2 text-white/90">
                <MapPin className="h-5 w-5" />
                {profileData.location}
              </div>
            )}
          </div>

          {profileData.email && (
            <Button 
              onClick={handleHireMe} 
              size="lg" 
              className="bg-white hover:bg-gray-100 transition-all shadow-md"
              style={{ color: themeStyles.primaryColor }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px 0 rgba(255,255,255,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(255,255,255,0.2)';
              }}
            >
              <Mail className="h-5 w-5 mr-2" />
              Hire Me
            </Button>
          )}
        </div>
      </div>

      {/* Timeline Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Skills */}
        {profileData.skills && profileData.skills.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6" style={{ color: themeStyles.color }}>
              Skills & Technologies
            </h2>
            <div className="flex flex-wrap gap-3">
              {profileData.skills.map((skill, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="px-4 py-2 text-sm text-white border-0"
                  style={{ backgroundColor: themeStyles.primaryColor }}
                >
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Experience Timeline */}
        {profileData.experience && profileData.experience.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-2" style={{ color: themeStyles.color }}>
              <Briefcase className="h-6 w-6" />
              Experience Timeline
            </h2>
            <div className="space-y-8">
              {profileData.experience.map((exp, index) => (
                <div key={exp.id} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: themeStyles.primaryColor }}
                    ></div>
                    {index < profileData.experience!.length - 1 && (
                      <div className="w-0.5 h-16 bg-gray-300 mt-2"></div>
                    )}
                  </div>
                  <div className="flex-1 bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-xl font-semibold" style={{ color: themeStyles.color }}>
                          {exp.role}
                        </h3>
                        <p className="text-lg font-medium" style={{ color: themeStyles.primaryColor }}>
                          {exp.company}
                        </p>
                      </div>
                      <span 
                        className="text-sm px-3 py-1 rounded-full"
                        style={{ 
                          color: themeStyles.accentColor,
                          backgroundColor: `${themeStyles.accentColor}20`
                        }}
                      >
                        {formatDateRange(exp.startDate, exp.endDate)}
                      </span>
                    </div>
                    {exp.description && (
                      <p style={{ color: themeStyles.accentColor }} className="leading-relaxed">
                        {exp.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education Timeline */}
        {profileData.education && profileData.education.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-2" style={{ color: themeStyles.color }}>
              <GraduationCap className="h-6 w-6" />
              Education
            </h2>
            <div className="space-y-8">
              {profileData.education.map((edu, index) => (
                <div key={edu.id} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: themeStyles.secondaryColor }}
                    ></div>
                    {index < profileData.education!.length - 1 && (
                      <div className="w-0.5 h-16 bg-gray-300 mt-2"></div>
                    )}
                  </div>
                  <div className="flex-1 bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-semibold" style={{ color: themeStyles.color }}>
                          {edu.degree}
                        </h3>
                        <p className="text-lg font-medium" style={{ color: themeStyles.secondaryColor }}>
                          {edu.institution}
                        </p>
                      </div>
                      <span 
                        className="text-sm px-3 py-1 rounded-full"
                        style={{ 
                          color: themeStyles.accentColor,
                          backgroundColor: `${themeStyles.accentColor}20`
                        }}
                      >
                        {edu.graduationYear}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects Timeline */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-8" style={{ color: themeStyles.color }}>
            Project Timeline
          </h2>
          {portfolioPage.projects && portfolioPage.projects.length > 0 ? (
            <div className="space-y-8">
              {portfolioPage.projects.map((projectItem, index) => (
                <div key={projectItem.id} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: themeStyles.primaryColor }}
                    ></div>
                    {index < portfolioPage.projects!.length - 1 && (
                      <div className="w-0.5 h-16 bg-gray-300 mt-2"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <EnhancedProjectCard
                      projectItem={projectItem}
                      layout="hero-timeline"
                      theme={portfolioPage.theme}
                      themeColors={{
                        primary: themeStyles.primaryColor,
                        secondary: themeStyles.secondaryColor,
                        accent: themeStyles.accentColor
                      }}
                    />
                  </div>
                </div>
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
  );
}
