
import React from 'react';
import { LoaderSpin } from 'lucide-react';

const Spinner = ({ className }: { className?: string }) => {
  return (
    <LoaderSpin className={`animate-spin text-primary ${className}`} aria-label="Loading" />
  );
};

export { Spinner };
