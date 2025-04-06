
import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CourseCard from '@/components/common/CourseCard';
import { mockService } from '@/lib/mockData';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';

const CourseList = () => {
  const allCourses = mockService.getAllCourses();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  
  // Extract unique categories and levels
  const categories = Array.from(new Set(allCourses.map(course => course.category)));
  const levels = ['Beginner', 'Intermediate', 'Advanced'];
  
  // Filter courses based on search query and filters
  const filteredCourses = allCourses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         course.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter;
    const matchesLevel = levelFilter === 'all' || course.level === levelFilter;
    
    return matchesSearch && matchesCategory && matchesLevel;
  });
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
          <p className="text-muted-foreground">
            Explore our wide range of courses and start learning today.
          </p>
        </div>
        
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Search by course title or description"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {levels.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All Courses</TabsTrigger>
            <TabsTrigger value="popular">Popular</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
            <TabsTrigger value="web">Web Development</TabsTrigger>
            <TabsTrigger value="data">Data Science</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-6">
            {filteredCourses.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCourses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium">No courses found</h3>
                <p className="text-muted-foreground mt-1">Try adjusting your search or filters</p>
                <Button variant="outline" className="mt-4" onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setLevelFilter('all');
                }}>
                  Clear Filters
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="popular" className="mt-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {allCourses
                .sort((a, b) => b.enrollmentCount - a.enrollmentCount)
                .slice(0, 6)
                .map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
            </div>
          </TabsContent>
          
          <TabsContent value="new" className="mt-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {allCourses
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 6)
                .map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
            </div>
          </TabsContent>
          
          <TabsContent value="web" className="mt-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {allCourses
                .filter(course => course.category === "Web Development")
                .map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
            </div>
          </TabsContent>
          
          <TabsContent value="data" className="mt-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {allCourses
                .filter(course => course.category === "Data Science")
                .map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default CourseList;
