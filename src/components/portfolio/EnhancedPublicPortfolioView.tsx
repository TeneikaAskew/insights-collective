
import React from 'react';
import { PortfolioPage } from '@/types/portfolio';
import { PortfolioLayoutRenderer } from './PortfolioLayoutRenderer';

interface EnhancedPublicPortfolioViewProps {
  portfolioPage: PortfolioPage;
}

export function EnhancedPublicPortfolioView({ portfolioPage }: EnhancedPublicPortfolioViewProps) {
  return <PortfolioLayoutRenderer portfolioPage={portfolioPage} />;
}
