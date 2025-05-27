
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen, Briefcase, Star } from 'lucide-react';

const CareerPathway = () => {
  const pathways = [
    {
      id: 1,
      title: "Data Scientist",
      description: "Analyze complex data to help organizations make informed decisions",
      duration: "6-12 months",
      difficulty: "Intermediate",
      skills: ["Python", "Statistics", "Machine Learning", "SQL"],
      icon: <Star className="h-6 w-6" />
    },
    {
      id: 2,
      title: "Data Engineer",
      description: "Build and maintain the infrastructure for data generation and processing",
      duration: "4-8 months",
      difficulty: "Advanced",
      skills: ["Python", "SQL", "Cloud Platforms", "ETL"],
      icon: <Briefcase className="h-6 w-6" />
    },
    {
      id: 3,
      title: "Data Analyst",
      description: "Transform raw data into actionable insights for business decisions",
      duration: "3-6 months",
      difficulty: "Beginner",
      skills: ["SQL", "Excel", "Tableau", "Statistics"],
      icon: <BookOpen className="h-6 w-6" />
    }
  ];

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Career Pathways</h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Explore structured learning paths designed to help you achieve your career goals in data and technology.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {pathways.map((pathway) => (
            <Card key={pathway.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {pathway.icon}
                  </div>
                  <div>
                    <CardTitle className="text-xl">{pathway.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {pathway.duration} • {pathway.difficulty}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  {pathway.description}
                </p>
                
                <div>
                  <h4 className="font-medium mb-2">Key Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {pathway.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-xs"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
                
                <Button className="w-full group">
                  Start Pathway
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default CareerPathway;
