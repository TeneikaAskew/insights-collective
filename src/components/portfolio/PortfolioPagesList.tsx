import React, { useState } from 'react';
import { PortfolioPage } from '@/types/portfolio';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PenSquare, Settings, Share2, FileDown, Globe, Eye, Plus, FileText } from 'lucide-react';
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
  const { exportPortfolioAsCSV, getShareableLink } = usePortfolioPages();

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <CardTitle className="text-xl sm:text-2xl">Your portfolio page</CardTitle>
            <CardDescription className="text-sm">
              One page, always at the same link. Add finished projects to it and the link stays the same.
            </CardDescription>
          </div>
          
          {/* One page per account, so this only appears when there is not one
              yet. Offering "Create Portfolio" beside the portfolio you already
              have promises a second one that the database now refuses. */}
          {pages.length === 0 && (
            <Button onClick={onCreatePage} className="rounded-full text-sm sm:text-base px-3 sm:px-4 py-2 flex-shrink-0">
              <Plus className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Create your portfolio page</span>
              <span className="xs:hidden">Create</span>
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {!pages || pages.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <div className="mb-4 sm:mb-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-ss-lav-chip rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Globe className="h-6 w-6 sm:h-8 sm:w-8 text-ss-lav-deep" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2">Create Your First Portfolio</h3>
              <p className="text-muted-foreground max-w-md mx-auto text-sm sm:text-base">
                Transform your completed projects into professional portfolio pages that you can share with employers and clients.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-2xl mx-auto mb-6 sm:mb-8">
              <div className="text-center p-3 sm:p-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-ss-teal-chip rounded-lg flex items-center justify-center mx-auto mb-2">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-ss-teal" />
                </div>
                <h4 className="font-medium text-xs sm:text-sm">Select Projects</h4>
                <p className="text-xs text-muted-foreground mt-1">Choose from your completed projects</p>
              </div>
              
              <div className="text-center p-3 sm:p-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-ss-lav-chip rounded-lg flex items-center justify-center mx-auto mb-2">
                  <PenSquare className="h-5 w-5 sm:h-6 sm:w-6 text-ss-lav-deep" />
                </div>
                <h4 className="font-medium text-xs sm:text-sm">Customize Design</h4>
                <p className="text-xs text-muted-foreground mt-1">Pick themes and layouts</p>
              </div>
              
              <div className="text-center p-3 sm:p-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-ss-good-chip rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Share2 className="h-5 w-5 sm:h-6 sm:w-6 text-ss-good" />
                </div>
                <h4 className="font-medium text-xs sm:text-sm">Share & Export</h4>
                <p className="text-xs text-muted-foreground mt-1">Get shareable links and exports</p>
              </div>
            </div>
            
            <Button size="lg" onClick={onCreatePage} className="text-sm sm:text-base">
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Create Your First Portfolio
            </Button>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl">
            {pages.map((page) => (
              <Card key={page.id} className="w-full">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base sm:text-lg break-words">{page.title}</CardTitle>
                      <CardDescription className="mt-1 break-words text-sm">
                        {page.description || 'No description'}
                      </CardDescription>
                    </div>
                    <Badge variant={page.is_public ? "default" : "outline"} className="flex-shrink-0 self-start text-xs">
                      {page.is_public ? "Public" : "Private"}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <span className="font-medium text-xs sm:text-sm text-muted-foreground">Theme</span>
                      <p className="text-xs sm:text-sm capitalize">{page.theme}</p>
                    </div>
                    
                    {page.custom_url && (
                      <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                        <span className="font-medium text-xs sm:text-sm text-muted-foreground">URL</span>
                        <p className="text-xs sm:text-sm text-muted-foreground break-all">/portfolio/{page.custom_url}</p>
                      </div>
                    )}
                    
                    <div className="space-y-1">
                      <span className="font-medium text-xs sm:text-sm text-muted-foreground">Created</span>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {new Date(page.created_at as string).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
                
                <Separator />
                
                <CardFooter className="p-3 sm:p-4">
                  {/* Fixed button layout for desktop - using flex grid instead of wrapping */}
                  <div className="w-full">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={() => viewPage(page)}
                        className="text-xs"
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleShare(page)}
                        className="text-xs"
                      >
                        <Share2 className="h-3 w-3 mr-1" />
                        Share
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleExport(page.id)}
                        className="text-xs"
                      >
                        <FileDown className="h-3 w-3 mr-1" />
                        Export
                      </Button>
                      {page.is_public && page.custom_url ? (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => previewPage(page)}
                          className="text-xs"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Preview
                        </Button>
                      ) : (
                        <div className="hidden sm:block"></div>
                      )}
                    </div>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
      

    </Card>
  );
}
