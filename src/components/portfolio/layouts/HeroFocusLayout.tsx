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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="w-20 h-20 border-4 border-white shadow-lg">
                  <AvatarImage src={profileData.avatar_url} />
                  <AvatarFallback className="text-xl bg-white text-purple-600">
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
                <Button onClick={handleHireMe} size="lg" className="bg-white text-purple-600 hover:bg-gray-100">
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
            <h2 className="text-2xl font-bold mb-6">Skills & Technologies</h2>
            <div className="flex flex-wrap gap-3">
              {profileData.skills.map((skill, index) => (
                <Badge key={index} variant="secondary" className="px-4 py-2 text-sm">
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
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Briefcase className="h-6 w-6" />
                Experience
              </h2>
              <div className="space-y-6">
                {profileData.experience.map((exp) => (
                  <div key={exp.id} className="border-b border-gray-200 last:border-b-0 pb-6 last:pb-0">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">{exp.role}</h3>
                        <p className="text-blue-600 font-medium">{exp.company}</p>
                      </div>
                      <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        {formatDateRange(exp.startDate, exp.endDate)}
                      </span>
                    </div>
                    {exp.description && (
                      <p className="text-gray-600 text-sm leading-relaxed">{exp.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {profileData.education && profileData.education.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <GraduationCap className="h-6 w-6" />
                Education
              </h2>
              <div className="space-y-6">
                {profileData.education.map((edu) => (
                  <div key={edu.id} className="border-b border-gray-200 last:border-b-0 pb-6 last:pb-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">{edu.degree}</h3>
                        <p className="text-purple-600 font-medium">{edu.institution}</p>
                      </div>
                      <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
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
            <h2 className="text-2xl font-bold mb-6">More Projects</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {portfolioPage.projects.slice(1).map((projectItem) => (
                <EnhancedProjectCard
                  key={projectItem.id}
                  projectItem={projectItem}
                  layout="hero-focus"
                  theme={portfolioPage.theme}
                />
              ))}
            </div>
          </div>
        )}

        {/* No projects message */}
        {(!portfolioPage.projects || portfolioPage.projects.length === 0) && (
          <div className="text-center py-16">
            <p className="text-xl text-muted-foreground">
              No projects to showcase yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
