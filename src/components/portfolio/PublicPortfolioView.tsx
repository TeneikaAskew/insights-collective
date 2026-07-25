
import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { Spinner } from '@/components/ui/spinner';
import { PortfolioLayoutRenderer } from './PortfolioLayoutRenderer';

import { createLogger } from '@/utils/logger';

const logger = createLogger('PublicPortfolioView');

export function PublicPortfolioView() {
  const { customUrl } = useParams<{ customUrl: string }>();
  const { getPublicPortfolioPage } = usePortfolioPages();
  
  const { data: portfolioData, isLoading, error } = useQuery({
    queryKey: ['public-portfolio', customUrl],
    queryFn: () => getPublicPortfolioPage(customUrl || ''),
    enabled: !!customUrl,
  });
  
  logger.log('Public portfolio data in PublicPortfolioView:', portfolioData);
  logger.log('Projects in PublicPortfolioView:', portfolioData?.projects);
  logger.log('Projects count:', portfolioData?.projects?.length || 0);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }
  
  // Distinguish a fetch failure from a genuinely missing/private portfolio.
  if (error) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="p-8 text-center" role="alert">
          <h2 className="text-2xl font-bold mb-4">Failed to load portfolio</h2>
          <p className="text-gray-600 mb-6">
            Something went wrong loading this portfolio. Please try again.
          </p>
          <button
            className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!portfolioData) {
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
  
  // Use the PortfolioLayoutRenderer to ensure consistent rendering
  return <PortfolioLayoutRenderer portfolioPage={portfolioData} />;
}
