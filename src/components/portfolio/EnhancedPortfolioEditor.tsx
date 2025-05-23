
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { usePortfolio } from '@/hooks/usePortfolio';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, Eye, Share, Settings, Palette, Layout, Folder } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PortfolioTheme } from '@/types/portfolio';

export function EnhancedPortfolioEditor() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { updatePortfolioPage } = usePortfolioPages();
  const { data: portfolioData, isLoading } = usePortfolioPages().usePortfolioPageWithProjects(pageId);
  const { projects } = usePortfolio();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    theme: 'default' as PortfolioTheme,
    is_public: false,
    custom_url: '',
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (portfolioData) {
      setFormData({
        title: portfolioData.title,
        description: portfolioData.description || '',
        theme: portfolioData.theme as PortfolioTheme,
        is_public: portfolioData.is_public,
        custom_url: portfolioData.custom_url || '',
      });
    }
  }, [portfolioData]);

  const handleSave = async () => {
    if (!pageId) return;

    try {
      setIsSaving(true);
      await updatePortfolioPage.mutateAsync({
        id: pageId,
        ...formData
      });
      toast({
        title: 'Success',
        description: 'Portfolio page updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update portfolio page',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = () => {
    if (formData.custom_url) {
      window.open(`/portfolio/${formData.custom_url}`, '_blank');
    } else {
      toast({
        title: 'Preview unavailable',
        description: 'Set a custom URL to enable preview',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!portfolioData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-2xl font-bold mb-4">Portfolio not found</h2>
        <Button onClick={() => navigate('/portfolio-explorer')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Portfolio Explorer
        </Button>
      </div>
    );
  }

  const completedProjects = projects?.filter(p => p.status === 'Completed') || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/portfolio-explorer')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{portfolioData.title}</h1>
                <p className="text-gray-500">Portfolio Editor</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge variant={formData.is_public ? "default" : "outline"}>
                {formData.is_public ? "Public" : "Private"}
              </Badge>
              <Button variant="outline" onClick={handlePreview}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="bg-[#9b87f5] hover:bg-[#8B5CF6]">
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Tabs defaultValue="design" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="design" className="flex items-center">
              <Palette className="h-4 w-4 mr-2" />
              Design
            </TabsTrigger>
            <TabsTrigger value="layout" className="flex items-center">
              <Layout className="h-4 w-4 mr-2" />
              Layout
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex items-center">
              <Folder className="h-4 w-4 mr-2" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Design Tab */}
          <TabsContent value="design">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>
                    Update your portfolio's basic details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="title">Portfolio Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="My Professional Portfolio"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="A showcase of my best work..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Theme Selection</CardTitle>
                  <CardDescription>
                    Choose a visual theme for your portfolio
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Select
                    value={formData.theme}
                    onValueChange={(value: PortfolioTheme) => setFormData(prev => ({ ...prev, theme: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="creative">Creative</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects">
            <Card>
              <CardHeader>
                <CardTitle>Portfolio Projects</CardTitle>
                <CardDescription>
                  Manage which projects appear in your portfolio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {portfolioData.projects && portfolioData.projects.length > 0 ? (
                    <div className="space-y-2">
                      {portfolioData.projects.map((projectItem) => (
                        <div key={projectItem.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h4 className="font-medium">{projectItem.project?.title}</h4>
                            <p className="text-sm text-gray-500">{projectItem.project?.description}</p>
                          </div>
                          <Badge variant="outline">Included</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">No projects added yet</p>
                      <p className="text-sm text-gray-400">
                        Add completed projects from your project tracker
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Portfolio Settings</CardTitle>
                <CardDescription>
                  Configure privacy and sharing options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="is_public">Public Portfolio</Label>
                    <p className="text-sm text-gray-500">
                      Allow anyone with the link to view your portfolio
                    </p>
                  </div>
                  <Switch
                    id="is_public"
                    checked={formData.is_public}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_public: checked }))}
                  />
                </div>
                
                <Separator />
                
                <div>
                  <Label htmlFor="custom_url">Custom URL</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-sm text-gray-500">/portfolio/</span>
                    <Input
                      id="custom_url"
                      value={formData.custom_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, custom_url: e.target.value }))}
                      placeholder="my-portfolio"
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Use only letters, numbers, and hyphens
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Layout Tab */}
          <TabsContent value="layout">
            <Card>
              <CardHeader>
                <CardTitle>Layout Options</CardTitle>
                <CardDescription>
                  Customize how your portfolio is displayed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">Layout customization coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
