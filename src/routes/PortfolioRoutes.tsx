
import React from 'react';
import { Route } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { EnhancedPortfolioEditor } from '@/components/portfolio/EnhancedPortfolioEditor';
import { PortfolioLayoutRenderer } from '@/components/portfolio/PortfolioLayoutRenderer';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { Spinner } from '@/components/ui/spinner';
import PortfolioExplorer from '@/pages/PortfolioExplorer';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageVisibilityGuard from '@/components/PageVisibilityGuard';

// Wrapper component for EnhancedPortfolioEditor
function PortfolioEditorWrapper() {
  const { pageId } = useParams<{ pageId: string }>();
  const { usePortfolioPageWithProjects } = usePortfolioPages();
  const { data: portfolioPage, isLoading } = usePortfolioPageWithProjects(pageId);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!portfolioPage) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Portfolio page not found</p>
      </div>
    );
  }

  return <EnhancedPortfolioEditor portfolioPage={portfolioPage} />;
}

// Fixed wrapper component for public portfolio view
function PublicPortfolioViewWrapper() {
  const { customUrl } = useParams<{ customUrl: string }>();
  const { getPublicPortfolioPage } = usePortfolioPages();
  
  const { data: portfolioPage, isLoading, error } = useQuery({
    queryKey: ['public-portfolio', customUrl],
    queryFn: () => getPublicPortfolioPage(customUrl || ''),
    enabled: !!customUrl,
  });

  console.log('PublicPortfolioViewWrapper - customUrl:', customUrl);
  console.log('PublicPortfolioViewWrapper - portfolioPage:', portfolioPage);
  console.log('PublicPortfolioViewWrapper - projects:', portfolioPage?.projects);
  console.log('PublicPortfolioViewWrapper - projects length:', portfolioPage?.projects?.length);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !portfolioPage) {
    console.error('PublicPortfolioViewWrapper - Error or no data:', error);
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Portfolio not found</h2>
          <p className="text-gray-600 mb-6">
            The portfolio you're looking for may have been removed or is private.
          </p>
        </div>
      </div>
    );
  }

  // Use PortfolioLayoutRenderer directly for consistency with editor
  return <PortfolioLayoutRenderer portfolioPage={portfolioPage} />;
}

export const portfolioRoutes = (
  <>
    <Route 
      path="/portfolio-explorer" 
      element={
        <ProtectedRoute>
          <PageVisibilityGuard>
            <PortfolioExplorer />
          </PageVisibilityGuard>
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/portfolio-editor/:pageId" 
      element={
        <ProtectedRoute>
          <PageVisibilityGuard>
            <PortfolioEditorWrapper />
          </PageVisibilityGuard>
        </ProtectedRoute>
      } 
    />
    <Route path="/portfolio/:customUrl" element={<PublicPortfolioViewWrapper />} />
  </>
);
