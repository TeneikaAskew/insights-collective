import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { SkillGap } from '@/types/portfolio';
import { ExternalLink } from 'lucide-react';
import { useSkillCourses } from '@/hooks/useSkillCourses';
import { CourseraCourseRow } from '@/components/learning/CourseraCourseRow';

interface SkillGapChartProps {
  userSkills: string[];
  missingSkills: string[];
  learningResources: SkillGap[];
}

export function SkillGapChart({ userSkills, missingSkills, learningResources }: SkillGapChartProps) {
  // Calculate a simple skill completion percentage
  const totalSkills = [...new Set([...userSkills, ...missingSkills])].length;
  const userSkillsCount = userSkills.length;
  const completionPercentage = Math.round((userSkillsCount / totalSkills) * 100) || 0;

  // Real catalog courses for each missing skill. Skills the catalog has
  // nothing for simply don't get a block — the browse-all button below is
  // the fallback for those.
  const { coursesBySkill } = useSkillCourses(missingSkills);
  const matchedSkills = missingSkills.filter((skill) => (coursesBySkill.get(skill) ?? []).length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Skill Gap Analysis</CardTitle>
        <CardDescription>
          A comparison of your current skills against what's needed for your target roles
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Overall progress */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium">Skill Coverage</h4>
              <span className="text-sm text-muted-foreground">{completionPercentage}%</span>
            </div>
            <Progress value={completionPercentage} className="h-2" />
          </div>

          <Separator />

          {/* Existing Skills */}
          <div>
            <h4 className="text-sm font-medium mb-3">Your Current Skills</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {userSkills.map((skill, idx) => (
                <Badge key={idx} className="bg-ss-good-chip text-ss-good hover:bg-ss-good-chip border-0">
                  {skill}
                </Badge>
              ))}
              {userSkills.length === 0 && (
                <span className="text-sm text-muted-foreground italic">No skills detected from your profile</span>
              )}
            </div>
          </div>

          <Separator />

          {/* Missing Skills */}
          <div>
            <h4 className="text-sm font-medium mb-3">Skills to Develop</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {missingSkills.map((skill, idx) => (
                <Badge key={idx} variant="outline" className="border-ss-bad text-ss-bad">
                  {skill}
                </Badge>
              ))}
              {missingSkills.length === 0 && (
                <span className="text-sm text-muted-foreground italic">Great job! You have all the required skills.</span>
              )}
            </div>
          </div>

          {learningResources?.length > 0 && (
            <>
              <Separator />
              
              {/* Learning resources */}
              <div>
                <h4 className="text-sm font-medium mb-3">Recommended Learning Resources</h4>
                <div className="space-y-4">
                  {learningResources.map((item, idx) => (
                    <div key={idx} className="border rounded-lg p-3">
                      <h5 className="font-medium text-sm mb-2">{item.skill}</h5>
                      <ul className="space-y-2">
                        {item.resources.map((resource, i) => (
                          <li key={i} className="text-sm flex items-start">
                            <div className="mr-2 mt-0.5 text-ss-teal">•</div>
                            <span>{resource}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          
          {matchedSkills.length > 0 && (
            <>
              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-1">
                  From Coursera <span className="font-normal text-muted-foreground">· external</span>
                </h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Well-reviewed courses matched to the skills you're missing.
                </p>
                <div className="space-y-4">
                  {matchedSkills.map((skill) => (
                    <div key={skill}>
                      <h5 className="text-sm font-medium mb-1.5">{skill}</h5>
                      <div className="space-y-1.5">
                        {coursesBySkill.get(skill)!.map((course) => (
                          <CourseraCourseRow key={course.id} course={course} variant="compact" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Generic browse link only when nothing above matched — matched
              skills already link to specific courses. */}
          {matchedSkills.length === 0 && missingSkills.length > 0 && (
            <Button variant="outline" className="w-full mt-4" asChild>
              <a href="https://www.coursera.org/browse/data-science" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Explore More Learning Resources
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
