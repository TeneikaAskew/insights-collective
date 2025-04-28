
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from './components/ui/toaster';
import AdminDashboard from './pages/AdminDashboard';
import SurveyFormEdit from './pages/survey/SurveyFormEdit';
import SurveyConfirmation from './pages/SurveyConfirmation';
import UnifiedFormManagement from './pages/admin/UnifiedFormManagement';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col min-h-screen">
      <Toaster />
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/admin/forms" element={<UnifiedFormManagement />} />
        {/* Redirect legacy routes to the new unified form management */}
        <Route path="/admin/forms/legacy" element={<UnifiedFormManagement legacyView={true} />} />
        <Route path="/admin/forms/old" element={<UnifiedFormManagement />} />
        <Route path="/survey/:slug/edit" element={<SurveyFormEdit />} />
        <Route path="/survey/:slug/confirmation" element={<SurveyConfirmation />} />
        <Route path="/survey/:slug" element={<SurveyFormEdit />} />
      </Routes>
    </div>
  );
}

export default App;
