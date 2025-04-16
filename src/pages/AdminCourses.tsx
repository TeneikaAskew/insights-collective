import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Edit, Trash2, Plus, FilterX, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CourseEditModal from '@/components/course/CourseEditModal';
import { useCourses } from '@/hooks/useCourses';
import { Course } from '@/types';

export default function AdminCourses() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [publishedFilter, setPublishedFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [courseToEdit, setCourseToEdit] = useState<Partial<Course> | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { 
    courses, 
    loading, 
    createCourse, 
    updateCourse, 
    deleteCourse 
  } = useCourses();

  const handleEditCourse = (course: Course) => {
    setCourseToEdit(course);
    setIsModalOpen(true);
  };

  const handleDeleteCourse = async () => {
    if (courseToDelete) {
      await deleteCourse(courseToDelete);
      setCourseToDelete(null);
    }
  };

  const handleAddCourse = () => {
    setCourseToEdit(null);
    setIsModalOpen(true);
  };

  const handleSaveCourse = async (course: Partial<Course>) => {
    if (course.id) {
      await updateCourse(course.id, course);
    } else {
      await createCourse(course);
    }
    setIsModalOpen(false);
  };

  const handleManageInstructors = (courseId: string) => {
    navigate(`/courses/${courseId}/instructors`);
  };

  const filteredCourses = courses.filter((course) => {
    const matchesSearch = 
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (course.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
    
    const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter;
    
    const matchesPublished = 
      publishedFilter === 'all' || 
      (publishedFilter === 'published' && course.published) || 
      (publishedFilter === 'draft' && !course.published);
    
    return matchesSearch && matchesCategory && matchesPublished;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setPublishedFilter('all');
  };

  const uniqueCategories = Array.from(new Set(courses.map(course => course.category)));

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manage Courses</h1>
            <p className="text-muted-foreground mt-2">
              Create, edit, and manage your educational courses.
            </p>
          </div>
          <Button onClick={handleAddCourse} className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Add Course
          </Button>
        </div>

        <CourseEditModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveCourse}
          course={courseToEdit}
        />

        <Card>
          <CardHeader>
            <CardTitle>Courses</CardTitle>
            <CardDescription>
              View and manage all courses available on the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search courses..." 
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={publishedFilter} onValueChange={setPublishedFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {(searchQuery || categoryFilter !== 'all' || publishedFilter !== 'all') && (
                <div className="flex justify-end">
                  <Button 
                    variant="ghost" 
                    className="h-8 px-2 lg:px-3" 
                    onClick={clearFilters}
                  >
                    <FilterX className="mr-2 h-4 w-4" />
                    Clear filters
                  </Button>
                </div>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Instructor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          <div className="flex justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredCourses.length > 0 ? (
                      filteredCourses.map((course) => (
                        <TableRow key={course.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              {course.title}
                              <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                                {course.description}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {course.category}
                            </Badge>
                          </TableCell>
                          <TableCell>{course.level}</TableCell>
                          <TableCell>
                            {course.instructor ? (
                              `${course.instructor.first_name || ''} ${course.instructor.last_name || ''}`
                            ) : (
                              <span className="text-muted-foreground italic">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={course.published ? "default" : "secondary"}>
                              {course.published ? "Published" : "Draft"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <svg 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    width="24" 
                                    height="24" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                    className="h-4 w-4"
                                  >
                                    <circle cx="12" cy="12" r="1" />
                                    <circle cx="12" cy="5" r="1" />
                                    <circle cx="12" cy="19" r="1" />
                                  </svg>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => navigate(`/courses/${course.id}`)}>
                                  View Course
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditCourse(course)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleManageInstructors(course.id)}>
                                  <Users className="mr-2 h-4 w-4" />
                                  Manage Instructors
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    setCourseToDelete(course.id);
                                  }} 
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          No courses found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!courseToDelete} onOpenChange={(open) => !open && setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the course. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCourse}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
