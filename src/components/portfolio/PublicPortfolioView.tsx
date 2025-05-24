
import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { Spinner } from '@/components/ui/spinner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Github, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PublicPortfolioView() {
  const { customUrl } = useParams<{ customUrl: string }>();
  const { getPublicPortfolioPage } = usePortfolioPages();
  
  const { data: portfolioData, isLoading, error } = useQuery({
    queryKey: ['public-portfolio', customUrl],
    queryFn: () => getPublicPortfolioPage(customUrl || ''),
    enabled: !!customUrl,
  });
  
  console.log('Public portfolio data:', portfolioData);
  console.log('Projects in public view:', portfolioData?.projects);
  
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
        
        {!portfolioData.projects || !Array.isArray(portfolioData.projects) || portfolioData.projects.length === 0 ? (
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
                  <div className="grid md:grid-cols-2 gap-8 mb-6">
                    {/* Project Image */}
                    <div className="order-2 md:order-1">
                      <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-2xl font-bold bg-blue-500">
                            {project.title.charAt(0)}
                          </div>
                          <p className="text-sm text-gray-500">Project Preview</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Project Info */}
                    <div className="order-1 md:order-2">
                      <h2 className="text-2xl md:text-3xl font-bold mb-4">{project.title}</h2>
                      <p className="text-lg mb-6 leading-relaxed">
                        {projectItem.custom_description || project.description}
                      </p>
                      
                      {/* Action Links */}
                      <div className="flex gap-3 mb-6">
                        {project.github_url && (
                          <a
                            href={project.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                          >
                            <Github className="h-4 w-4" />
                            Code
                          </a>
                        )}
                        {project.live_url && (
                          <a
                            href={project.live_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Live Demo
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {project.required_skills && project.required_skills.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold uppercase tracking-wider opacity-70">Skills</h3>
                        <div className="flex flex-wrap gap-2">
                          {project.required_skills.map((skill, i) => (
                            <Badge
                              key={i} 
                              variant="secondary"
                              className="text-sm px-3 py-1"
                            >
                              {skill}
                            </Badge>
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
