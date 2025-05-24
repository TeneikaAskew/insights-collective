
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
  
  console.log('Public portfolio data in component:', portfolioData);
  console.log('Projects in public view:', portfolioData?.projects);
  console.log('Projects is array?', Array.isArray(portfolioData?.projects));
  console.log('Projects length:', portfolioData?.projects?.length);
  
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
        
        {/* Profile section */}
        {portfolioData.profile_data && (
          <div className="mb-12 text-center">
            {portfolioData.profile_data.professional_summary && (
              <p className="text-lg mb-6 max-w-3xl mx-auto">
                {portfolioData.profile_data.professional_summary}
              </p>
            )}
            
            {portfolioData.profile_data.skills && portfolioData.profile_data.skills.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-4">Skills</h3>
                <div className="flex flex-wrap justify-center gap-2">
                  {portfolioData.profile_data.skills.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-sm">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Projects section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-8">Projects</h2>
          
          {(!portfolioData.projects || !Array.isArray(portfolioData.projects) || portfolioData.projects.length === 0) ? (
            <div className="text-center py-16">
              <p className="text-xl text-gray-500">
                This portfolio has no projects yet.
              </p>
              <div className="mt-4 p-4 bg-gray-100 rounded text-sm text-left">
                <h4 className="font-bold">Debug Information:</h4>
                <p>Projects found: {portfolioData.projects?.length || 0}</p>
                <p>Projects array exists: {portfolioData.projects ? 'Yes' : 'No'}</p>
                <p>Is array: {Array.isArray(portfolioData.projects) ? 'Yes' : 'No'}</p>
                <p>Portfolio ID: {portfolioData.id}</p>
                <p>Custom URL: {portfolioData.custom_url}</p>
                <p>Is Public: {portfolioData.is_public ? 'Yes' : 'No'}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-16">
              {portfolioData.projects.map((projectItem) => {
                const project = projectItem.project;
                if (!project) {
                  console.log('No project data for item:', projectItem);
                  return null;
                }
                
                return (
                  <div key={projectItem.id} className="border-b pb-14 last:border-0">
                    <div className="grid md:grid-cols-2 gap-8 mb-6">
                      {/* Project Image */}
                      <div className="order-2 md:order-1">
                        {project.project_images && project.project_images.length > 0 ? (
                          <div className="aspect-video rounded-lg overflow-hidden">
                            <img
                              src={project.project_images[0]}
                              alt={`${project.title} screenshot`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback to placeholder if image fails to load
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                            {/* Fallback placeholder (hidden by default) */}
                            <div className="hidden aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                              <div className="text-center">
                                <div className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-2xl font-bold bg-blue-500">
                                  {project.title.charAt(0)}
                                </div>
                                <p className="text-sm text-gray-500">Project Preview</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                            <div className="text-center">
                              <div className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-2xl font-bold bg-blue-500">
                                {project.title.charAt(0)}
                              </div>
                              <p className="text-sm text-gray-500">Project Preview</p>
                            </div>
                          </div>
                        )}
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
      </div>
      
      <footer className="mt-20 pt-8 border-t text-center text-sm opacity-60">
        <div className="container mx-auto px-4">
          <p>Portfolio created with AI Portfolio Explorer</p>
        </div>
      </footer>
    </div>
  );
}
