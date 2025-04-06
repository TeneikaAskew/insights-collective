
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Search, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CareerRoleDetails } from '@/components/careers/CareerRoleDetails';
import { RoleCard } from '@/components/careers/RoleCard';
import { dataCareerRoles } from '@/data/dataCareerRoles';

const ExploreDataCareers = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  
  // Get role from URL parameters
  useEffect(() => {
    const roleId = searchParams.get('role');
    if (roleId) {
      setSelectedRole(roleId);
      
      // Scroll to the role card if it exists
      setTimeout(() => {
        const element = document.getElementById(`role-${roleId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [searchParams]);

  // Get unique categories
  const categories = ['all', ...new Set(dataCareerRoles.map(role => role.category))];
  
  // Filter roles based on search and category
  const filteredRoles = dataCareerRoles.filter(role => {
    const matchesSearch = 
      role.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      role.shortDescription.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || role.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Group roles by category for tab view
  const rolesByCategory = categories.reduce((acc, category) => {
    if (category !== 'all') {
      acc[category] = dataCareerRoles.filter(role => role.category === category);
    }
    return acc;
  }, {} as Record<string, typeof dataCareerRoles>);

  const handleRoleClick = (roleId: string) => {
    setSelectedRole(roleId === selectedRole ? null : roleId);
    
    // Update URL with the selected role
    if (roleId !== selectedRole) {
      searchParams.set('role', roleId);
    } else {
      searchParams.delete('role');
    }
    setSearchParams(searchParams);
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Explore Data Careers</h1>
          <p className="text-lg text-muted-foreground">
            Browse real-world roles across data science, analytics, engineering, and AI to see which one fits your strengths and interests.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search roles..." 
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Tabs defaultValue="grid" className="space-y-4">
          <div className="flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="grid">Grid View</TabsTrigger>
              <TabsTrigger value="categories">By Category</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="grid" className="space-y-6">
            {filteredRoles.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredRoles.map((role) => (
                  <RoleCard
                    key={role.id}
                    role={role}
                    isSelected={role.id === selectedRole}
                    onClick={() => handleRoleClick(role.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <h3 className="text-xl font-medium mb-2">No roles match your search</h3>
                <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="categories" className="space-y-10">
            {Object.entries(rolesByCategory).map(([category, roles]) => (
              <div key={category} className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold">{category}</h2>
                  <Separator className="my-2" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {roles.map((role) => (
                    <RoleCard
                      key={role.id}
                      role={role}
                      isSelected={role.id === selectedRole}
                      onClick={() => handleRoleClick(role.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
        
        {selectedRole && (
          <div className="mt-8">
            <CareerRoleDetails 
              role={dataCareerRoles.find(r => r.id === selectedRole)!} 
              onClose={() => handleRoleClick(selectedRole)}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ExploreDataCareers;
