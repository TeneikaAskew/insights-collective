
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormList } from '@/components/admin/forms/FormList';
import { FormTemplates } from '@/components/admin/forms/FormTemplates';
import FormAnalytics from '@/components/admin/forms/FormAnalytics';
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

  const tabTrigger = 'rounded-xl data-[state=active]:bg-card data-[state=active]:text-ss-lav-deep data-[state=active]:shadow-[var(--ss-shadow)] flex items-center';

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <p className="ss-serif text-ss-lav-deep text-lg mb-1">Insights Collective · Admin</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Form Management</h1>
          <p className="text-muted-foreground mt-1">
            Create, manage, and analyze your forms
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search forms..."
              className="pl-9 rounded-xl bg-card"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="w-full sm:w-auto rounded-xl"
          >
            <PlusCircle className="mr-2 h-4 w-4" /> New Form
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all-forms" className="w-full">
        <TabsList className="grid grid-cols-3 mb-6 bg-muted rounded-2xl p-1 h-auto">
          <TabsTrigger value="all-forms" className={tabTrigger}>
            <ListFilter className="mr-2 h-4 w-4" />
            All Forms
          </TabsTrigger>
          <TabsTrigger value="templates" className={tabTrigger}>
            <BookTemplate className="mr-2 h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="analytics" className={tabTrigger}>
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

      <CreateFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}
