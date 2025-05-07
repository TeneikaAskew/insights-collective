
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

const SkillsSection: React.FC<SkillsSectionProps> = ({ skills }) => {
  // Default skills if none provided
  const displaySkills = skills && skills.length > 0 ? skills : [
    {
      name: "No skills available",
      type: "hard" as const,
      course: "Complete your career assessment to see recommended skills."
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Recommended skills</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          These recommendations are based on current market trends, your existing skill set, and the
          requirements of your desired roles or alternative options.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {displaySkills.map((skill, index) => (
            <motion.div
              key={`${skill.name}-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded">
                  📄
                </div>
                <div>
                  <h3 className="font-medium">{skill.name}</h3>
                  <span className="text-xs text-muted-foreground">{skill.type}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{skill.course}</p>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SkillsSection;
