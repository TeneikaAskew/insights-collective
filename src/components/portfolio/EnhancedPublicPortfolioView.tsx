
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
  Eye
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
    return 'DS'; // Default to Data Scientist
  };

  const renderSidebarLayout = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="flex flex-col lg:flex-row max-w-7xl mx-auto">
        {/* Sidebar Profile */}
        <div className="lg:w-1/3 p-6 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
          <Card className="p-6 space-y-6">
            <div className="text-center">
              <Avatar className="w-24 h-24 mx-auto mb-4">
                <AvatarImage src={profileData.avatar_url} />
                <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
              </Avatar>
              <h1 className="text-2xl font-bold">{portfolioPage.title}</h1>
              {profileData.location && (
                <p className="text-muted-foreground flex items-center justify-center gap-1 mt-2">
                  <MapPin className="h-4 w-4" />
                  {profileData.location}
                </p>
              )}
            </div>

            {profileData.professional_summary && (
              <div>
                <h3 className="font-semibold mb-2">About</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {profileData.professional_summary}
                </p>
              </div>
            )}

            {profileData.skills && profileData.skills.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {profileData.skills.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {profileData.experience && profileData.experience.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Experience</h3>
                <div className="space-y-3">
                  {profileData.experience.slice(0, 2).map((exp) => (
                    <div key={exp.id} className="text-sm">
                      <p className="font-medium">{exp.role}</p>
                      <p className="text-muted-foreground">{exp.company}</p>
                      <p className="text-xs text-muted-foreground">
                        {exp.startDate} - {exp.endDate || 'Present'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" onClick={handleEmailShare}>
                <Mail className="h-4 w-4 mr-1" />
                Contact
              </Button>
              <Button size="sm" variant="outline">
                Hire Me
              </Button>
            </div>
          </Card>
        </div>

        {/* Projects Grid */}
        <div className="lg:w-2/3 p-6">
          <div className="grid gap-6 md:grid-cols-2">
            {portfolioPage.projects?.map((projectItem) => (
              <EnhancedProjectCard
                key={projectItem.id}
                projectItem={projectItem}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderHeroTimelineLayout = () => (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-[#9b87f5] to-purple-600 text-white py-20">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-4xl mx-auto text-center px-6">
          <Avatar className="w-32 h-32 mx-auto mb-6 border-4 border-white/20">
            <AvatarImage src={profileData.avatar_url} />
            <AvatarFallback className="text-2xl bg-white/10">{getInitials()}</AvatarFallback>
          </Avatar>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{portfolioPage.title}</h1>
          {profileData.professional_summary && (
            <p className="text-xl mb-6 opacity-90 max-w-2xl mx-auto">
              {profileData.professional_summary}
            </p>
          )}
          {profileData.location && (
            <p className="flex items-center justify-center gap-2 mb-6">
              <MapPin className="h-5 w-5" />
              {profileData.location}
            </p>
          )}
          <div className="flex gap-4 justify-center">
            <Button size="lg" variant="secondary" onClick={handleEmailShare}>
              <Mail className="h-5 w-5 mr-2" />
              Contact Me
            </Button>
            <Button size="lg" variant="outline" className="text-white border-white hover:bg-white/10">
              Hire Me
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Skills Section */}
        {profileData.skills && profileData.skills.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Skills & Technologies</h2>
            <div className="flex flex-wrap gap-3">
              {profileData.skills.map((skill, index) => (
                <Badge key={index} variant="secondary" className="px-3 py-1">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Projects Timeline */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Projects</h2>
          <div className="space-y-8">
            {portfolioPage.projects?.map((projectItem, index) => (
              <div key={projectItem.id} className="flex gap-6">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 bg-[#9b87f5] rounded-full"></div>
                  {index < portfolioPage.projects!.length - 1 && (
                    <div className="w-px h-24 bg-gray-300 mt-2"></div>
                  )}
                </div>
                <div className="flex-1">
                  <EnhancedProjectCard
                    projectItem={projectItem}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderLayout = () => {
    switch (portfolioPage.theme) {
      case 'hero-timeline':
        return renderHeroTimelineLayout();
      case 'sidebar':
      default:
        return renderSidebarLayout();
    }
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
            <Button size="sm" variant="ghost" onClick={handleEmailShare}>
              <Mail className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={generateEmbedCode}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {renderLayout()}
    </div>
  );
}
