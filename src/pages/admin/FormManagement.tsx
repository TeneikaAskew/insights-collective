
import React from 'react';
import { Navigate } from 'react-router-dom';

// This file is deprecated, we're using UnifiedFormManagement.tsx instead
export default function FormManagement() {
  return <Navigate to="/admin/forms" replace />;
}
