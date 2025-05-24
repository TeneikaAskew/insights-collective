
import React from 'react';
import { Route } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { EnhancedPortfolioEditor } from '@/components/portfolio/EnhancedPortfolioEditor';
import { EnhancedPublicPortfolioView } from '@/components/portfolio/EnhancedPublicPortfolioView';
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

// Wrapper component for EnhancedPublicPortfolioView
function PublicPortfolioViewWrapper() {
  const { customUrl } = useParams<{ customUrl: string }>();
  const { getPublicPortfolioPage } = usePortfolioPages();
  const [portfolioPage, setPortfolioPage] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchPortfolio = async () => {
      if (!customUrl) return;
      
      try {
        const page = await getPublicPortfolioPage(customUrl);
        setPortfolioPage(page);
      } catch (error) {
        console.error('Error fetching portfolio:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPortfolio();
  }, [customUrl, getPublicPortfolioPage]);

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
        <p className="text-muted-foreground">Portfolio not found</p>
      </div>
    );
  }

  return <EnhancedPublicPortfolioView portfolioPage={portfolioPage} />;
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
