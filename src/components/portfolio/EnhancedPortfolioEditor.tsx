import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Save, Share2, Download, ExternalLink, ArrowLeft } from 'lucide-react';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { PortfolioPage, ProfileData, PortfolioTheme } from '@/types/portfolio';
import { useToast } from '@/hooks/use-toast';
import { ProfileSection } from './ProfileSection';
import { EnhancedProjectCard } from './EnhancedProjectCard';
import { LayoutPreview } from './LayoutPreview';
import { PortfolioLayoutRenderer } from './PortfolioLayoutRenderer';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import { createLogger } from '@/utils/logger';

const logger = createLogger('EnhancedPortfolioEditor');

interface EnhancedPortfolioEditorProps {
  portfolioPage: PortfolioPage;
}

export function EnhancedPortfolioEditor({ portfolioPage }: EnhancedPortfolioEditorProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { updatePortfolioPage, exportPortfolioAsCSV, getShareableLink } = usePortfolioPages();
  
  // State for form data
  const [title, setTitle] = useState(portfolioPage.title);
  const [description, setDescription] = useState(portfolioPage.description || '');
  const [isPublic, setIsPublic] = useState(portfolioPage.is_public || false);
  const [customUrl, setCustomUrl] = useState(portfolioPage.custom_url || '');
  const [theme, setTheme] = useState<PortfolioTheme>(portfolioPage.theme as PortfolioTheme || 'default');
  const [layout, setLayout] = useState(portfolioPage.layout || 'classic');
  // font_family is not a real column on portfolio_pages — it is persisted
  // inside the profile_data JSON blob instead (see handleSave).
  const [fontFamily, setFontFamily] = useState(
    (portfolioPage.profile_data as any)?.font_family || portfolioPage.font_family || 'Inter'
  );
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
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // State to track the "saved" baseline for comparison
  const [savedBaseline, setSavedBaseline] = useState({
    title: portfolioPage.title,
    description: portfolioPage.description || '',
    isPublic: portfolioPage.is_public || false,
    customUrl: portfolioPage.custom_url || '',
    theme: portfolioPage.theme || 'default',
    layout: portfolioPage.layout || 'classic',
    fontFamily: (portfolioPage.profile_data as any)?.font_family || portfolioPage.font_family || 'Inter',
    profileData: portfolioPage.profile_data || {}
  });

  // Available font families
  const fontFamilies = [
    { value: 'Inter', label: 'Inter (Sans-serif)', family: "'Inter', sans-serif" },
    { value: 'Playfair Display', label: 'Playfair Display (Serif)', family: "'Playfair Display', serif" },
    { value: 'Poppins', label: 'Poppins (Sans-serif)', family: "'Poppins', sans-serif" },
    { value: 'Georgia', label: 'Georgia (Serif)', family: "'Georgia', serif" },
    { value: 'Roboto', label: 'Roboto (Sans-serif)', family: "'Roboto', sans-serif" },
    { value: 'Open Sans', label: 'Open Sans (Sans-serif)', family: "'Open Sans', sans-serif" },
    { value: 'Lato', label: 'Lato (Sans-serif)', family: "'Lato', sans-serif" },
    { value: 'Montserrat', label: 'Montserrat (Sans-serif)', family: "'Montserrat', sans-serif" },
    { value: 'Source Sans Pro', label: 'Source Sans Pro (Sans-serif)', family: "'Source Sans Pro', sans-serif" },
    { value: 'Merriweather', label: 'Merriweather (Serif)', family: "'Merriweather', serif" },
    { value: 'Nunito', label: 'Nunito (Sans-serif)', family: "'Nunito', sans-serif" },
    { value: 'Raleway', label: 'Raleway (Sans-serif)', family: "'Raleway', sans-serif" },
  ];

  // Function to fetch skills from user's recommendations
  const fetchDiscoveredSkills = async (): Promise<string[]> => {
    if (!user?.id) return [];
    
    try {
      logger.log('Fetching skills from user recommendations for user:', user.id);
      
      // First check the portfolio table for recommendations
      const { data: portfolioData, error: portfolioError } = await supabase
        .from('portfolio')
        .select('recommendations')
        .eq('user_id', user.id)
        .maybeSingle();

      logger.log('Portfolio recommendations data:', portfolioData);

      const recommendations = portfolioData?.recommendations as Record<string, any> | undefined;
      if (recommendations && recommendations.skills) {
        logger.log('Found skills in portfolio recommendations:', recommendations.skills);
        return recommendations.skills;
      }

      // Fallback to career_pathway_results table
      const { data, error } = await supabase
        .from('career_pathway_results')
        .select('report')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      logger.log('Career pathway results data:', data);

      // `error || !data?.report` collapsed two different situations into one
      // empty list: a query that failed, and a user who genuinely has no career
      // report yet. The caller shows "no suggestions" either way, so a broken
      // read looked like an empty profile. Separate them so the log says which.
      if (error) {
        logger.error('Career pathway results could not be read; skill suggestions unavailable', error);
        return [];
      }

      if (!data?.report) {
        logger.log('No career pathway results found');
        return [];
      }

      const report = data.report as any;
      
      // Look for skills in the main skills array
      if (report.skills && Array.isArray(report.skills)) {
        logger.log('Found skills in career pathway report:', report.skills);
        return report.skills.filter((skill: any): skill is string => 
          typeof skill === 'string' && skill.trim().length > 0
        );
      }
      
      logger.log('No skills found in recommendations');
      return [];
    } catch (error) {
      logger.error('Error fetching discovered skills:', error);
      return [];
    }
  };

  // Prefill skills from recommendations on component mount
  useEffect(() => {
    const prefillSkills = async () => {
      if (!portfolioPage.profile_data?.skills || portfolioPage.profile_data.skills.length === 0) {
        logger.log('Prefilling skills from recommendations...');
        const discoveredSkills = await fetchDiscoveredSkills();
        if (discoveredSkills.length > 0) {
          logger.log('Prefilling skills:', discoveredSkills);
          setProfileData(prev => ({
            ...prev,
            skills: discoveredSkills
          }));
          setHasUnsavedChanges(true);
        }
      }
    };

    prefillSkills();
  }, [user?.id, portfolioPage.profile_data?.skills]);

  // Track changes by comparing current state with saved baseline
  useEffect(() => {
    const currentData = {
      title,
      description,
      isPublic,
      customUrl,
      theme,
      layout,
      fontFamily,
      profileData
    };

    const hasChanges = JSON.stringify(savedBaseline) !== JSON.stringify(currentData);
    setHasUnsavedChanges(hasChanges);
  }, [savedBaseline, title, description, isPublic, customUrl, theme, layout, fontFamily, profileData]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updatePortfolioPage.mutateAsync({
        id: portfolioPage.id,
        title,
        description,
        is_public: isPublic,
        custom_url: customUrl,
        theme,
        layout,
        // portfolio_pages has NO font_family column — sending it made
        // PostgREST reject the whole update (PGRST204), silently blocking
        // every editor save. The font is stored inside profile_data instead.
        profile_data: { ...(profileData as any), font_family: fontFamily },
      });
      
      // Update the saved baseline to match current state
      const newBaseline = {
        title,
        description,
        isPublic,
        customUrl,
        theme,
        layout,
        fontFamily,
        profileData
      };
      setSavedBaseline(newBaseline);
      
      toast({
        title: "Success",
        description: "Portfolio saved successfully!",
      });
    } catch (error) {
      logger.error('Error saving portfolio:', error);
      toast({
        title: "Error",
        description: "Failed to save portfolio changes",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
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
      logger.error('Error exporting portfolio:', error);
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
    { value: 'professional', label: 'Professional', color: 'bg-blue-600' },
    { value: 'creative', label: 'Creative', color: 'bg-purple-500' },
    { value: 'modern', label: 'Modern', color: 'bg-green-500' },
    { value: 'elegant', label: 'Elegant', color: 'bg-rose-500' },
  ];

  const layouts = ['sidebar', 'hero-timeline', 'grid', 'classic', 'split', 'hero-focus'];

  // Create updated portfolio page for preview
  const updatedPortfolioPage: PortfolioPage = {
    ...portfolioPage,
    title,
    description,
    theme,
    layout,
    font_family: fontFamily,
    profile_data: profileData,
    is_public: isPublic,
    custom_url: customUrl
  };

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
        {/* flex-wrap, not flex: four buttons is about 470px of row, so at 390
            the Share button hung off the right edge and took the whole page
            into horizontal scroll with it. */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
            className="bg-primary hover:bg-primary/90"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
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

      {hasUnsavedChanges && (
        <div className="bg-ss-warn-chip border border-ss-warn rounded-lg p-4">
          <p className="text-ss-warn text-sm">
            You have unsaved changes. Don't forget to save your work!
          </p>
        </div>
      )}

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="preview">Live Preview</TabsTrigger>
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
                {layouts.map((layoutOption) => (
                  <LayoutPreview
                    key={layoutOption}
                    layout={layoutOption}
                    isSelected={layout === layoutOption}
                    onSelect={() => setLayout(layoutOption)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Typography</CardTitle>
              <CardDescription>Choose a font family for your portfolio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="font-family">Font Family</Label>
                  <Select value={fontFamily} onValueChange={setFontFamily}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a font family" />
                    </SelectTrigger>
                    <SelectContent>
                      {fontFamilies.map((font) => (
                        <SelectItem key={font.value} value={font.value}>
                          <span style={{ fontFamily: font.family }}>{font.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-4 border rounded-lg">
                  <p 
                    className="text-lg font-medium mb-2"
                    style={{ fontFamily: fontFamilies.find(f => f.value === fontFamily)?.family || 'Inter' }}
                  >
                    Sample Text Preview
                  </p>
                  <p 
                    className="text-sm text-muted-foreground"
                    style={{ fontFamily: fontFamilies.find(f => f.value === fontFamily)?.family || 'Inter' }}
                  >
                    This is how your portfolio text will look with the selected font family.
                  </p>
                </div>
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
                        : 'border-border hover:border-ss-lav'
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

        <TabsContent value="projects" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Projects</CardTitle>
              <CardDescription>Projects from your portfolio</CardDescription>
            </CardHeader>
            <CardContent>
              {(!portfolioPage.projects || !Array.isArray(portfolioPage.projects) || portfolioPage.projects.length === 0) ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    You haven't added any projects yet. Head to your Kanban board and mark projects as 'Completed' to add them here.
                  </p>
                  {/* Was /project-tracker, which is not a route — the button
                      told users where to go and then 404'd them. The tracker is
                      a tab on the portfolio explorer, and that tab is
                      URL-addressable (PortfolioExplorer reads ?tab=). */}
                  <Button asChild>
                    <a href="/portfolio-explorer?tab=tracker">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Go to Project Tracker
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {portfolioPage.projects.map((projectItem) => (
                    <EnhancedProjectCard
                      key={projectItem.id}
                      projectItem={projectItem}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>
                This is how your portfolio will look with the current layout and theme
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border rounded-lg overflow-hidden">
                <PortfolioLayoutRenderer portfolioPage={updatedPortfolioPage} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
