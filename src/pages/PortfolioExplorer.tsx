
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UserProfileForm from '@/components/portfolio/UserProfileForm';
import RoleBreakdown from '@/components/portfolio/RoleBreakdown';
import PortfolioPlanner from '@/components/portfolio/PortfolioPlanner';
import SkillGapAnalysis from '@/components/portfolio/SkillGapAnalysis';
import { usePortfolioExplorer } from '@/hooks/usePortfolioExplorer';

const PortfolioExplorer = () => {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const { 
    loading, 
    userProfile, 
    targetRoles, 
    projectIdeas,
    userProjects,
    handleProfileSubmit,
    handleAddProject,
    handleUpdateProjectStatus
  } = usePortfolioExplorer();

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Portfolio Explorer</h1>
          <p>Please sign in to use the Portfolio Explorer.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Portfolio Explorer</h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="profile">1. Your Profile</TabsTrigger>
            <TabsTrigger value="roles" disabled={!targetRoles.length}>2. Role Breakdown</TabsTrigger>
            <TabsTrigger value="planner" disabled={!targetRoles.length}>3. Portfolio Planner</TabsTrigger>
            <TabsTrigger value="skills" disabled={!userProjects.length}>4. Skill Gap Analysis</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-2xl font-semibold mb-4">Discover Your Path</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Let's explore portfolio project ideas based on your background, interests, and career goals.
              </p>
              <UserProfileForm onSubmit={handleProfileSubmit} isLoading={loading} />
            </div>
          </TabsContent>
          
          <TabsContent value="roles">
            <RoleBreakdown 
              roles={targetRoles} 
              onContinue={() => setActiveTab('planner')}
            />
          </TabsContent>
          
          <TabsContent value="planner">
            <PortfolioPlanner 
              projectIdeas={projectIdeas}
              userProjects={userProjects}
              onAddProject={handleAddProject}
              onUpdateStatus={handleUpdateProjectStatus}
            />
          </TabsContent>
          
          <TabsContent value="skills">
            <SkillGapAnalysis 
              userProfile={userProfile}
              projects={userProjects}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default PortfolioExplorer;
