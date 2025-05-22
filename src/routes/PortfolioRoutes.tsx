
import React from 'react';
import { Route } from 'react-router-dom';
import { PortfolioEditor } from '@/components/portfolio/PortfolioEditor';
import { PublicPortfolioView } from '@/components/portfolio/PublicPortfolioView';
import PortfolioExplorer from '@/pages/PortfolioExplorer';
import ProtectedRoute from '@/components/ProtectedRoute';

export const portfolioRoutes = (
  <>
    <Route 
      path="/portfolio-explorer" 
      element={
        <ProtectedRoute>
          <PortfolioExplorer />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/portfolio-editor/:pageId" 
      element={
        <ProtectedRoute>
          <PortfolioEditor />
        </ProtectedRoute>
      } 
    />
    <Route path="/portfolio/:customUrl" element={<PublicPortfolioView />} />
  </>
);
