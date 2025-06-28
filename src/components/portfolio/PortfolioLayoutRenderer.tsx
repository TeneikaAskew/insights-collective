
import React from 'react';
import { PortfolioPage } from '@/types/portfolio';
import { SidebarLayout } from './layouts/SidebarLayout';
import { HeroTimelineLayout } from './layouts/HeroTimelineLayout';
import { GridLayout } from './layouts/GridLayout';
import { ClassicLayout } from './layouts/ClassicLayout';
import { SplitLayout } from './layouts/SplitLayout';
import { HeroFocusLayout } from './layouts/HeroFocusLayout';

interface PortfolioLayoutRendererProps {
  portfolioPage: PortfolioPage;
}

export function PortfolioLayoutRenderer({ portfolioPage }: PortfolioLayoutRendererProps) {
  const layout = portfolioPage.layout || 'classic';

  switch (layout) {
    case 'sidebar':
      return <SidebarLayout portfolioPage={portfolioPage} />;
    case 'hero-timeline':
      return <HeroTimelineLayout portfolioPage={portfolioPage} />;
    case 'grid':
      return <GridLayout portfolioPage={portfolioPage} />;
    case 'split':
      return <SplitLayout portfolioPage={portfolioPage} />;
    case 'hero-focus':
      return <HeroFocusLayout portfolioPage={portfolioPage} />;
    case 'classic':
    default:
      return <ClassicLayout portfolioPage={portfolioPage} />;
  }
}
