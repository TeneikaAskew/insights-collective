
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Clock, Users, ArrowRight } from 'lucide-react';

const DataBlueprint = () => {
  const blueprints = [
    {
      id: 1,
      title: "Data Science Fundamentals",
      description: "Master the core concepts and tools essential for any data science role",
      duration: "8 weeks",
      difficulty: "Beginner",
      modules: 12,
      students: 1250,
      topics: ["Statistics", "Python", "Data Visualization", "SQL"],
      featured: true
    },
    {
      id: 2,
      title: "Machine Learning Engineer Path",
      description: "Build production-ready ML systems and deploy models at scale",
      duration: "12 weeks",
      difficulty: "Intermediate",
      modules: 16,
      students: 890,
      topics: ["MLOps", "Model Deployment", "Cloud Platforms", "Docker"],
      featured: false
    },
    {
      id: 3,
      title: "Data Engineer Bootcamp",
      description: "Design and build robust data infrastructure and pipelines",
      duration: "10 weeks",
      difficulty: "Advanced",
      modules: 14,
      students: 670,
      topics: ["Apache Spark", "Data Warehousing", "ETL", "Stream Processing"],
      featured: true
    }
  ];

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Data Blueprint</h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Structured learning paths designed to take you from beginner to professional in data science and engineering.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-1 xl:grid-cols-2">
          {blueprints.map((blueprint) => (
            <Card key={blueprint.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{blueprint.title}</CardTitle>
                    <CardDescription className="mt-2">
                      {blueprint.description}
                    </CardDescription>
                  </div>
                  {blueprint.featured && (
                    <Badge variant="secondary">Featured</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{blueprint.duration}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span>{blueprint.modules} modules</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{blueprint.students} students</span>
                  </div>
                  <div>
                    <Badge variant="outline" className="text-xs">
                      {blueprint.difficulty}
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">What You'll Learn</h4>
                  <div className="flex flex-wrap gap-2">
                    {blueprint.topics.map((topic) => (
                      <Badge key={topic} variant="secondary" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <Button className="w-full group">
                  Start Blueprint
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle>Why Choose Data Blueprint?</CardTitle>
            <CardDescription>
              Our structured approach to learning data science
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <h4 className="font-medium">Structured Learning</h4>
                <p className="text-sm text-muted-foreground">
                  Follow a proven curriculum designed by industry experts.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Hands-on Projects</h4>
                <p className="text-sm text-muted-foreground">
                  Build real-world projects that showcase your skills.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Career Support</h4>
                <p className="text-sm text-muted-foreground">
                  Get guidance on landing your first data science role.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default DataBlueprint;
