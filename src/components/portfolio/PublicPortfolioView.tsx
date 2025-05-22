
import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { Spinner } from '@/components/ui/spinner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PublicPortfolioView() {
  const { customUrl } = useParams<{ customUrl: string }>();
  const { getPublicPortfolioPage } = usePortfolioPages();
  
  const { data: portfolioData, isLoading, error } = useQuery({
    queryKey: ['public-portfolio', customUrl],
    queryFn: () => getPublicPortfolioPage(customUrl || ''),
    enabled: !!customUrl,
  });
  
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
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Portfolio not found</h2>
          <p className="text-gray-600 mb-6">
            The portfolio you're looking for may have been removed or is private.
          </p>
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return to home
            </Link>
          </Button>
        </Card>
      </div>
    );
  }
  
  // Apply theme styles based on the portfolio theme
  let themeStyles = {};
  switch (portfolioData.theme) {
    case 'minimal':
      themeStyles = {
        backgroundColor: "#ffffff",
        fontFamily: "'Inter', sans-serif",
        color: "#333333",
      };
      break;
    case 'professional':
      themeStyles = {
        backgroundColor: "#f8f9fa",
        fontFamily: "'Georgia', serif",
        color: "#2c3e50",
      };
      break;
    case 'creative':
      themeStyles = {
        backgroundColor: "#fff8f3",
        fontFamily: "'Poppins', sans-serif",
        color: "#333333",
      };
      break;
    default:
      themeStyles = {
        backgroundColor: "#ffffff",
        fontFamily: "'system-ui', sans-serif",
        color: "#111827",
      };
  }
  
  return (
    <div style={themeStyles} className="min-h-screen pb-12">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-3">{portfolioData.title}</h1>
          {portfolioData.description && (
            <p className="text-lg opacity-75 max-w-2xl mx-auto">
              {portfolioData.description}
            </p>
          )}
        </header>
        
        {!portfolioData.projects || portfolioData.projects.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl text-gray-500">
              This portfolio has no projects yet.
            </p>
          </div>
        ) : (
          <div className="space-y-16">
            {portfolioData.projects.map((projectItem) => {
              const project = projectItem.project;
              if (!project) return null;
              
              return (
                <div key={projectItem.id} className="border-b pb-14 last:border-0">
                  <h2 className="text-2xl md:text-3xl font-bold mb-4">{project.title}</h2>
                  <p className="text-lg mb-6 leading-relaxed">
                    {projectItem.custom_description || project.description}
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {project.required_skills && project.required_skills.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold uppercase tracking-wider opacity-70">Skills</h3>
                        <div className="flex flex-wrap gap-2">
                          {project.required_skills.map((skill, i) => (
                            <span 
                              key={i} 
                              className="bg-opacity-10 bg-gray-500 text-sm px-3 py-1 rounded-full"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wider opacity-70">Project Details</h3>
                      <div className="space-y-2">
                        {project.effort_level && (
                          <div>
                            <span className="font-medium">Effort:</span> {project.effort_level}
                          </div>
                        )}
                        {project.impact && (
                          <div>
                            <span className="font-medium">Impact:</span> {project.impact}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {project.roadmap && project.roadmap.milestones && project.roadmap.milestones.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-sm font-semibold uppercase tracking-wider opacity-70 mb-3">Key Achievements</h3>
                      <ul className="space-y-2 list-disc list-inside">
                        {project.roadmap.milestones.map((milestone, idx) => (
                          <li key={idx} className="text-gray-800">{milestone}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <footer className="mt-20 pt-8 border-t text-center text-sm opacity-60">
        <div className="container mx-auto px-4">
          <p>Portfolio created with AI Portfolio Explorer</p>
        </div>
      </footer>
    </div>
  );
}
