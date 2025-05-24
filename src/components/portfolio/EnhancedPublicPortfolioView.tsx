
import React, { useState, useEffect } from 'react';
import { PortfolioPage } from '@/types/portfolio';
import { PortfolioLayoutRenderer } from './PortfolioLayoutRenderer';
import { supabase } from '@/integrations/supabase/client';

interface EnhancedPublicPortfolioViewProps {
  portfolioPage: PortfolioPage;
}

export function EnhancedPublicPortfolioView({ portfolioPage }: EnhancedPublicPortfolioViewProps) {
  const [viewCount, setViewCount] = useState(0);

  useEffect(() => {
    // Track page view
    trackPageView();
    
    // Load view count
    loadViewCount();
  }, []);

  const trackPageView = async () => {
    try {
      // Insert view record
      await supabase
        .from('portfolio_page_views')
        .insert({
          portfolio_page_id: portfolioPage.id,
          viewed_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error tracking page view:', error);
    }
  };

  const loadViewCount = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count } = await supabase
        .from('portfolio_page_views')
        .select('*', { count: 'exact', head: true })
        .eq('portfolio_page_id', portfolioPage.id)
        .gte('viewed_at', thirtyDaysAgo.toISOString());

      setViewCount(count || 0);
    } catch (error) {
      console.error('Error loading view count:', error);
    }
  };

  return <PortfolioLayoutRenderer portfolioPage={portfolioPage} />;
}
