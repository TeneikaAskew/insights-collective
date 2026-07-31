
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
  const { portfolioPages, pagesLoading, portfolioPagesError } = usePortfolioPages();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  if (pagesLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  // A failed load must not render zeroed stat cards and the "create your
  // first portfolio" onboarding state to a user who has portfolios.
  if (portfolioPagesError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Failed to load your portfolio pages</CardTitle>
          <CardDescription role="alert">
            {portfolioPagesError instanceof Error ? portfolioPagesError.message : 'Please try again.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
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
              <FileText className="h-5 w-5 text-ss-lav-deep" />
              <div>
                <p className="text-sm text-muted-foreground">Total Portfolios</p>
                <p className="text-2xl font-bold">{portfolioPages?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Globe className="h-5 w-5 text-ss-good" />
              <div>
                <p className="text-sm text-muted-foreground">Public</p>
                <p className="text-2xl font-bold">{publicPortfolios.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-ss-teal" />
              <div>
                <p className="text-sm text-muted-foreground">Private</p>
                <p className="text-2xl font-bold">{privatePortfolios.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Share className="h-5 w-5 text-ss-lav-deep" />
              <div>
                <p className="text-sm text-muted-foreground">Shared Links</p>
                <p className="text-2xl font-bold">{publicPortfolios.filter(p => p.custom_url).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content - only show PortfolioPagesList, not duplicated content */}
      <PortfolioPagesList 
        pages={portfolioPages || []}
        isLoading={pagesLoading}
        onCreatePage={() => setCreateDialogOpen(true)} 
      />

      {/* Create Portfolio Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button className="hidden">Hidden Trigger</Button>
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
  );
}
