
import React, { useState } from 'react';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { CreatePortfolioPageForm } from './CreatePortfolioPageForm';
import { PortfolioPagesList } from './PortfolioPagesList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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

  // The four stat tiles are gone. With one page per account they read
  // "Total 1 / Public 1 / Private 0 / Shared Links 1" — four numbers that
  // restate each other and never change. The page's own header says whether it
  // is live and where it points, which is the part that varies.
  return (
    <div className="space-y-8">
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
