
import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { Spinner } from '@/components/ui/spinner';
import { PortfolioLayoutRenderer } from './PortfolioLayoutRenderer';

export function PublicPortfolioView() {
  const { customUrl } = useParams<{ customUrl: string }>();
  const { getPublicPortfolioPage } = usePortfolioPages();
  
  const { data: portfolioData, isLoading, error } = useQuery({
    queryKey: ['public-portfolio', customUrl],
    queryFn: () => getPublicPortfolioPage(customUrl || ''),
    enabled: !!customUrl,
  });
  
  console.log('Public portfolio data in PublicPortfolioView:', portfolioData);
  console.log('Projects in PublicPortfolioView:', portfolioData?.projects);
  console.log('Projects count:', portfolioData?.projects?.length || 0);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }
  
  if (error || !portfolioData) {
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
