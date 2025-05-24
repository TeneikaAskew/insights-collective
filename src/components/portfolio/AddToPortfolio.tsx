
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PortfolioPage, PortfolioProject } from '@/types/portfolio';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Loader2, Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';

interface AddToPortfolioProps {
  project: PortfolioProject;
}

export function AddToPortfolio({ project }: AddToPortfolioProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { portfolioPages, pagesLoading, addProjectToPage } = usePortfolioPages();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addingToPage, setAddingToPage] = useState<string | null>(null);
  const [addedToPages, setAddedToPages] = useState<string[]>([]);
  
  const handleAddToPage = async (pageId: string) => {
    if (!user) {
      console.log('No user found');
      return;
    }
    
    console.log('Starting handleAddToPage:', { pageId, projectId: project.id, userId: user.id });
    setAddingToPage(pageId);
    
    try {
      const result = await addProjectToPage.mutateAsync({
        pageId,
        projectId: project.id
      });
      
      console.log('Successfully added project to page:', result);
      setAddedToPages((prev) => [...prev, pageId]);
      
      // Close dialog after successful addition
      setTimeout(() => {
        setDialogOpen(false);
      }, 1000);
      
    } catch (error) {
      console.error('Error adding project to page:', error);
      // Don't close dialog on error so user can try again
    } finally {
      setAddingToPage(null);
    }
  };
  
  const handleCreateNewPortfolio = () => {
    setDialogOpen(false);
    navigate('/portfolio-explorer?tab=pages&createNew=true');
  };
  
  // Check if project already exists in any portfolio pages
  const getProjectPortfolioStatus = (pageId: string) => {
    const page = portfolioPages?.find(p => p.id === pageId);
    if (!page || !page.projects) return false;
    
    return page.projects.some(pp => pp.project_id === project.id);
  };
  
  if (!user || project.status !== 'Completed') {
    return null;
  }
  
  console.log('Rendering AddToPortfolio with portfolioPages:', portfolioPages);
  
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="ml-2">
          <Plus className="h-3 w-3 mr-1" />
          Add to Portfolio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Portfolio</DialogTitle>
          <DialogDescription>
            Select a portfolio to add "{project.title}" to, or create a new portfolio page.
          </DialogDescription>
        </DialogHeader>
        
        {pagesLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : !portfolioPages || portfolioPages.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-500 mb-4">You don't have any portfolio pages yet.</p>
            <Button onClick={handleCreateNewPortfolio} className="bg-[#9b87f5] hover:bg-[#8B5CF6]">
              Create Your First Portfolio Page
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[300px] pr-3">
              <div className="space-y-2">
                {portfolioPages.map((page) => {
                  const isAlreadyInPortfolio = getProjectPortfolioStatus(page.id);
                  const isAddedNow = addedToPages.includes(page.id);
                  const isAdded = isAlreadyInPortfolio || isAddedNow;
                  const isLoading = addingToPage === page.id;
                  
                  console.log('Rendering page:', {
                    pageId: page.id,
                    title: page.title,
                    isAlreadyInPortfolio,
                    isAddedNow,
                    isAdded,
                    isLoading,
                    projectCount: page.projects?.length || 0
                  });
                  
                  return (
                    <Card 
                      key={page.id} 
                      className={`transition-colors cursor-pointer ${isAdded ? 'border-green-500 bg-green-50' : 'hover:bg-gray-50'}`}
                      onClick={() => {
                        if (!isAdded && !isLoading) {
                          console.log('Card clicked for page:', page.id);
                          handleAddToPage(page.id);
                        }
                      }}
                    >
                      <CardContent className="p-4 flex justify-between items-center">
                        <div className="flex-1">
                          <h3 className="font-medium">{page.title}</h3>
                          {page.description && (
                            <p className="text-sm text-gray-500">{page.description}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {page.projects?.length || 0} project(s)
                          </p>
                        </div>
                        
                        <div className="flex items-center">
                          {isAdded ? (
                            <div className="flex items-center text-green-600">
                              <CheckCircle2 className="h-5 w-5 mr-2" />
                              <span className="text-sm font-medium">
                                {isAlreadyInPortfolio ? 'Already Added' : 'Added'}
                              </span>
                            </div>
                          ) : (
                            <Button 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('Button clicked for page:', page.id);
                                handleAddToPage(page.id);
                              }}
                              disabled={isLoading || addProjectToPage.isPending}
                              className="bg-[#9b87f5] hover:bg-[#8B5CF6]"
                            >
                              {isLoading ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Adding...
                                </>
                              ) : (
                                'Add'
                              )}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
            
            <div className="mt-4 text-center">
              <Button 
                variant="outline" 
                onClick={handleCreateNewPortfolio}
              >
                <Plus className="h-4 w-4 mr-1" />
                Create New Portfolio Page
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
