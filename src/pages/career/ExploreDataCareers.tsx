
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, MapPin, Clock } from 'lucide-react';

const ExploreDataCareers = () => {
  const careers = [
    {
      id: 1,
      title: "Data Scientist",
      company: "Tech Corp",
      location: "San Francisco, CA",
      salary: "$120k - $180k",
      experience: "2-5 years",
      description: "Analyze complex datasets to extract insights and build predictive models.",
      skills: ["Python", "Machine Learning", "Statistics", "SQL"],
      growth: "+22% growth",
      remote: true
    },
    {
      id: 2,
      title: "Data Engineer",
      company: "DataFlow Inc",
      location: "New York, NY",
      salary: "$130k - $200k",
      experience: "3-6 years",
      description: "Design and maintain data pipelines and infrastructure.",
      skills: ["Python", "Apache Spark", "Cloud Computing", "ETL"],
      growth: "+35% growth",
      remote: false
    },
    {
      id: 3,
      title: "Business Intelligence Analyst",
      company: "Analytics Pro",
      location: "Austin, TX",
      salary: "$80k - $120k",
      experience: "1-3 years",
      description: "Create dashboards and reports to support business decisions.",
      skills: ["Tableau", "SQL", "Power BI", "Excel"],
      growth: "+18% growth",
      remote: true
    }
  ];

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Explore Data Careers</h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Discover exciting opportunities in the data field and understand what it takes to succeed.
          </p>
        </div>

        <div className="grid gap-6">
          {careers.map((career) => (
            <Card key={career.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{career.title}</CardTitle>
                    <CardDescription className="text-base font-medium text-primary">
                      {career.company}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-green-600 mb-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm font-medium">{career.growth}</span>
                    </div>
                    {career.remote && (
                      <Badge variant="secondary">Remote OK</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  {career.description}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>{career.salary}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{career.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{career.experience}</span>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Required Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {career.skills.map((skill) => (
                      <Badge key={skill} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button className="flex-1">
                    View Details
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Save Job
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default ExploreDataCareers;
