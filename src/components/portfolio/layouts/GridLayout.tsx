
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  Mail, 
  MapPin, 
  Github, 
  Linkedin
} from 'lucide-react';
import { PortfolioPage, ProfileData } from '@/types/portfolio';
import { EnhancedProjectCard } from '../EnhancedProjectCard';

interface GridLayoutProps {
  portfolioPage: PortfolioPage;
}

export function GridLayout({ portfolioPage }: GridLayoutProps) {
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
      <div className="max-w-7xl mx-auto p-6">
        {/* Compact Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center gap-6">
            <Avatar className="w-20 h-20 border-4 border-white shadow-lg">
              <AvatarImage src={profileData.avatar_url} />
              <AvatarFallback className="text-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{portfolioPage.title}</h1>
              {portfolioPage.description && (
                <p className="text-muted-foreground mb-3">
                  {portfolioPage.description}
                </p>
              )}
              <div className="flex flex-wrap gap-4">
                {profileData.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {profileData.location}
                  </div>
                )}
                {profileData.github_url && (
                  <a href={profileData.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                    <Github className="h-4 w-4" />
                    GitHub
                  </a>
                )}
                {profileData.linkedin_url && (
                  <a href={profileData.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                    <Linkedin className="h-4 w-4" />
                    LinkedIn
                  </a>
                )}
                {profileData.email && (
                  <Button onClick={handleHireMe} size="sm">
                    <Mail className="h-4 w-4 mr-2" />
                    Hire Me
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Skills */}
        {profileData.skills && profileData.skills.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {profileData.skills.map((skill, index) => (
                <Badge key={index} variant="secondary" className="px-3 py-1">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Projects Grid */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Projects</h2>
          {portfolioPage.projects && portfolioPage.projects.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {portfolioPage.projects.map((projectItem) => (
                <EnhancedProjectCard
                  key={projectItem.id}
                  projectItem={projectItem}
                  layout="grid"
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
  );
}
