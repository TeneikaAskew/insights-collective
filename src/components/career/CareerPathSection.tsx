
import React, { FC } from 'react';
import { Button } from '@/components/ui/button';

interface CareerPathProps {
  roles: {
    title: string;
    description: string;
    requirements: string[];
    level: string;
  }[];
}

const CareerPathSection: FC<CareerPathProps> = ({ roles }) => {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Career Path</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((role, index) => (
          <div key={index} className="bg-card rounded-lg p-6 shadow-sm border">
            <h3 className="text-lg font-semibold mb-2">{role.title}</h3>
            <p className="text-muted-foreground mb-4">{role.description}</p>
            <div className="mb-4">
              <span className="inline-block bg-primary/10 text-primary text-sm font-medium rounded-full px-3 py-1">
                {role.level}
              </span>
            </div>
            <div className="space-y-2 mb-4">
              <p className="font-medium">Requirements:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {role.requirements.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>
            <Button variant="outline" className="w-full">View Details</Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CareerPathSection;
