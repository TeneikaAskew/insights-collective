
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Download, ExternalLink } from 'lucide-react';

const DataBlueprint = () => {
  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Data Blueprint Series</h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Comprehensive guides and blueprints for building your data career and skills.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Data Science Blueprint
              </CardTitle>
              <CardDescription>
                Complete roadmap for becoming a data scientist
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Step-by-step guide covering everything from basic statistics to advanced machine learning.
              </p>
              <Button className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download Blueprint
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Analytics Blueprint
              </CardTitle>
              <CardDescription>
                Path to becoming a data analyst
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Learn data visualization, SQL, and business intelligence tools.
              </p>
              <Button className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download Blueprint
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Engineering Blueprint
              </CardTitle>
              <CardDescription>
                Become a data engineer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Master data pipelines, cloud platforms, and big data technologies.
              </p>
              <Button className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download Blueprint
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>More blueprints are being developed</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              We're working on additional blueprints for AI/ML engineering, business intelligence, and more specialized roles.
            </p>
            <Button variant="outline" asChild>
              <a href="/resources">
                <ExternalLink className="h-4 w-4 mr-2" />
                Explore Resources
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default DataBlueprint;
