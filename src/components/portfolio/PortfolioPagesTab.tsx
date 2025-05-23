
import React, { useState } from 'react';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { CreatePortfolioPageForm } from './CreatePortfolioPageForm';
import { PortfolioPagesList } from './PortfolioPagesList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Globe, Users, FileText, Share } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

export function PortfolioPagesTab() {
  const { portfolioPages, pagesLoading } = usePortfolioPages();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  if (pagesLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const publicPortfolios = portfolioPages?.filter(page => page.is_public) || [];
  const privatePortfolios = portfolioPages?.filter(page => !page.is_public) || [];

  return (
    <div className="space-y-8">
      {/* Header with stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-[#9b87f5]" />
              <div>
                <p className="text-sm text-gray-500">Total Portfolios</p>
                <p className="text-2xl font-bold">{portfolioPages?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Globe className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-gray-500">Public</p>
                <p className="text-2xl font-bold">{publicPortfolios.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500">Private</p>
                <p className="text-2xl font-bold">{privatePortfolios.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Share className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-gray-500">Shared Links</p>
                <p className="text-2xl font-bold">{publicPortfolios.filter(p => p.custom_url).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">My Portfolio Pages</CardTitle>
              <CardDescription>
                Create professional portfolio pages to showcase your completed projects
              </CardDescription>
            </div>
            
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#9b87f5] hover:bg-[#8B5CF6]">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Portfolio
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Portfolio</DialogTitle>
                  <DialogDescription>
                    Set up a new portfolio page to showcase your work
                  </DialogDescription>
                </DialogHeader>
                <CreatePortfolioPageForm onSuccess={() => setCreateDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        
        <CardContent>
          {!portfolioPages || portfolioPages.length === 0 ? (
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
                    <Users className="h-6 w-6 text-purple-500" />
                  </div>
                  <h4 className="font-medium text-sm">Customize Design</h4>
                  <p className="text-xs text-gray-500 mt-1">Pick themes and layouts</p>
                </div>
                
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Share className="h-6 w-6 text-green-500" />
                  </div>
                  <h4 className="font-medium text-sm">Share & Export</h4>
                  <p className="text-xs text-gray-500 mt-1">Get shareable links and exports</p>
                </div>
              </div>
              
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="bg-[#9b87f5] hover:bg-[#8B5CF6]">
                    <Plus className="h-5 w-5 mr-2" />
                    Create Your First Portfolio
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Portfolio</DialogTitle>
                    <DialogDescription>
                      Set up a new portfolio page to showcase your work
                    </DialogDescription>
                  </DialogHeader>
                  <CreatePortfolioPageForm onSuccess={() => setCreateDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <PortfolioPagesList 
              portfolioPages={portfolioPages} 
              onCreateNew={() => setCreateDialogOpen(true)} 
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
