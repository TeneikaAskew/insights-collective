
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
import { PenSquare, Settings, Share2, Trash, FileDown, Globe, Eye } from 'lucide-react';
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">My Portfolio Pages</h2>
        <Button onClick={onCreatePage} className="bg-[#9b87f5] hover:bg-[#8B5CF6]">
          Create New Page
        </Button>
      </div>
      
      {pages.length === 0 ? (
        <Card>
          <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-medium">No Portfolio Pages Yet</h3>
              <p className="text-gray-500">Create your first portfolio page to showcase your projects.</p>
              <Button onClick={onCreatePage} className="bg-[#9b87f5] hover:bg-[#8B5CF6]">
                Create Your First Portfolio
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pages.map((page) => (
            <Card key={page.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between">
                  <div>
                    <CardTitle className="text-xl">{page.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {page.description || 'No description'}
                    </CardDescription>
                  </div>
                  <Badge variant={page.is_public ? "default" : "outline"}>
                    {page.is_public ? "Public" : "Private"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  <p><strong>Theme:</strong> {page.theme}</p>
                  {page.custom_url && (
                    <p><strong>URL:</strong> /portfolio/{page.custom_url}</p>
                  )}
                  <p className="text-gray-500 text-xs mt-2">
                    Created on {new Date(page.created_at as string).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
              <Separator />
              <CardFooter className="px-6 py-3 justify-between">
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    onClick={() => viewPage(page)}
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleShare(page)}
                  >
                    <Share2 className="h-4 w-4 mr-1" />
                    Share
                  </Button>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleExport(page.id)}
                  >
                    <FileDown className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                  {page.is_public && page.custom_url && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => previewPage(page)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      
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
    </div>
  );
}
