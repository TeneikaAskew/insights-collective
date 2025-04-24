
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { motion } from 'framer-motion';

interface CareerHeaderProps {
  name: string;
  summary: string;
}

const CareerHeader: React.FC<CareerHeaderProps> = ({ name, summary }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardContent className="py-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <Avatar className="h-20 w-20" />
            <h1 className="text-2xl font-bold">Hey {name}, here are your career insights</h1>
            <p className="text-muted-foreground max-w-2xl">
              Begin a journey of self-discovery to align your professional goals with your personal strengths and interests.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default CareerHeader;
