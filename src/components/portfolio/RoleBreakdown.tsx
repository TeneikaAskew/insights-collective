
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TargetRole } from '@/hooks/usePortfolioExplorer';

interface RoleBreakdownProps {
  roles: TargetRole[];
  onContinue: () => void;
}

const RoleBreakdown: React.FC<RoleBreakdownProps> = ({ roles, onContinue }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-semibold mb-4">Recommended Career Paths</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Based on your profile, interests, and existing skills, we've identified the following career paths
          that would be a good fit for you. Explore each one to see skills, common deliverables, and example portfolio pieces.
        </p>
      </div>
      
      <Tabs defaultValue={roles[0]?.title.replace(/\s+/g, '-').toLowerCase()} className="space-y-6">
        <TabsList>
          {roles.map((role) => (
            <TabsTrigger
              key={role.title}
              value={role.title.replace(/\s+/g, '-').toLowerCase()}
            >
              {role.title}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {roles.map((role) => (
          <TabsContent 
            key={role.title} 
            value={role.title.replace(/\s+/g, '-').toLowerCase()}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Core Skills</CardTitle>
                  <CardDescription>Technical skills needed for this role</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {role.coreSkills.map((skill) => (
                      <Badge key={skill} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Tools & Technologies</CardTitle>
                  <CardDescription>Common software and platforms used</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {role.tools.map((tool) => (
                      <Badge key={tool} variant="outline">{tool}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Common Deliverables</CardTitle>
                <CardDescription>Work products typically created in this role</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2">
                  {role.deliverables.map((deliverable, index) => (
                    <li key={index}>{deliverable}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            
            <div>
              <h3 className="text-xl font-semibold mb-4">Example Portfolio Pieces</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {role.portfolioExamples.map((example, index) => (
                  <Card key={index} className="h-full flex flex-col">
                    <CardHeader>
                      <CardTitle className="text-lg">{example.title}</CardTitle>
                      <Badge className="w-fit">{example.type}</Badge>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {example.description}
                      </p>
                    </CardContent>
                    {example.link && (
                      <CardFooter>
                        <a 
                          href={example.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          View Example
                        </a>
                      </CardFooter>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
      
      <div className="flex justify-end pt-4">
        <Button onClick={onContinue} size="lg">
          Continue to Portfolio Planner
        </Button>
      </div>
    </div>
  );
};

export default RoleBreakdown;
