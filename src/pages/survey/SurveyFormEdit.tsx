
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import FormEditor from '@/components/survey/FormEditor';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function SurveyFormEdit() {
  const { user, isAdmin } = useAuth();

  // Only allow admin users to access this page
  if (!user || !isAdmin) {
    return <Navigate to="/" />;
  }

  return (
    <AppLayout>
      <FormEditor />
    </AppLayout>
  );
}
