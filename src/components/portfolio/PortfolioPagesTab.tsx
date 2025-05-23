
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { PortfolioPagesList } from './PortfolioPagesList';
import { CreatePortfolioPageForm } from './CreatePortfolioPageForm';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { PortfolioTheme } from '@/types/portfolio';

export function PortfolioPagesTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { portfolioPages, pagesLoading, addPortfolioPage } = usePortfolioPages();
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Check if we should show create form based on URL params
  useEffect(() => {
    const createNew = searchParams.get('createNew');
    if (createNew === 'true') {
      setShowCreateForm(true);
      // Remove the param after processing it
      searchParams.delete('createNew');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const handleCreatePageSubmit = async (formData: {
    title: string;
    description: string;
    theme: PortfolioTheme;
    is_public: boolean;
    custom_url: string;
  }) => {
    await addPortfolioPage.mutateAsync(formData);
    setShowCreateForm(false);
  };

  if (showCreateForm) {
    return (
      <div className="max-w-2xl mx-auto">
        <CreatePortfolioPageForm
          onSubmit={handleCreatePageSubmit}
          onCancel={() => setShowCreateForm(false)}
          isLoading={addPortfolioPage.isPending}
        />
      </div>
    );
  }

  return (
    <>
      {!portfolioPages || portfolioPages.length === 0 && !pagesLoading ? (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4 max-w-md">
              <h3 className="text-2xl font-semibold">Create Your Portfolio</h3>
              <p className="text-gray-600">
                Showcase your projects in a professional portfolio that you can share with others.
                Select projects from your completed work to display your skills and achievements.
              </p>
              <div className="mt-6">
                <CreatePortfolioPageForm
                  onSubmit={handleCreatePageSubmit}
                  onCancel={() => {}}
                  isLoading={addPortfolioPage.isPending}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <PortfolioPagesList
          pages={portfolioPages || []}
          isLoading={pagesLoading}
          onCreatePage={() => setShowCreateForm(true)}
        />
      )}
    </>
  );
}
