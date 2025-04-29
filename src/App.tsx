
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import { Toaster } from './components/ui/toaster';
import AdminForms from './pages/AdminForms';
import AdminDashboard from './pages/AdminDashboard';
import SurveyFormEdit from './pages/survey/SurveyFormEdit';
import SurveyConfirmation from './pages/SurveyConfirmation';

// Import the new FormManagement page
import FormManagement from './pages/admin/FormManagement';

function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <Toaster />
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/admin/forms" element={<FormManagement />} />
        <Route path="/admin/forms/legacy" element={<AdminForms />} />
        <Route path="/survey/:slug/edit" element={<SurveyFormEdit />} />
        <Route path="/survey/:slug/confirmation" element={<SurveyConfirmation />} />
      </Routes>
    </div>
  );
}

export default App;
