
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { UserProfile, UserProject } from '@/hooks/usePortfolioExplorer';

interface SkillGapAnalysisProps {
  userProfile: UserProfile;
  projects: UserProject[];
}

interface SkillAnalysis {
  name: string;
  userStrength: number; // 0-100
  projectRequirement: number; // 0-100
  gap: number; // Positive = missing skills, Negative = user has more skills than required
}

const SkillGapAnalysis: React.FC<SkillGapAnalysisProps> = ({ userProfile, projects }) => {
  // Extract all unique skills from user profile and projects
  const userSkills = userProfile.skills || [];
  
  // Combine all required skills from projects
  const allProjectSkills = projects.reduce((acc, project) => {
    project.requiredSkills.forEach(skill => {
      if (!acc.includes(skill)) {
        acc.push(skill);
      }
    });
    return acc;
  }, [] as string[]);
  
  // Combine all unique skills
  const allSkills = [...new Set([...userSkills, ...allProjectSkills])];
  
  // Create skill analysis
  const skillAnalysis: SkillAnalysis[] = allSkills.map(skill => {
    // Check if the user has this skill
    const userHasSkill = userSkills.includes(skill);
    
    // Count how many projects require this skill
    const projectsWithSkill = projects.filter(
      project => project.requiredSkills.includes(skill)
    ).length;
    
    // Calculate requirements score based on percentage of projects requiring this skill
    const projectRequirement = projects.length > 0 
      ? (projectsWithSkill / projects.length) * 100 
      : 0;
    
    // Simple gap analysis: if user has skill = 100, otherwise 0
    const userStrength = userHasSkill ? 100 : 0;
    
    return {
      name: skill,
      userStrength,
      projectRequirement,
      gap: projectRequirement - userStrength
    };
  });
  
  // Sort skills by gap (highest gap first)
  const sortedSkillAnalysis = [...skillAnalysis].sort((a, b) => b.gap - a.gap);
  
  // Group skills into categories
  const missingSkills = sortedSkillAnalysis.filter(skill => skill.gap > 0);
  const strongSkills = sortedSkillAnalysis.filter(skill => skill.gap <= 0);
  
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-semibold mb-4">Skill Gap Analysis</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          See how your current skills match up with your selected portfolio projects, and identify areas to focus on.
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Skills to develop */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Skills to Develop</CardTitle>
            <CardDescription>
              Skills required by your portfolio projects that you might need to improve
            </CardDescription>
          </CardHeader>
          <CardContent>
            {missingSkills.length > 0 ? (
              <div className="space-y-6">
                {missingSkills.map((skill) => (
                  <div key={skill.name} className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">{skill.name}</span>
                      <Badge variant="destructive">Gap</Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Your proficiency</span>
                        <span>{skill.userStrength}%</span>
                      </div>
                      <Progress value={skill.userStrength} className="h-2" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Project requirements</span>
                        <span>{Math.round(skill.projectRequirement)}%</span>
                      </div>
                      <Progress value={skill.projectRequirement} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                {projects.length === 0 ? (
                  <p>Add some projects to see skill requirements</p>
                ) : (
                  <p>Great! You have all the skills needed for your projects</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Strong skills */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Your Strong Skills</CardTitle>
            <CardDescription>
              Skills you already have that align with your portfolio projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            {strongSkills.length > 0 ? (
              <div className="space-y-6">
                {strongSkills.map((skill) => (
                  <div key={skill.name} className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">{skill.name}</span>
                      <Badge variant="success" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                        Strong
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Your proficiency</span>
                        <span>{skill.userStrength}%</span>
                      </div>
                      <Progress value={skill.userStrength} className="h-2" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Project requirements</span>
                        <span>{Math.round(skill.projectRequirement)}%</span>
                      </div>
                      <Progress value={skill.projectRequirement} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                {userSkills.length === 0 ? (
                  <p>Complete your profile to see your skills analysis</p>
                ) : projects.length === 0 ? (
                  <p>Add some projects to see skill alignment</p>
                ) : (
                  <p>No strong skills detected. Try updating your profile</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Recommended Learning Resources</CardTitle>
          <CardDescription>
            Resources to help you develop the skills you need for your portfolio projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          {missingSkills.length > 0 ? (
            <div className="space-y-4">
              {missingSkills.slice(0, 3).map((skill) => (
                <div key={skill.name} className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">{skill.name}</h4>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <a 
                        href={`https://www.coursera.org/search?query=${encodeURIComponent(skill.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center"
                      >
                        Coursera courses on {skill.name}
                      </a>
                    </li>
                    <li>
                      <a 
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(skill.name + " tutorial")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center"
                      >
                        YouTube tutorials
                      </a>
                    </li>
                    <li>
                      <a 
                        href={`https://github.com/search?q=${encodeURIComponent(skill.name + " project")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center"
                      >
                        Example projects on GitHub
                      </a>
                    </li>
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              <p>Add projects with skill requirements to see learning recommendations</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SkillGapAnalysis;
