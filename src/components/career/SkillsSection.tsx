
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
        <CardTitle className="text-xl flex items-center gap-2">
          Recommended Skills
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displaySkills.map((skill, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="border-b pb-3 last:border-b-0"
            >
              <h3 className="font-medium text-lg">{skill.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  skill.type === 'hard' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                }`}>
                  {skill.type.charAt(0).toUpperCase() + skill.type.slice(1)}
                </span>
              </div>
              <p className="text-muted-foreground mt-2 text-sm">{skill.course}</p>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SkillsSection;
