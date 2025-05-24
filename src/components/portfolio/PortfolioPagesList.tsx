
import React, { useState } from 'react';
import { PortfolioPage } from '@/types/portfolio';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PenSquare, Settings, Share2, Trash, FileDown, Globe, Eye, Plus, FileText } from 'lucide-react';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface PortfolioPagesListProps {
  pages: PortfolioPage[];
  isLoading: boolean;
  onCreatePage: () => void;
}

export function PortfolioPagesList({ pages, isLoading, onCreatePage }: PortfolioPagesListProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { deletePortfolioPage, updatePortfolioPage, exportPortfolioAsCSV, getShareableLink } = usePortfolioPages();
  const [editingPage, setEditingPage] = useState<PortfolioPage | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<PortfolioPage | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    theme: 'default',
    is_public: false,
    custom_url: '',
  });

  const handleEditPage = (page: PortfolioPage) => {
    setEditingPage(page);
    setFormData({
      title: page.title,
      description: page.description || '',
      theme: page.theme,
      is_public: page.is_public,
      custom_url: page.custom_url || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleDeletePage = (page: PortfolioPage) => {
    setPageToDelete(page);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeletePage = async () => {
    if (pageToDelete) {
      await deletePortfolioPage.mutateAsync(pageToDelete.id);
      setIsDeleteDialogOpen(false);
      setPageToDelete(null);
    }
  };

  const handleUpdatePage = async () => {
    if (!editingPage) return;

    // Make sure custom URL is URL-friendly
    const urlFriendlyCustomUrl = formData.custom_url
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    await updatePortfolioPage.mutateAsync({
      id: editingPage.id,
      title: formData.title,
      description: formData.description,
      theme: formData.theme as 'default' | 'minimal' | 'professional' | 'creative',
      is_public: formData.is_public,
      custom_url: urlFriendlyCustomUrl,
    });
    
    setIsEditDialogOpen(false);
  };

  const handleShare = (page: PortfolioPage) => {
    if (!page.is_public || !page.custom_url) {
      toast({
        title: "Cannot share",
        description: "Make your portfolio public and set a custom URL to share it.",
        variant: "destructive",
      });
      return;
    }

    const shareUrl = getShareableLink(page.custom_url);
    
    // Copy to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({
        title: "Link copied!",
        description: "Portfolio link has been copied to clipboard.",
      });
    });
  };

  const handleExport = async (pageId: string) => {
    await exportPortfolioAsCSV(pageId);
  };

  const viewPage = (page: PortfolioPage) => {
    navigate(`/portfolio-editor/${page.id}`);
  };

  const previewPage = (page: PortfolioPage) => {
    if (!page.custom_url) {
      toast({
        title: "Cannot preview",
        description: "Set a custom URL first to enable preview.",
        variant: "destructive",
      });
      return;
    }
    
    window.open(`/portfolio/${page.custom_url}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-2xl">My Portfolio Pages</CardTitle>
            <CardDescription>
              Create professional portfolio pages to showcase your completed projects
            </CardDescription>
          </div>
          
          <Button onClick={onCreatePage} className="bg-[#9b87f5] hover:bg-[#8B5CF6]">
            <Plus className="h-4 w-4 mr-2" />
            Create Portfolio
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {!pages || pages.length === 0 ? (
          <div className="text-center py-12">
            <div className="mb-6">
              <div className="w-16 h-16 bg-[#9b87f5]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="h-8 w-8 text-[#9b87f5]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Create Your First Portfolio</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Transform your completed projects into professional portfolio pages that you can share with employers and clients.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <FileText className="h-6 w-6 text-blue-500" />
                </div>
                <h4 className="font-medium text-sm">Select Projects</h4>
                <p className="text-xs text-gray-500 mt-1">Choose from your completed projects</p>
              </div>
              
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <PenSquare className="h-6 w-6 text-purple-500" />
                </div>
                <h4 className="font-medium text-sm">Customize Design</h4>
                <p className="text-xs text-gray-500 mt-1">Pick themes and layouts</p>
              </div>
              
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Share2 className="h-6 w-6 text-green-500" />
                </div>
                <h4 className="font-medium text-sm">Share & Export</h4>
                <p className="text-xs text-gray-500 mt-1">Get shareable links and exports</p>
              </div>
            </div>
            
            <Button size="lg" onClick={onCreatePage} className="bg-[#9b87f5] hover:bg-[#8B5CF6]">
              <Plus className="h-5 w-5 mr-2" />
              Create Your First Portfolio
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pages.map((page) => (
              <Card key={page.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{page.title}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-2">
                        {page.description || 'No description'}
                      </CardDescription>
                    </div>
                    <Badge variant={page.is_public ? "default" : "outline"} className="ml-2 flex-shrink-0">
                      {page.is_public ? "Public" : "Private"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="text-sm space-y-1">
                    <p><strong>Theme:</strong> {page.theme}</p>
                    {page.custom_url && (
                      <p><strong>URL:</strong> /portfolio/{page.custom_url}</p>
                    )}
                    <p className="text-gray-500 text-xs">
                      Created on {new Date(page.created_at as string).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
                <Separator />
                <CardFooter className="p-3">
                  <div className="flex justify-between items-center w-full">
                    <div className="flex space-x-1">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={() => viewPage(page)}
                        className="text-xs px-2"
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleShare(page)}
                        className="text-xs px-2"
                      >
                        <Share2 className="h-3 w-3 mr-1" />
                        Share
                      </Button>
                    </div>
                    <div className="flex space-x-1">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleExport(page.id)}
                        className="text-xs px-2"
                      >
                        <FileDown className="h-3 w-3 mr-1" />
                        Export
                      </Button>
                      {page.is_public && page.custom_url && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => previewPage(page)}
                          className="text-xs px-2"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Preview
                        </Button>
                      )}
                    </div>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
      
      {/* Edit Page Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Portfolio Page</DialogTitle>
            <DialogDescription>
              Update your portfolio page details and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input 
                id="title" 
                value={formData.title} 
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea 
                id="description" 
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select 
                value={formData.theme}
                onValueChange={(value) => setFormData({...formData, theme: value})}
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom_url">Custom URL</Label>
              <div className="flex gap-2 items-center">
                <span className="text-sm text-gray-500">/portfolio/</span>
                <Input 
                  id="custom_url" 
                  value={formData.custom_url} 
                  onChange={(e) => setFormData({...formData, custom_url: e.target.value})}
                  placeholder="my-portfolio"
                />
              </div>
              <p className="text-xs text-gray-500">
                Use only letters, numbers, and hyphens. No spaces or special characters.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="is_public"
                checked={formData.is_public}
                onCheckedChange={(checked) => setFormData({...formData, is_public: checked})}
              />
              <Label htmlFor="is_public">Make this portfolio public</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdatePage} className="bg-[#9b87f5] hover:bg-[#8B5CF6]">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Portfolio Page</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{pageToDelete?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeletePage}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
