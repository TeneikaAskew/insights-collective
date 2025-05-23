
import React from 'react';
import { Route } from 'react-router-dom';
import { EnhancedPortfolioEditor } from '@/components/portfolio/EnhancedPortfolioEditor';
import { EnhancedPublicPortfolioView } from '@/components/portfolio/EnhancedPublicPortfolioView';
import PortfolioExplorer from '@/pages/PortfolioExplorer';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageVisibilityGuard from '@/components/PageVisibilityGuard';

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
            <EnhancedPortfolioEditor />
          </PageVisibilityGuard>
        </ProtectedRoute>
      } 
    />
    <Route path="/portfolio/:customUrl" element={<EnhancedPublicPortfolioView />} />
  </>
);
