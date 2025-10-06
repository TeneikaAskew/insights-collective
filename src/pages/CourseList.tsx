import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CourseCard from '@/components/common/CourseCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, ArrowUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Course } from '@/types';
import { CourseDifficulty } from '@/types/course';
import { useToast } from '@/hooks/use-toast';
import { useAuthenticatedNavigation } from '@/hooks/useAuthenticatedNavigation';
import EnrollmentBadge from '@/components/course/EnrollmentBadge';
import { useNavigate } from 'react-router-dom';

import { createLogger } from '@/utils/logger';

const logger = createLogger('CourseList');

const CourseList = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const { toast } = useToast();
  const navigate = useNavigate();

  const categories = [...new Set(courses.map(course => course.category))];
  const levels = [...new Set(courses.map(course => course.level))];
  
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        let query = supabase
          .from('courses')
          .select(`
            *,
            instructor:profiles(
              id,
              first_name,
              last_name,
              avatar_url
            )
          `)
          .eq('status', 'published')
          .order('created_at', { ascending: false });
          
        const { data, error } = await query;
        
        if (error) throw error;
        
        const formattedCourses = data.map(course => ({
          ...course,
          instructor: {
            id: course.instructor?.id || course.instructor_id || '',
            name: course.instructor 
              ? `${course.instructor?.first_name || ''} ${course.instructor?.last_name || ''}`.trim()
              : 'Instructor',
            email: '',
            role: 'instructor',
            avatar: course.instructor?.avatar_url || '',
          },
          enrollmentCount: 0,
          modules: [],
          rating: 4.5,
          createdAt: course.created_at,
          updatedAt: course.updated_at,
          thumbnail: course.image_url || course.thumbnail || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97',
        }));
        
        setCourses(formattedCourses);
        setLoading(false);
      } catch (error: any) {
        logger.error('Error fetching courses:', error);
        setError(error.message);
        setLoading(false);
        toast({
          title: "Failed to load courses",
          description: error.message || "There was an error loading the courses",
          variant: "destructive"
        });
      }
    };
    
    fetchCourses();
  }, [toast]);
  
  const handleCourseClick = (courseId: string) => {
    navigate(`/courses/${courseId}`);
  };
  
  const filteredAndSortedCourses = courses
    .filter(course => {
      const matchesSearch =
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter;
      const matchesLevel = levelFilter === 'all' || course.level === levelFilter;
      const matchesDifficulty = difficultyFilter === 'all' ||
        (course.difficulty_level || course.difficultyLevel)?.toLowerCase() === difficultyFilter.toLowerCase();

      return matchesSearch && matchesCategory && matchesLevel && matchesDifficulty;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        case 'difficulty-asc': {
          const difficultyOrder: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3 };
          const aDiff = (a.difficulty_level || a.difficultyLevel)?.toLowerCase();
          const bDiff = (b.difficulty_level || b.difficultyLevel)?.toLowerCase();
          const aOrder = aDiff ? (difficultyOrder[aDiff] ?? 999) : 999;
          const bOrder = bDiff ? (difficultyOrder[bDiff] ?? 999) : 999;
          return aOrder - bOrder;
        }
        case 'difficulty-desc': {
          const difficultyOrder: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3 };
          const aDiff = (a.difficulty_level || a.difficultyLevel)?.toLowerCase();
          const bDiff = (b.difficulty_level || b.difficultyLevel)?.toLowerCase();
          const aOrder = aDiff ? (difficultyOrder[aDiff] ?? 0) : 0;
          const bOrder = bDiff ? (difficultyOrder[bDiff] ?? 0) : 0;
          return bOrder - aOrder;
        }
        case 'hours-asc': {
          const aHours = a.estimated_hours || a.estimatedHours || 999;
          const bHours = b.estimated_hours || b.estimatedHours || 999;
          return aHours - bHours;
        }
        case 'hours-desc': {
          const aHours = a.estimated_hours || a.estimatedHours || 0;
          const bHours = b.estimated_hours || b.estimatedHours || 0;
          return bHours - aHours;
        }
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return 0;
      }
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
          
          <div className="flex gap-2 flex-wrap">
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

            <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Difficulties</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="title-asc">Title (A-Z)</SelectItem>
                <SelectItem value="title-desc">Title (Z-A)</SelectItem>
                <SelectItem value="difficulty-asc">Difficulty (Easy First)</SelectItem>
                <SelectItem value="difficulty-desc">Difficulty (Hard First)</SelectItem>
                <SelectItem value="hours-asc">Duration (Shortest First)</SelectItem>
                <SelectItem value="hours-desc">Duration (Longest First)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All Courses</TabsTrigger>
            <TabsTrigger value="popular">Popular</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
            <TabsTrigger value="ai-ml">AI/ML</TabsTrigger>
            <TabsTrigger value="data-engineering">Data Engineering</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-6">
            {loading ? (
              <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium">Error loading courses</h3>
                <p className="text-muted-foreground mt-1">{error}</p>
                <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                  Try Again
                </Button>
              </div>
            ) : filteredAndSortedCourses.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredAndSortedCourses.map((course) => (
                  <div key={course.id} className="relative cursor-pointer" onClick={() => handleCourseClick(course.id)}>
                    <CourseCard course={course} />
                    <div className="mt-2">
                      <EnrollmentBadge courseId={course.id} />
                    </div>
                  </div>
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
                  setDifficultyFilter('all');
                  setSortBy('newest');
                }}>
                  Clear Filters
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="popular" className="mt-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses
                .sort((a, b) => b.enrollmentCount - a.enrollmentCount)
                .slice(0, 6)
                .map((course) => (
                  <div key={course.id} className="relative" onClick={() => handleCourseClick(course.id)}>
                    <CourseCard key={course.id} course={course} />
                    <div className="mt-2">
                      <EnrollmentBadge courseId={course.id} />
                    </div>
                  </div>
                ))}
            </div>
          </TabsContent>
          
          <TabsContent value="new" className="mt-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 6)
                .map((course) => (
                  <div key={course.id} className="relative" onClick={() => handleCourseClick(course.id)}>
                    <CourseCard key={course.id} course={course} />
                    <div className="mt-2">
                      <EnrollmentBadge courseId={course.id} />
                    </div>
                  </div>
                ))}
            </div>
          </TabsContent>
          
          <TabsContent value="ai-ml" className="mt-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses
                .filter(course => course.category === "AI/ML")
                .map((course) => (
                  <div key={course.id} className="relative" onClick={() => handleCourseClick(course.id)}>
                    <CourseCard key={course.id} course={course} />
                    <div className="mt-2">
                      <EnrollmentBadge courseId={course.id} />
                    </div>
                  </div>
                ))}
            </div>
          </TabsContent>
          
          <TabsContent value="data-engineering" className="mt-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses
                .filter(course => course.category === "Data Engineering")
                .map((course) => (
                  <div key={course.id} className="relative" onClick={() => handleCourseClick(course.id)}>
                    <CourseCard key={course.id} course={course} />
                    <div className="mt-2">
                      <EnrollmentBadge courseId={course.id} />
                    </div>
                  </div>
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default CourseList;
