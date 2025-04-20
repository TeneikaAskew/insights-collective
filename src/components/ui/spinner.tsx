
// Fix import to use correct icon from lucide-react
import React from 'react';
import { Loader } from 'lucide-react';

const Spinner = ({ className }: { className?: string }) => {
  return (
    <Loader className={`animate-spin text-primary ${className || ''}`} aria-label="Loading" />
  );
};

export { Spinner };
