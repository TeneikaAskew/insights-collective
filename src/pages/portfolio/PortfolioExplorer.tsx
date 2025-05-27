
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Github, Globe, Star } from 'lucide-react';

const PortfolioExplorer = () => {
  const portfolios = [
    {
      id: 1,
      name: "Sarah Chen",
      title: "Data Scientist",
      description: "Machine learning engineer with focus on NLP and computer vision projects",
      image: "https://images.unsplash.com/photo-1494790108755-2616b612b402?w=200&h=200&fit=crop&crop=face",
      projects: 12,
      stars: 156,
      skills: ["Python", "TensorFlow", "AWS", "Docker"],
      featured: true
    },
    {
      id: 2,
      name: "Marcus Johnson",
      title: "Data Engineer",
      description: "Building scalable data pipelines and infrastructure for analytics teams",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
      projects: 8,
      stars: 89,
      skills: ["Python", "Apache Spark", "Kafka", "Kubernetes"],
      featured: false
    },
    {
      id: 3,
      name: "Emily Rodriguez",
      title: "Analytics Consultant",
      description: "Helping businesses make data-driven decisions through visualization and analysis",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face",
      projects: 15,
      stars: 203,
      skills: ["R", "Tableau", "SQL", "Power BI"],
      featured: true
    }
  ];

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Portfolio Explorer</h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Discover inspiring portfolios from data professionals and get ideas for your own projects.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {portfolios.map((portfolio) => (
            <Card key={portfolio.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <img 
                    src={portfolio.image} 
                    alt={portfolio.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <CardTitle className="text-lg">{portfolio.name}</CardTitle>
                    <CardDescription>{portfolio.title}</CardDescription>
                  </div>
                  {portfolio.featured && (
                    <Badge variant="secondary">Featured</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {portfolio.description}
                </p>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Globe className="h-4 w-4" />
                    <span>{portfolio.projects} projects</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4" />
                    <span>{portfolio.stars} stars</span>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2 text-sm">Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {portfolio.skills.map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Portfolio
                  </Button>
                  <Button size="sm" variant="outline">
                    <Github className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle>Create Your Own Portfolio</CardTitle>
            <CardDescription>
              Showcase your data science projects and skills to potential employers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Build a professional portfolio that highlights your best work and demonstrates your capabilities in data science.
            </p>
            <Button>
              Start Building
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default PortfolioExplorer;
