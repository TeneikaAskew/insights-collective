
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';

export interface Skill {
  name: string;
  type: 'hard' | 'soft';
  course: string;
}

export interface SkillsSectionProps {
  skills: Skill[];
}

const SkillsSection: React.FC<SkillsSectionProps> = ({
  skills
}) => {
  // Default skills if none provided
  const displaySkills = skills && skills.length > 0 ? skills : [{
    name: "No skills available",
    type: "hard" as const,
    course: "Complete your career assessment to see recommended skills."
  }];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Key Skills to Develop</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displaySkills.map((skill, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className={`p-2 rounded-full ${skill.type === 'hard' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                {skill.type === 'hard' ? '💻' : '🗣️'}
              </div>
              <div>
                <div className="font-medium">{skill.name}</div>
                <div className="text-sm text-gray-600">{skill.course}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SkillsSection;
