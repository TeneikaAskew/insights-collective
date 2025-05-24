
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
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid lg:grid-cols-2 gap-8 min-h-screen">
          {/* Left Side - Profile */}
          <div className="bg-white rounded-lg shadow-lg p-8 h-fit sticky top-6">
            <div className="text-center mb-8">
              <Avatar className="w-32 h-32 mx-auto mb-6 border-4 border-white shadow-lg">
                <AvatarImage src={profileData.avatar_url} />
                <AvatarFallback className="text-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <h1 className="text-3xl font-bold mb-4">{portfolioPage.title}</h1>
              {portfolioPage.description && (
                <p className="text-lg text-muted-foreground mb-6">
                  {portfolioPage.description}
                </p>
              )}
              {profileData.professional_summary && (
                <p className="text-muted-foreground mb-6">
                  {profileData.professional_summary}
                </p>
              )}
            </div>

            {/* Contact Info */}
            <div className="space-y-4 mb-8">
              {profileData.location && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="h-5 w-5" />
                  {profileData.location}
                </div>
              )}
              {profileData.github_url && (
                <a href={profileData.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-muted-foreground hover:text-primary">
                  <Github className="h-5 w-5" />
                  GitHub
                </a>
              )}
              {profileData.linkedin_url && (
                <a href={profileData.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-muted-foreground hover:text-primary">
                  <Linkedin className="h-5 w-5" />
                  LinkedIn
                </a>
              )}
              {profileData.email && (
                <Button onClick={handleHireMe} className="w-full">
                  <Mail className="h-5 w-5 mr-2" />
                  Hire Me
                </Button>
              )}
            </div>

            {/* Skills */}
            {profileData.skills && profileData.skills.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Skills & Technologies</h3>
                <div className="flex flex-wrap gap-2">
                  {profileData.skills.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="px-3 py-1">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Experience */}
            {profileData.experience && profileData.experience.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Experience
                </h3>
                <div className="space-y-4">
                  {profileData.experience.map((exp) => (
                    <div key={exp.id} className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-semibold text-gray-800">{exp.role}</h4>
                      <p className="text-blue-600 font-medium">{exp.company}</p>
                      <p className="text-sm text-gray-500">
                        {formatDateRange(exp.startDate, exp.endDate)}
                      </p>
                      {exp.description && (
                        <p className="text-sm text-gray-600 mt-1">{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {profileData.education && profileData.education.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Education
                </h3>
                <div className="space-y-4">
                  {profileData.education.map((edu) => (
                    <div key={edu.id} className="border-l-4 border-purple-500 pl-4">
                      <h4 className="font-semibold text-gray-800">{edu.degree}</h4>
                      <p className="text-purple-600 font-medium">{edu.institution}</p>
                      <p className="text-sm text-gray-500">{edu.graduationYear}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Side - Projects */}
          <div className="space-y-8">
            <h2 className="text-2xl font-bold">Featured Projects</h2>
            {portfolioPage.projects && portfolioPage.projects.length > 0 ? (
              <div className="space-y-6">
                {portfolioPage.projects.map((projectItem) => (
                  <EnhancedProjectCard
                    key={projectItem.id}
                    projectItem={projectItem}
                    layout="split"
                    theme={portfolioPage.theme}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-xl text-muted-foreground">
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
