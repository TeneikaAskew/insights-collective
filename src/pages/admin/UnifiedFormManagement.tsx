
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormList } from '@/components/admin/forms/FormList';
import { FormTemplates } from '@/components/admin/forms/FormTemplates';
import FormAnalytics from '@/components/admin/forms/FormAnalytics';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { PlusCircle, BarChart3, ListFilter, BookTemplate } from 'lucide-react';
import CreateFormDialog from '@/components/admin/forms/CreateFormDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export default function UnifiedFormManagement() {
  const { user, isAdmin } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  if (!user || !isAdmin) {
    return <Navigate to="/" />;
  }

  return (
    <AppLayout>
      <div className="container py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Form Management</h1>
            <p className="text-muted-foreground mt-2">
              Create, manage, and analyze your forms
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search forms..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Button 
              onClick={() => setCreateDialogOpen(true)}
              className="w-full sm:w-auto"
            >
              <PlusCircle className="mr-2 h-4 w-4" /> New Form
            </Button>
          </div>
        </div>

        <Tabs defaultValue="all-forms" className="w-full">
          <TabsList className="grid grid-cols-3 mb-8">
            <TabsTrigger value="all-forms" className="flex items-center">
              <ListFilter className="mr-2 h-4 w-4" />
              All Forms
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center">
              <BookTemplate className="mr-2 h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="all-forms" className="mt-0">
            <FormList searchTerm={searchTerm} />
          </TabsContent>
          
          <TabsContent value="templates" className="mt-0">
            <FormTemplates />
          </TabsContent>
          
          <TabsContent value="analytics" className="mt-0">
            <FormAnalytics />
          </TabsContent>
        </Tabs>
      </div>
      
      <CreateFormDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
      />
    </AppLayout>
  );
}
