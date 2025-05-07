
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

const CareerPathSection: React.FC<CareerPathProps> = ({ roles }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Default roles if none provided
  const displayRoles = roles && roles.length > 0 ? roles : [
    {
      title: "No roles available",
      salary: "N/A",
      description: "Complete your career assessment to see recommended roles."
    }
  ];

  const nextRole = () => {
    setCurrentIndex((prev) => (prev + 1) % displayRoles.length);
  };

  const prevRole = () => {
    setCurrentIndex((prev) => (prev - 1 + displayRoles.length) % displayRoles.length);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Path to your aspirational role</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          A clear path to your dream role—with a simple, step-by-step plan to bring you closer to your
          ultimate professional future.
        </p>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="overflow-hidden">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <h3 className="font-medium">{displayRoles[currentIndex].title}</h3>
                  <p className="text-sm text-muted-foreground">{displayRoles[currentIndex].salary}</p>
                </div>
                <p className="text-sm max-w-md">{displayRoles[currentIndex].description}</p>
              </div>
            </motion.div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="icon"
              onClick={prevRole}
              disabled={displayRoles.length <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={nextRole}
              disabled={displayRoles.length <= 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CareerPathSection;
