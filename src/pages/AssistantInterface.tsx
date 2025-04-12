
import React, { useState, useEffect } from 'react';
import { useParams, Navigate, useLocation } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import LoginWall from '@/components/common/LoginWall';
import AssistantChatInterface from '@/components/assistants/AssistantChatInterface';
import { Assistant } from '@/types/assistants';
import { allAssistants, careerExplorerAssistant } from '@/data/assistantData';

const AssistantInterface = () => {
  const { assistantId } = useParams();
  const { isAuthenticated, storeRedirectPath } = useAuth();
  const location = useLocation();
  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(null);
  
  // Store the current path for redirect after login
  useEffect(() => {
    if (!isAuthenticated) {
      storeRedirectPath(location.pathname);
    }
  }, [isAuthenticated, location.pathname, storeRedirectPath]);
  
  // Get assistant from URL params
  useEffect(() => {
    if (assistantId) {
      // Find assistant by ID
      const assistant = [...allAssistants, careerExplorerAssistant].find(
        a => a.id === assistantId
      );
      if (assistant) {
        setSelectedAssistant(assistant);
      } else {
        // Default to career explorer if assistant not found
        setSelectedAssistant(careerExplorerAssistant);
      }
    } else {
      // Default to career explorer if no assistant specified
      setSelectedAssistant(careerExplorerAssistant);
    }
  }, [assistantId]);

  // If not authenticated, show login wall
  if (!isAuthenticated) {
    return (
      <LoginWall 
        message="Please log in to use our AI assistants" 
        visibleItems={0} 
        totalItems={allAssistants.length + 1} // +1 for career explorer assistant
      />
    );
  }
  
  // If no assistant is selected yet, show loading
  if (!selectedAssistant) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse">Loading assistant...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <AssistantChatInterface initialAssistant={selectedAssistant} />
    </AppLayout>
  );
};

export default AssistantInterface;
