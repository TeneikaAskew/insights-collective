
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Eye, Save, Share2, Download, ExternalLink } from 'lucide-react';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { PortfolioPage, ProfileData } from '@/types/portfolio';
import { toast } from '@/hooks/use-toast';
import { LayoutPreview } from './LayoutPreview';
import { ProfileSection } from './ProfileSection';
import { EnhancedProjectCard } from './EnhancedProjectCard';

interface EnhancedPortfolioEditorProps {
  portfolioPage: PortfolioPage;
}

const LAYOUT_OPTIONS = [
  'sidebar',
  'hero-timeline',
  'grid',
  'classic',
  'split',
  'hero-focus'
];

export function EnhancedPortfolioEditor({ portfolioPage }: EnhancedPortfolioEditorProps) {
  const { updatePortfolioPage, exportPortfolioAsCSV, getShareableLink } = usePortfolioPages();
  
  const [title, setTitle] = useState(portfolioPage.title);
  const [description, setDescription] = useState(portfolioPage.description || '');
  const [selectedLayout, setSelectedLayout] = useState(portfolioPage.theme || 'sidebar');
  const [isPublic, setIsPublic] = useState(portfolioPage.is_public || false);
  const [customUrl, setCustomUrl] = useState(portfolioPage.custom_url || '');
  const [profileData, setProfileData] = useState<ProfileData>(portfolioPage.profile_data || {
    avatar_url: '',
    professional_summary: '',
    skills: [],
    location: '',
    experience: [],
    education: []
  });

  // Auto-save profile data when it changes
  useEffect(() => {
    const saveTimer = setTimeout(() => {
      handleSave();
    }, 1000);

    return () => clearTimeout(saveTimer);
  }, [profileData, title, description, selectedLayout, isPublic, customUrl]);

  const handleSave = async () => {
    try {
      await updatePortfolioPage.mutateAsync({
        id: portfolioPage.id,
        title,
        description,
        theme: selectedLayout as any,
        is_public: isPublic,
        custom_url: customUrl,
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

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Portfolio Editor</h1>
          <p className="text-muted-foreground">Customize your portfolio layout and content</p>
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

      <Tabs defaultValue="design" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="design" className="space-y-6">
          <ProfileSection 
            profileData={profileData}
            onUpdate={setProfileData}
          />
        </TabsContent>

        <TabsContent value="layout" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Choose Your Layout</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select a layout that best showcases your work
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {LAYOUT_OPTIONS.map((layout) => (
                  <LayoutPreview
                    key={layout}
                    layout={layout}
                    isSelected={selectedLayout === layout}
                    onSelect={() => setSelectedLayout(layout)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Projects</CardTitle>
              <p className="text-sm text-muted-foreground">
                Projects from your portfolio
              </p>
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
