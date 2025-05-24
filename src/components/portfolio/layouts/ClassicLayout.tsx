
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
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-12">
          <Avatar className="w-32 h-32 mx-auto mb-6 border-4 border-white shadow-lg">
            <AvatarImage src={profileData.avatar_url} />
            <AvatarFallback className="text-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white">
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
            <p className="text-lg text-muted-foreground mb-6 max-w-3xl mx-auto">
              {profileData.professional_summary}
            </p>
          )}
          
          {/* Contact Info */}
          <div className="flex flex-wrap gap-4 justify-center mb-6">
            {profileData.location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-5 w-5" />
                {profileData.location}
              </div>
            )}
            {profileData.github_url && (
              <a href={profileData.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                <Github className="h-5 w-5" />
                GitHub
              </a>
            )}
            {profileData.linkedin_url && (
              <a href={profileData.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                <Linkedin className="h-5 w-5" />
                LinkedIn
              </a>
            )}
            {profileData.email && (
              <Button onClick={handleHireMe} className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Hire Me
              </Button>
            )}
          </div>
        </div>

        {/* Skills */}
        {profileData.skills && profileData.skills.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-center">Skills & Technologies</h2>
            <div className="flex flex-wrap gap-3 justify-center">
              {profileData.skills.map((skill, index) => (
                <Badge key={index} variant="secondary" className="px-4 py-2 text-sm">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Experience */}
        {profileData.experience && profileData.experience.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-center">Experience</h2>
            <div className="space-y-6">
              {profileData.experience.map((exp) => (
                <Card key={exp.id} className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{exp.role}</h3>
                      <p className="text-muted-foreground mb-2">{exp.company}</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        {exp.startDate} - {exp.endDate}
                      </p>
                      <p className="text-gray-700">{exp.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {profileData.education && profileData.education.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-center">Education</h2>
            <div className="space-y-6">
              {profileData.education.map((edu) => (
                <Card key={edu.id} className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <GraduationCap className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{edu.degree}</h3>
                      <p className="text-muted-foreground mb-2">{edu.institution}</p>
                      <p className="text-sm text-muted-foreground">{edu.graduationYear}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Projects */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-center">Featured Projects</h2>
          {portfolioPage.projects && portfolioPage.projects.length > 0 ? (
            <div className="space-y-8">
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

        {/* CTA */}
        <div className="text-center bg-white rounded-lg p-8 shadow-sm">
          <h2 className="text-2xl font-bold mb-4">Let's Work Together</h2>
          <p className="text-muted-foreground mb-6">
            Interested in collaborating? I'd love to hear about your project.
          </p>
          {profileData.email && (
            <Button size="lg" onClick={handleHireMe}>
              <Mail className="h-5 w-5 mr-2" />
              Get In Touch
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
