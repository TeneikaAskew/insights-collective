
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/toaster';
import AdminDashboard from './pages/AdminDashboard';
import SurveyFormEdit from './pages/survey/SurveyFormEdit';
import SurveyConfirmation from './pages/SurveyConfirmation';
import UnifiedFormManagement from './pages/admin/UnifiedFormManagement';
import { useAuth } from './contexts/AuthContext';
import Index from './pages/Index';

function App() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col min-h-screen">
      <Toaster />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/forms" element={<UnifiedFormManagement />} />
        <Route path="/survey/:slug/edit" element={<SurveyFormEdit />} />
        <Route path="/survey/:slug/confirmation" element={<SurveyConfirmation />} />
        <Route path="/survey/:slug" element={<SurveyFormEdit />} />
        
        {/* Handle login route that's causing errors in console logs */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
