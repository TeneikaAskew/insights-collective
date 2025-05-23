
import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { Spinner } from '@/components/ui/spinner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink, Github, Mail, Linkedin } from 'lucide-react';
import { Link } from 'react-router-dom';

export function EnhancedPublicPortfolioView() {
  const { customUrl } = useParams<{ customUrl: string }>();
  const { getPublicPortfolioPage } = usePortfolioPages();
  
  const { data: portfolioData, isLoading, error } = useQuery({
    queryKey: ['public-portfolio', customUrl],
    queryFn: () => getPublicPortfolioPage(customUrl || ''),
    enabled: !!customUrl,
  });
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Loading portfolio...</p>
        </div>
      </div>
    );
  }
  
  if (error || !portfolioData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full">
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
  
  // Apply enhanced theme styles
  const getThemeStyles = () => {
    switch (portfolioData.theme) {
      case 'minimal':
        return {
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          primaryColor: '#1e293b',
          accentColor: '#9b87f5',
          textColor: '#334155',
          cardBg: '#ffffff',
        };
      case 'professional':
        return {
          background: 'linear-gradient(135deg, #fafafa 0%, #f4f4f5 100%)',
          primaryColor: '#18181b',
          accentColor: '#6366f1',
          textColor: '#3f3f46',
          cardBg: '#ffffff',
        };
      case 'creative':
        return {
          background: 'linear-gradient(135deg, #fef7ff 0%, #f3e8ff 100%)',
          primaryColor: '#581c87',
          accentColor: '#a855f7',
          textColor: '#6b21a8',
          cardBg: '#ffffff',
        };
      default:
        return {
          background: 'linear-gradient(135deg, #fefefe 0%, #f9fafb 100%)',
          primaryColor: '#111827',
          accentColor: '#9b87f5',
          textColor: '#374151',
          cardBg: '#ffffff',
        };
    }
  };
  
  const theme = getThemeStyles();
  
  return (
    <div 
      style={{ 
        background: theme.background,
        color: theme.textColor,
        minHeight: '100vh'
      }}
    >
      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold" style={{ color: theme.primaryColor }}>
              {portfolioData.title}
            </h1>
            <div className="flex space-x-4">
              <Button variant="ghost" size="sm">
                <Mail className="h-4 w-4 mr-2" />
                Contact
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                style={{ 
                  borderColor: theme.accentColor,
                  color: theme.accentColor 
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Hire Me
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-8">
            <div 
              className="w-32 h-32 rounded-full mx-auto mb-6 flex items-center justify-center text-white text-4xl font-bold"
              style={{ backgroundColor: theme.accentColor }}
            >
              {portfolioData.title.charAt(0)}
            </div>
            <h1 
              className="text-5xl md:text-6xl font-bold mb-6"
              style={{ color: theme.primaryColor }}
            >
              {portfolioData.title}
            </h1>
            {portfolioData.description && (
              <p className="text-xl md:text-2xl max-w-4xl mx-auto leading-relaxed">
                {portfolioData.description}
              </p>
            )}
          </div>
          
          {/* Social Links */}
          <div className="flex justify-center space-x-6 mb-12">
            <Button variant="ghost" size="lg" className="text-gray-600 hover:text-gray-900">
              <Github className="h-6 w-6" />
            </Button>
            <Button variant="ghost" size="lg" className="text-gray-600 hover:text-gray-900">
              <Linkedin className="h-6 w-6" />
            </Button>
            <Button variant="ghost" size="lg" className="text-gray-600 hover:text-gray-900">
              <Mail className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 
              className="text-4xl font-bold mb-4"
              style={{ color: theme.primaryColor }}
            >
              Featured Projects
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              A showcase of my work and the technologies I've mastered
            </p>
          </div>
          
          {!portfolioData.projects || portfolioData.projects.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-xl text-gray-500">
                No projects to showcase yet.
              </p>
            </div>
          ) : (
            <div className="space-y-24">
              {portfolioData.projects.map((projectItem, index) => {
                const project = projectItem.project;
                if (!project) return null;
                
                const isEven = index % 2 === 0;
                
                return (
                  <div 
                    key={projectItem.id} 
                    className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${isEven ? '' : 'lg:grid-flow-col-dense'}`}
                  >
                    {/* Project Image/Visual */}
                    <div className={`${isEven ? 'lg:order-1' : 'lg:order-2'}`}>
                      <div 
                        className="aspect-video rounded-2xl shadow-2xl p-8 flex items-center justify-center"
                        style={{ backgroundColor: theme.cardBg }}
                      >
                        <div className="text-center">
                          <div 
                            className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold"
                            style={{ backgroundColor: theme.accentColor }}
                          >
                            {project.title.charAt(0)}
                          </div>
                          <h3 className="text-lg font-semibold" style={{ color: theme.primaryColor }}>
                            {project.title}
                          </h3>
                          <p className="text-sm text-gray-500 mt-2">
                            Interactive Demo
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Project Content */}
                    <div className={`${isEven ? 'lg:order-2' : 'lg:order-1'}`}>
                      <div className="space-y-6">
                        <div>
                          <h3 
                            className="text-3xl font-bold mb-4"
                            style={{ color: theme.primaryColor }}
                          >
                            {project.title}
                          </h3>
                          <p className="text-lg leading-relaxed">
                            {projectItem.custom_description || project.description}
                          </p>
                        </div>
                        
                        {/* Technologies */}
                        {project.required_skills && project.required_skills.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: theme.primaryColor }}>
                              Technologies Used
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {project.required_skills.map((skill, i) => (
                                <span 
                                  key={i} 
                                  className="px-4 py-2 rounded-full text-sm font-medium"
                                  style={{ 
                                    backgroundColor: `${theme.accentColor}20`,
                                    color: theme.accentColor 
                                  }}
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Key Features */}
                        {project.roadmap && project.roadmap.milestones && project.roadmap.milestones.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: theme.primaryColor }}>
                              Key Features
                            </h4>
                            <ul className="space-y-2">
                              {project.roadmap.milestones.slice(0, 3).map((milestone, idx) => (
                                <li key={idx} className="flex items-start">
                                  <div 
                                    className="w-2 h-2 rounded-full mt-2 mr-3 flex-shrink-0"
                                    style={{ backgroundColor: theme.accentColor }}
                                  ></div>
                                  <span>{milestone}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Project Links */}
                        <div className="flex space-x-4 pt-4">
                          <Button 
                            variant="default"
                            style={{ 
                              backgroundColor: theme.accentColor,
                              color: 'white'
                            }}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Live Demo
                          </Button>
                          <Button variant="outline">
                            <Github className="h-4 w-4 mr-2" />
                            Source Code
                          </Button>
                        </div>
                        
                        {/* Project Stats */}
                        <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-200">
                          {project.effort_level && (
                            <div>
                              <p className="text-sm text-gray-500">Complexity</p>
                              <p className="font-semibold" style={{ color: theme.primaryColor }}>
                                {project.effort_level}
                              </p>
                            </div>
                          )}
                          {project.impact && (
                            <div>
                              <p className="text-sm text-gray-500">Impact</p>
                              <p className="font-semibold" style={{ color: theme.primaryColor }}>
                                {project.impact}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
      
      {/* Contact Section */}
      <section 
        className="py-20 px-4"
        style={{ backgroundColor: `${theme.accentColor}10` }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 
            className="text-4xl font-bold mb-6"
            style={{ color: theme.primaryColor }}
          >
            Let's Work Together
          </h2>
          <p className="text-xl mb-8 text-gray-600">
            Interested in collaborating? I'd love to hear about your project.
          </p>
          <Button 
            size="lg"
            className="px-8 py-4 text-lg"
            style={{ 
              backgroundColor: theme.accentColor,
              color: 'white'
            }}
          >
            <Mail className="h-5 w-5 mr-2" />
            Get In Touch
          </Button>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-12 px-4 border-t border-gray-200">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-500">
            © 2024 {portfolioData.title}. Built with AI Portfolio Explorer.
          </p>
        </div>
      </footer>
    </div>
  );
}
