
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { X, Clock, Calendar, Users, ArrowRight } from 'lucide-react';
import { DataCareerRole } from '@/data/dataCareerRoles';
import { Link } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CareerRoleDetailsProps {
  role: DataCareerRole;
  onClose: () => void;
}

export const CareerRoleDetails: React.FC<CareerRoleDetailsProps> = ({ role, onClose }) => {
  return (
    <Card className="shadow-lg animate-fade-in border-t-4 border-t-primary">
      <CardHeader className="relative pb-0">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline">{role.category}</Badge>
            </div>
            <CardTitle className="text-2xl font-bold mb-1">{role.title}</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-4 right-4">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="day-life">Day in the Life</TabsTrigger>
            <TabsTrigger value="month-life">Month in the Life</TabsTrigger>
            <TabsTrigger value="career-path">Career Path</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">Role Description</h3>
              <p className="text-muted-foreground">{role.longDescription}</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 mt-4">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">Key Responsibilities</h3>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    {role.responsibilities.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-lg mb-2">Who You Work With</h3>
                  <div className="flex flex-wrap gap-2">
                    {role.collaborators.map((collaborator, index) => (
                      <Badge key={index} variant="secondary">{collaborator}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">Tools & Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {role.tools.map((tool, index) => (
                      <Badge key={index} variant="outline">{tool}</Badge>
                    ))}
                  </div>
                </div>
                
                {role.skills && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Key Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {role.skills.map((skill, index) => (
                        <Badge key={index} variant="outline" className="bg-primary/10">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="day-life">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">A Day in the Life</h3>
              </div>
              <p className="text-muted-foreground mb-4">{role.dayInLife}</p>
              
              {role.schedule && (
                <div className="space-y-3 mt-6">
                  <h4 className="font-medium">Typical Day Schedule</h4>
                  {role.schedule.map((item, index) => (
                    <div key={index} className="flex gap-3 border-l-2 border-primary/30 pl-4 py-1">
                      <div className="font-medium w-24">{item.time}</div>
                      <div className="flex-1">{item.activity}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="month-life">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">A Month in the Life</h3>
              </div>
              <p className="text-muted-foreground">{role.monthInLife}</p>
              
              {role.projectTimeline && (
                <div className="space-y-4 mt-6">
                  <h4 className="font-medium">Sample Project Timeline</h4>
                  <div className="space-y-4">
                    {role.projectTimeline.map((phase, index) => (
                      <Collapsible key={index}>
                        <div className="flex items-center gap-2 rounded-md border p-3 cursor-pointer">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <CollapsibleTrigger className="w-full text-left">
                              <div className="flex justify-between items-center">
                                <h5 className="font-medium">{phase.title}</h5>
                                <Badge variant="outline">{phase.duration}</Badge>
                              </div>
                            </CollapsibleTrigger>
                          </div>
                        </div>
                        <CollapsibleContent className="pl-12 pr-4 pb-3">
                          <p className="text-muted-foreground">{phase.description}</p>
                          {phase.activities && (
                            <ul className="list-disc pl-5 mt-2 text-sm text-muted-foreground">
                              {phase.activities.map((activity, idx) => (
                                <li key={idx}>{activity}</li>
                              ))}
                            </ul>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="career-path">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Career Progression</h3>
              </div>
              
              <p className="text-muted-foreground">{role.careerPath?.description || ''}</p>
              
              {role.careerPath?.progressionSteps && (
                <div className="space-y-4 mt-6">
                  <h4 className="font-medium">Typical Career Path</h4>
                  <div className="space-y-2">
                    {role.careerPath.progressionSteps.map((step, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="mt-1">
                          {index < role.careerPath!.progressionSteps.length - 1 ? (
                            <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                          ) : (
                            <div className="h-4 w-4"></div>
                          )}
                        </div>
                        <div className="border rounded-md p-3 flex-1">
                          <h5 className="font-medium">{step.title}</h5>
                          <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                          {step.timePeriod && (
                            <Badge variant="outline" className="mt-2">{step.timePeriod}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {role.courses && role.courses.length > 0 && (
                <div className="mt-8">
                  <h4 className="font-medium mb-3">Recommended Courses</h4>
                  <div className="grid gap-2">
                    {role.courses.map((course, index) => (
                      <Link 
                        key={index}
                        to={`/courses/${course.id}`}
                        className="block p-3 border rounded-md hover:bg-primary/5 transition-colors"
                      >
                        <div className="font-medium">{course.title}</div>
                        <div className="text-sm text-muted-foreground">{course.description}</div>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Button asChild variant="outline">
                      <Link to="/courses">Browse All Courses</Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
