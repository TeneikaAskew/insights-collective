
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

interface ClassicLayoutProps {
  portfolioPage: PortfolioPage;
}

export function ClassicLayout({ portfolioPage }: ClassicLayoutProps) {
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
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-12">
          <Avatar className="w-24 h-24 mx-auto mb-6 border-4 border-white shadow-lg">
            <AvatarImage src={profileData.avatar_url} />
            <AvatarFallback className="text-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-4xl font-bold mb-4">{portfolioPage.title}</h1>
          {portfolioPage.description && (
            <p className="text-xl text-muted-foreground mb-6 max-w-3xl mx-auto">
              {portfolioPage.description}
            </p>
          )}
          {profileData.professional_summary && (
            <p className="text-muted-foreground mb-8 max-w-4xl mx-auto">
              {profileData.professional_summary}
            </p>
          )}

          {/* Contact Info */}
          <div className="flex justify-center gap-6 mb-8">
            {profileData.location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {profileData.location}
              </div>
            )}
            {profileData.github_url && (
              <a href={profileData.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                <Github className="h-4 w-4" />
                GitHub
              </a>
            )}
            {profileData.linkedin_url && (
              <a href={profileData.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </a>
            )}
          </div>

          {profileData.email && (
            <Button onClick={handleHireMe} size="lg">
              <Mail className="h-4 w-4 mr-2" />
              Hire Me
            </Button>
          )}
        </div>

        {/* Skills */}
        {profileData.skills && profileData.skills.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-center">Skills & Technologies</h2>
            <div className="flex flex-wrap gap-3 justify-center">
              {profileData.skills.map((skill, index) => (
                <Badge key={index} variant="secondary" className="px-3 py-1">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Projects */}
        <div>
          <h2 className="text-2xl font-bold mb-8 text-center">Featured Projects</h2>
          {portfolioPage.projects && portfolioPage.projects.length > 0 ? (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {portfolioPage.projects.map((projectItem) => (
                <EnhancedProjectCard
                  key={projectItem.id}
                  projectItem={projectItem}
                  layout="classic"
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
