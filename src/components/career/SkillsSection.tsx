
import React, { FC } from 'react';
import { Button } from '@/components/ui/button';

interface SkillsSectionProps {
  skills: {
    name: string;
    level: number;
    category: string;
    type?: string;
    course?: string;
  }[];
}

const SkillsSection: FC<SkillsSectionProps> = ({ skills = [] }) => {
  // Provide a default empty array if skills is undefined
  const safeSkills = skills || [];
  
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Skills to Develop</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {safeSkills.map((skill, index) => (
          <div key={index} className="bg-card rounded-lg p-6 shadow-sm border">
            <h3 className="text-lg font-semibold mb-2">{skill.name}</h3>
            <div className="mb-4">
              <span className={`inline-block ${skill.type === 'soft' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'} text-sm font-medium rounded-full px-3 py-1`}>
                {skill.category}
              </span>
            </div>
            <div className="relative pt-1 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block text-primary">
                    Proficiency
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold inline-block text-primary">
                    {skill.level}%
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-2 text-xs flex rounded bg-primary/10">
                <div style={{ width: `${skill.level}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary"></div>
              </div>
            </div>
            {skill.course && (
              <p className="text-sm text-muted-foreground mb-4">
                <span className="font-medium">Recommended course:</span> {skill.course}
              </p>
            )}
            <Button variant="outline" className="w-full">Learn More</Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkillsSection;
