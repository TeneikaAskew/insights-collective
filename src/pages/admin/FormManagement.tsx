
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function FormManagement() {
  const location = useLocation();
  const pathSegments = location.pathname.split('/');
  
  // Check if we're trying to access form submissions
  if (pathSegments.length > 3 && pathSegments[3] === 'submissions') {
    const formSlug = pathSegments[2];
    // Redirect to the unified form management submissions page
    return <Navigate to={`/admin/forms/submissions/${formSlug}`} replace />;
  }
  
  // Default redirect to the main forms management page
  return <Navigate to="/admin/forms" replace />;
}
