import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
interface CareerHeaderProps {
  name: string;
  summary: string;
}
const CareerHeader: React.FC<CareerHeaderProps> = ({
  name,
  summary
}) => {
  return <motion.div initial={{
    opacity: 0,
    y: -20
  }} animate={{
    opacity: 1,
    y: 0
  }} transition={{
    duration: 0.5
  }}>
      
    </motion.div>;
};
export default CareerHeader;