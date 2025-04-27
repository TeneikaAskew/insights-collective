
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { FormList } from '@/components/admin/forms/FormList';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const AdminForms = () => {
  return (
    <AppLayout>
      <div className="container py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Forms Management</h1>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Form
          </Button>
        </div>
        <FormList />
      </div>
    </AppLayout>
  );
};

export default AdminForms;
