import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Eye, Save, Share2, Download, ExternalLink, ArrowLeft } from 'lucide-react';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { PortfolioPage, ProfileData, PortfolioTheme } from '@/types/portfolio';
import { toast } from '@/hooks/use-toast';
import { ProfileSection } from './ProfileSection';
import { EnhancedProjectCard } from './EnhancedProjectCard';
import { LayoutPreview } from './LayoutPreview';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface EnhancedPortfolioEditorProps {
  portfolioPage: PortfolioPage;
}

export function EnhancedPortfolioEditor({ portfolioPage }: EnhancedPortfolioEditorProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updatePortfolioPage, exportPortfolioAsCSV, getShareableLink } = usePortfolioPages();
  
  const [title, setTitle] = useState(portfolioPage.title);
  const [description, setDescription] = useState(portfolioPage.description || '');
  const [isPublic, setIsPublic] = useState(portfolioPage.is_public || false);
  const [customUrl, setCustomUrl] = useState(portfolioPage.custom_url || '');
  const [theme, setTheme] = useState<PortfolioTheme>(portfolioPage.theme as PortfolioTheme || 'default');
  const [profileData, setProfileData] = useState<ProfileData>(portfolioPage.profile_data || {
    avatar_url: '',
    professional_summary: '',
    skills: [],
    location: '',
    email: '',
    github_url: '',
    linkedin_url: '',
    experience: [],
    education: []
  });

  // Function to fetch skills from career pathway results
  const fetchDiscoveredSkills = async (): Promise<string[]> => {
    if (!user?.id) return [];
    
    try {
      // First check the portfolio table for recommendations
      const { data: portfolioData, error: portfolioError } = await supabase
        .from('portfolio')
        .select('recommendations')
        .eq('user_id', user.id)
        .maybeSingle();

      if (portfolioData?.recommendations && portfolioData.recommendations.skills) {
        console.log('Found skills in portfolio recommendations:', portfolioData.recommendations.skills);
        return portfolioData.recommendations.skills;
      }

      // Fallback to career_pathway_results table
      const { data, error } = await supabase
        .from('career_pathway_results')
        .select('report')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data?.report) {
        console.log('No career pathway results found');
        return [];
      }

      const report = data.report as any;
      console.log('Full career pathway report:', report);
      
      // Look for skills in the main skills array first (this is where Portfolio Explorer gets them)
      if (report.skills && Array.isArray(report.skills)) {
        console.log('Found skills in report.skills:', report.skills);
        return report.skills.filter((skill: any): skill is string => 
          typeof skill === 'string' && skill.trim().length > 0
        );
      }
      
      // If no skills found, check if there's a skillGaps object with user skills
      if (report.skillGaps) {
        if (report.skillGaps.userSkills && Array.isArray(report.skillGaps.userSkills)) {
          console.log('Found skills in skillGaps.userSkills:', report.skillGaps.userSkills);
          return report.skillGaps.userSkills.filter((skill: any): skill is string => 
            typeof skill === 'string' && skill.trim().length > 0
          );
        }
      }
      
      console.log('No skills found in any expected location');
      return [];
    } catch (error) {
      console.error('Error fetching discovered skills:', error);
      return [];
    }
  };

  // Prefill skills on component mount if no skills are currently set
  useEffect(() => {
    const prefillSkills = async () => {
      if (!profileData.skills || profileData.skills.length === 0) {
        const discoveredSkills = await fetchDiscoveredSkills();
        if (discoveredSkills.length > 0) {
          console.log('Setting discovered skills:', discoveredSkills);
          setProfileData(prev => ({
            ...prev,
            skills: discoveredSkills
          }));
        }
      }
    };

    prefillSkills();
  }, [user?.id, profileData.skills]);

  // Auto-save profile data when it changes
  useEffect(() => {
    const saveTimer = setTimeout(() => {
      handleSave();
    }, 1000);

    return () => clearTimeout(saveTimer);
  }, [profileData, title, description, isPublic, customUrl, theme]);

  const handleSave = async () => {
    try {
      await updatePortfolioPage.mutateAsync({
        id: portfolioPage.id,
        title,
        description,
        is_public: isPublic,
        custom_url: customUrl,
        theme,
        profile_data: profileData,
      });
    } catch (error) {
      console.error('Error saving portfolio:', error);
      toast({
        title: "Error",
        description: "Failed to save portfolio changes",
        variant: "destructive"
      });
    }
  };

  const handleExport = async () => {
    try {
      await exportPortfolioAsCSV(portfolioPage.id);
      toast({
        title: "Success",
        description: "Portfolio exported successfully!",
      });
    } catch (error) {
      console.error('Error exporting portfolio:', error);
      toast({
        title: "Error",
        description: "Failed to export portfolio",
        variant: "destructive"
      });
    }
  };

  const handleShare = () => {
    const shareUrl = getShareableLink(customUrl || portfolioPage.id);
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Success",
      description: "Portfolio link copied to clipboard!",
    });
  };

  const handlePreview = () => {
    const previewUrl = customUrl 
      ? `/portfolio/${customUrl}` 
      : `/portfolio/${portfolioPage.id}`;
    window.open(previewUrl, '_blank');
  };

  const handleBack = () => {
    navigate('/portfolio-explorer');
  };

  const themes: { value: PortfolioTheme; label: string; color: string }[] = [
    { value: 'default', label: 'Default', color: 'bg-blue-500' },
    { value: 'minimal', label: 'Minimal', color: 'bg-gray-500' },
    { value: 'professional', label: 'Professional', color: 'bg-navy-600' },
    { value: 'creative', label: 'Creative', color: 'bg-purple-500' },
    { value: 'modern', label: 'Modern', color: 'bg-green-500' },
    { value: 'elegant', label: 'Elegant', color: 'bg-rose-500' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleBack} className="p-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Portfolio Editor</h1>
            <p className="text-muted-foreground">Customize your portfolio content</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePreview}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <ProfileSection 
            profileData={profileData}
            onUpdate={setProfileData}
          />
        </TabsContent>

        <TabsContent value="layout" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Choose Your Layout</CardTitle>
              <CardDescription>Select a layout that best showcases your work</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {['sidebar', 'hero-timeline', 'grid', 'classic', 'split', 'hero-focus'].map((layout) => (
                  <LayoutPreview
                    key={layout}
                    layout={layout}
                    isSelected={false}
                    onSelect={() => {}}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Color Theme</CardTitle>
              <CardDescription>Choose a color scheme for your portfolio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {themes.map((themeOption) => (
                  <div
                    key={themeOption.value}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
                      theme === themeOption.value
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setTheme(themeOption.value)}
                  >
                    <div className={`w-full h-12 rounded-md mb-3 ${themeOption.color}`}></div>
                    <h3 className="font-medium text-center">{themeOption.label}</h3>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Projects</CardTitle>
              <CardDescription>Projects from your portfolio</CardDescription>
            </CardHeader>
            <CardContent>
              {portfolioPage.projects && portfolioPage.projects.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {portfolioPage.projects.map((projectItem) => (
                    <EnhancedProjectCard
                      key={projectItem.id}
                      projectItem={projectItem}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    You haven't added any projects yet. Head to your Kanban board and mark projects as 'Completed' to add them here.
                  </p>
                  <Button asChild>
                    <a href="/project-tracker">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Go to Project Tracker
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Portfolio Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Data Science Portfolio"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A brief description of your portfolio..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="custom-url">Custom URL</Label>
                <Input
                  id="custom-url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="my-portfolio"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your portfolio will be available at: /portfolio/{customUrl || 'your-id'}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="public"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
                <Label htmlFor="public">Make portfolio public</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
