
import React from 'react';
import { motion } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import CareerHeader from '@/components/career/CareerHeader';
import SkillsSection from '@/components/career/SkillsSection';
import CareerPathSection from '@/components/career/CareerPathSection';

const CareerPathway: React.FC = () => {
  // Example data - in a real app, this would come from your career report
  const mockSkills = [
    {
      name: "Data Analytics",
      type: "hard" as const,
      course: "Data Science Specialization by Johns Hopkins University (Coursera)"
    },
    {
      name: "Strategic Management",
      type: "hard" as const,
      course: "Strategic Management and Innovation by Copenhagen Business School (Coursera)"
    },
    {
      name: "Advanced Leadership",
      type: "soft" as const,
      course: "Organizational Leadership Specialization by Northwestern University (Coursera)"
    }
  ];

  const mockRoles = [
    {
      title: "Data Analyst",
      salary: "$80-100K",
      description: "Entry-level role focusing on data analysis and visualization"
    },
    {
      title: "Senior Data Analyst",
      salary: "$90-115K",
      description: "Lead complex data projects with strategic impact"
    },
    {
      title: "Analytics Manager",
      salary: "$100-130K",
      description: "Manage analytics teams and drive data strategies"
    }
  ];

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6 px-4">
        <CareerHeader 
          name="there"
          summary="Your journey to success starts here"
        />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <SkillsSection skills={mockSkills} />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <CareerPathSection roles={mockRoles} />
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CareerPathway;
