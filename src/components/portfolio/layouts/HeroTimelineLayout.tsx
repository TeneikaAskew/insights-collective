
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
  Calendar
} from 'lucide-react';
import { PortfolioPage, ProfileData } from '@/types/portfolio';
import { EnhancedProjectCard } from '../EnhancedProjectCard';

interface HeroTimelineLayoutProps {
  portfolioPage: PortfolioPage;
}

export function HeroTimelineLayout({ portfolioPage }: HeroTimelineLayoutProps) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20">
        <div className="max-w-4xl mx-auto text-center px-6">
          <Avatar className="w-32 h-32 mx-auto mb-6 border-4 border-white shadow-lg">
            <AvatarImage src={profileData.avatar_url} />
            <AvatarFallback className="text-2xl bg-white text-blue-600">
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
            {profileData.location && (
              <div className="flex items-center gap-2 text-white/90">
                <MapPin className="h-5 w-5" />
                {profileData.location}
              </div>
            )}
          </div>

          {profileData.email && (
            <Button onClick={handleHireMe} size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
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

        {/* Projects Timeline */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-8">Project Timeline</h2>
          {portfolioPage.projects && portfolioPage.projects.length > 0 ? (
            <div className="space-y-8">
              {portfolioPage.projects.map((projectItem, index) => (
                <div key={projectItem.id} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                    {index < portfolioPage.projects!.length - 1 && (
                      <div className="w-0.5 h-16 bg-gray-300 mt-2"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <EnhancedProjectCard
                      projectItem={projectItem}
                      layout="hero-timeline"
                      theme={portfolioPage.theme}
                    />
                  </div>
                </div>
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
  );
}
