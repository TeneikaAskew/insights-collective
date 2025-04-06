
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Course } from '@/types';

type FeaturedCoursesProps = {
  courses: Course[];
};

const FeaturedCourses = ({ courses }: FeaturedCoursesProps) => {
  // Helper function to display the correct category label
  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case 'Machine Learning & Artificial Intelligence':
        return 'AI/ML';
      case 'Analytics & Business Intelligence':
        return 'Analytics';
      case 'Data Engineering':
        return 'Data Engineering';
      case 'Business Intelligence':
        return 'Business Intelligence';
      case 'Web Development': // Map legacy category
        return 'Data Engineering';
      default:
        return category;
    }
  };

  return (
    <section className="py-16 bg-secondary/50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Featured Courses</h2>
          <Button variant="ghost" asChild>
            <Link to="/courses" className="flex items-center">
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Link to={`/courses/${course.id}`} key={course.id} className="block">
              <div className="course-card group rounded-lg overflow-hidden border bg-card shadow-sm hover:shadow-md transition-shadow">
                <div className="aspect-video overflow-hidden">
                  <img 
                    src={course.thumbnail} 
                    alt={course.title} 
                    className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {getCategoryLabel(course.category)}
                    </span>
                    <div className="flex items-center text-amber-500">
                      <span className="text-sm font-medium">{course.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2 line-clamp-1">{course.title}</h3>
                  <p className="text-muted-foreground mb-4 line-clamp-2">{course.description}</p>
                  <div className="flex justify-between items-center text-sm">
                    <span>{course.level}</span>
                    <span>{course.duration}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedCourses;
