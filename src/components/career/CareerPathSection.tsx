
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

export interface Role {
  title: string;
  salary: string;
  description: string;
}

export interface CareerPathProps {
  roles: Role[];
}

const CareerPathSection: React.FC<CareerPathProps> = ({
  roles
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Default roles if none provided
  const displayRoles = roles && roles.length > 0 ? roles : [{
    title: "No roles available",
    salary: "N/A",
    description: "Complete your career assessment to see recommended roles."
  }];

  const nextRole = () => {
    setCurrentIndex(prev => (prev + 1) % displayRoles.length);
  };

  const prevRole = () => {
    setCurrentIndex(prev => (prev - 1 + displayRoles.length) % displayRoles.length);
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChevronRight className="h-5 w-5 text-primary" />
          Career Path Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {displayRoles.map((role, index) => (
            <div
              key={index}
              className={`transition-opacity duration-300 ${
                index === currentIndex ? 'opacity-100' : 'opacity-0 absolute top-0 left-0 right-0'
              }`}
              style={{ display: index === currentIndex ? 'block' : 'none' }}
            >
              <h3 className="text-xl font-bold mb-1">{role.title}</h3>
              <p className="text-primary font-medium mb-2">{role.salary}</p>
              <p className="text-gray-600 mb-4">{role.description}</p>
            </div>
          ))}
          
          {displayRoles.length > 1 && (
            <div className="flex justify-between mt-4">
              <Button variant="outline" size="sm" onClick={prevRole}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={nextRole}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CareerPathSection;
