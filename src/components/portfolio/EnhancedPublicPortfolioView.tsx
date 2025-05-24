
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  Mail, 
  MapPin, 
  Github, 
  Linkedin, 
  ExternalLink, 
  Share2, 
  Download,
  Moon,
  Sun,
  Eye,
  Calendar,
  GraduationCap,
  Briefcase
} from 'lucide-react';
import { PortfolioPage, ProfileData } from '@/types/portfolio';
import { EnhancedProjectCard } from './EnhancedProjectCard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface EnhancedPublicPortfolioViewProps {
  portfolioPage: PortfolioPage;
}

export function EnhancedPublicPortfolioView({ portfolioPage }: EnhancedPublicPortfolioViewProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  
  const profileData: ProfileData = portfolioPage.profile_data || {};

  useEffect(() => {
    // Track page view
    trackPageView();
    
    // Load view count
    loadViewCount();
  }, []);

  const trackPageView = async () => {
    try {
      // Insert view record
      await supabase
        .from('portfolio_page_views')
        .insert({
          portfolio_page_id: portfolioPage.id,
          viewed_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error tracking page view:', error);
    }
  };

  const loadViewCount = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count } = await supabase
        .from('portfolio_page_views')
        .select('*', { count: 'exact', head: true })
        .eq('portfolio_page_id', portfolioPage.id)
        .gte('viewed_at', thirtyDaysAgo.toISOString());

      setViewCount(count || 0);
    } catch (error) {
      console.error('Error loading view count:', error);
    }
  };

  const handleShare = () => {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Success",
      description: "Portfolio link copied to clipboard!",
    });
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent("Check out my portfolio");
    const body = encodeURIComponent(`Here's my portfolio: ${window.location.href}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const generateEmbedCode = () => {
    const embedCode = `<iframe src="${window.location.href}" style="width:100%;height:600px;border:none;"></iframe>`;
    navigator.clipboard.writeText(embedCode);
    toast({
      title: "Success",
      description: "Embed code copied to clipboard!",
    });
  };

  const getInitials = () => {
    if (profileData.professional_summary) {
      const words = profileData.professional_summary.split(' ');
      if (words.length >= 2) {
        return `${words[0][0]}${words[1][0]}`.toUpperCase();
      }
    }
    return 'DS';
  };

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      {/* Sticky Navigation */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Eye className="h-4 w-4" />
            {viewCount} views (30 days)
          </div>
          
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setIsDarkMode(!isDarkMode)}>
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {profileData.email && (
              <Button size="sm" variant="ghost" onClick={handleEmailShare}>
                <Mail className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={generateEmbedCode}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-6xl mx-auto p-6">
          {/* Profile Header */}
          <div className="text-center mb-12">
            <Avatar className="w-32 h-32 mx-auto mb-6 border-4 border-white shadow-lg">
              <AvatarImage src={profileData.avatar_url} />
              <AvatarFallback className="text-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <h1 className="text-4xl font-bold mb-4">{portfolioPage.title}</h1>
            {profileData.professional_summary && (
              <p className="text-xl text-muted-foreground mb-6 max-w-3xl mx-auto">
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
              {profileData.email && (
                <a href={`mailto:${profileData.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                  <Mail className="h-5 w-5" />
                  {profileData.email}
                </a>
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
            </div>
            
            <div className="flex gap-4 justify-center">
              {profileData.email && (
                <Button size="lg" onClick={handleEmailShare}>
                  <Mail className="h-5 w-5 mr-2" />
                  Contact Me
                </Button>
              )}
              <Button size="lg" variant="outline">
                Hire Me
              </Button>
            </div>
          </div>

          {/* Skills Section */}
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

          {/* Experience Section */}
          {profileData.experience && profileData.experience.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold mb-6 text-center">Experience</h2>
              <div className="space-y-6 max-w-4xl mx-auto">
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

          {/* Education Section */}
          {profileData.education && profileData.education.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold mb-6 text-center">Education</h2>
              <div className="space-y-6 max-w-4xl mx-auto">
                {profileData.education.map((edu) => (
                  <Card key={edu.id} className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <GraduationCap className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">{edu.degree}</h3>
                        <p className="text-muted-foreground mb-2">{edu.institution}</p>
                        <p className="text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 inline mr-1" />
                          {edu.graduationYear}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Projects Section */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-center">Featured Projects</h2>
            <p className="text-muted-foreground text-center mb-8">
              A showcase of my work and the technologies I've mastered
            </p>
            {portfolioPage.projects && portfolioPage.projects.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {portfolioPage.projects.map((projectItem) => (
                  <EnhancedProjectCard
                    key={projectItem.id}
                    projectItem={projectItem}
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

          {/* CTA Section */}
          <div className="text-center bg-white rounded-lg p-8 shadow-sm">
            <h2 className="text-2xl font-bold mb-4">Let's Work Together</h2>
            <p className="text-muted-foreground mb-6">
              Interested in collaborating? I'd love to hear about your project.
            </p>
            {profileData.email ? (
              <Button size="lg" onClick={handleEmailShare}>
                <Mail className="h-5 w-5 mr-2" />
                Get In Touch
              </Button>
            ) : (
              <Button size="lg" onClick={handleShare}>
                <Share2 className="h-5 w-5 mr-2" />
                Share Portfolio
              </Button>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 py-6 border-t bg-white">
          <div className="max-w-6xl mx-auto px-6 text-center text-sm text-muted-foreground">
            <p>© 2024 {portfolioPage.title}. Built with AI Portfolio Explorer.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
