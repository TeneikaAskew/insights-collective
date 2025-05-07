
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
        <CardTitle className="text-xl flex items-center gap-2">
          Career Path Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <h3 className="text-xl font-bold">{displayRoles[currentIndex].title}</h3>
          <p className="text-primary font-semibold">{displayRoles[currentIndex].salary}</p>
          <p className="text-muted-foreground">{displayRoles[currentIndex].description}</p>
        </motion.div>

        {displayRoles.length > 1 && (
          <div className="flex justify-between mt-6">
            <Button variant="outline" size="sm" onClick={prevRole}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <Button variant="outline" size="sm" onClick={nextRole}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CareerPathSection;
