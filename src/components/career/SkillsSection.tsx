
import React, { FC } from 'react';
import { Progress } from '@/components/ui/progress';

interface SkillsSectionProps {
  skills: {
    name: string;
    level: number;
    category: string;
  }[];
}

const SkillsSection: FC<SkillsSectionProps> = ({ skills }) => {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Key Skills</h2>
      <div className="space-y-6">
        {skills.map((skill, index) => (
          <div key={index}>
            <div className="flex justify-between mb-2">
              <span className="font-medium">{skill.name}</span>
              <span className="text-muted-foreground">{skill.level}%</span>
            </div>
            <Progress value={skill.level} className="h-2" />
            <div className="mt-1 text-xs text-muted-foreground">{skill.category}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkillsSection;
