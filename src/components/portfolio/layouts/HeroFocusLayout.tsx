
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
  Star,
  Briefcase,
  GraduationCap
} from 'lucide-react';
import { PortfolioPage, ProfileData } from '@/types/portfolio';
import { EnhancedProjectCard } from '../EnhancedProjectCard';

interface HeroFocusLayoutProps {
  portfolioPage: PortfolioPage;
}

export function HeroFocusLayout({ portfolioPage }: HeroFocusLayoutProps) {
  const profileData: ProfileData = portfolioPage.profile_data || {};
  const featuredProject = portfolioPage.projects?.[0]; // First project as featured

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
          heroGradient: "linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)",
          cardBg: "#f9fafb"
        };
      case 'professional':
        return {
          backgroundColor: "#f8f9fa",
          fontFamily: `'${portfolioPage.font_family || 'Georgia'}', serif`,
          color: "#2c3e50",
          accentColor: "#3b82f6",
          primaryColor: "#3b82f6",
          secondaryColor: "#1e40af",
          heroGradient: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
          cardBg: "#ffffff"
        };
      case 'creative':
        return {
          backgroundColor: "#fff8f3",
          fontFamily: `'${portfolioPage.font_family || 'Poppins'}', sans-serif`,
          color: "#333333",
          accentColor: "#a855f7",
          primaryColor: "#a855f7",
          secondaryColor: "#7c3aed",
          heroGradient: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
          cardBg: "#fef7ff"
        };
      case 'modern':
        return {
          backgroundColor: "#f0fdf4",
          fontFamily: `'${portfolioPage.font_family || 'Inter'}', sans-serif`,
          color: "#065f46",
          accentColor: "#10b981",
          primaryColor: "#10b981",
          secondaryColor: "#059669",
          heroGradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
          cardBg: "#ffffff"
        };
      case 'elegant':
        return {
          backgroundColor: "#fef2f2",
          fontFamily: `'${portfolioPage.font_family || 'Playfair Display'}', serif`,
          color: "#7f1d1d",
          accentColor: "#dc2626",
          primaryColor: "#dc2626",
          secondaryColor: "#b91c1c",
          heroGradient: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
          cardBg: "#ffffff"
        };
      default:
        return {
          backgroundColor: "#ffffff",
          fontFamily: `'${portfolioPage.font_family || 'system-ui'}', sans-serif`,
          color: "#111827",
          accentColor: "#3b82f6",
          primaryColor: "#3b82f6",
          secondaryColor: "#a855f7",
          heroGradient: "linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)",
          cardBg: "#f9fafb"
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
        className="text-white py-24"
        style={{ background: themeStyles.heroGradient }}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="w-20 h-20 border-4 border-white shadow-lg">
                  <AvatarImage src={profileData.avatar_url} />
                  <AvatarFallback 
                    className="text-xl text-white"
                    style={{ backgroundColor: themeStyles.primaryColor }}
                  >
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-4xl font-bold">{portfolioPage.title}</h1>
                  {profileData.location && (
                    <div className="flex items-center gap-2 text-white/80 mt-2">
                      <MapPin className="h-4 w-4" />
                      {profileData.location}
                    </div>
                  )}
                </div>
              </div>
              
              {portfolioPage.description && (
                <p className="text-xl mb-6 opacity-90">
                  {portfolioPage.description}
                </p>
              )}
              
              {profileData.professional_summary && (
                <p className="text-lg mb-8 opacity-80">
                  {profileData.professional_summary}
                </p>
              )}

              <div className="flex gap-4 mb-8">
                {profileData.github_url && (
                  <a href={profileData.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/90 hover:text-white">
                    <Github className="h-5 w-5" />
                    GitHub
                  </a>
                )}
                {profileData.linkedin_url && (
                  <a href={profileData.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/90 hover:text-white">
                    <Linkedin className="h-5 w-5" />
                    LinkedIn
                  </a>
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

            {/* Featured Project */}
            {featuredProject && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="h-5 w-5 text-yellow-400" />
                  <h3 className="text-lg font-semibold">Featured Project</h3>
                </div>
                <EnhancedProjectCard
                  projectItem={featuredProject}
                  layout="hero-focus"
                  theme={portfolioPage.theme}
                  themeColors={{
                    primary: themeStyles.primaryColor,
                    secondary: themeStyles.secondaryColor,
                    accent: themeStyles.accentColor
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Skills */}
        {profileData.skills && profileData.skills.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6" style={{ color: themeStyles.color }}>Skills & Technologies</h2>
            <div className="flex flex-wrap gap-3">
              {profileData.skills.map((skill, index) => (
                <Badge 
                  key={index} 
                  variant="secondary" 
                  className="px-4 py-2 text-sm text-white border-0"
                  style={{ backgroundColor: themeStyles.primaryColor }}
                >
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Experience and Education Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Experience */}
          {profileData.experience && profileData.experience.length > 0 && (
            <div 
              className="rounded-lg shadow-md p-6"
              style={{ backgroundColor: themeStyles.cardBg }}
            >
              <h2 
                className="text-2xl font-bold mb-6 flex items-center gap-2"
                style={{ color: themeStyles.color }}
              >
                <Briefcase className="h-6 w-6" />
                Experience
              </h2>
              <div className="space-y-6">
                {profileData.experience.map((exp) => (
                  <div key={exp.id} className="border-b border-gray-200 last:border-b-0 pb-6 last:pb-0">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-lg font-semibold" style={{ color: themeStyles.color }}>{exp.role}</h3>
                        <p className="font-medium" style={{ color: themeStyles.primaryColor }}>{exp.company}</p>
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
                      <p className="text-sm leading-relaxed" style={{ color: themeStyles.accentColor }}>{exp.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {profileData.education && profileData.education.length > 0 && (
            <div 
              className="rounded-lg shadow-md p-6"
              style={{ backgroundColor: themeStyles.cardBg }}
            >
              <h2 
                className="text-2xl font-bold mb-6 flex items-center gap-2"
                style={{ color: themeStyles.color }}
              >
                <GraduationCap className="h-6 w-6" />
                Education
              </h2>
              <div className="space-y-6">
                {profileData.education.map((edu) => (
                  <div key={edu.id} className="border-b border-gray-200 last:border-b-0 pb-6 last:pb-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold" style={{ color: themeStyles.color }}>{edu.degree}</h3>
                        <p className="font-medium" style={{ color: themeStyles.secondaryColor }}>{edu.institution}</p>
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
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Other Projects */}
        {portfolioPage.projects && portfolioPage.projects.length > 1 && (
          <div>
            <h2 className="text-2xl font-bold mb-6" style={{ color: themeStyles.color }}>More Projects</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {portfolioPage.projects.slice(1).map((projectItem) => (
                <EnhancedProjectCard
                  key={projectItem.id}
                  projectItem={projectItem}
                  layout="hero-focus"
                  theme={portfolioPage.theme}
                  themeColors={{
                    primary: themeStyles.primaryColor,
                    secondary: themeStyles.secondaryColor,
                    accent: themeStyles.accentColor
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* No projects message */}
        {(!portfolioPage.projects || portfolioPage.projects.length === 0) && (
          <div className="text-center py-16">
            <p className="text-xl" style={{ color: themeStyles.accentColor }}>
              No projects to showcase yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
