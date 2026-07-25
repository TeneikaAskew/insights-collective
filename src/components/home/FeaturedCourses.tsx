
import { Link } from 'react-router-dom';
import { ArrowRight, Star, Clock, BookOpen, Sparkles, Target, TrendingUp, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Course } from '@/types';
import { CourseDifficulty } from '@/types/course';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

// Extended Course type with optional progress property
type ExtendedCourse = Course & {
  progress?: number;
};

type FeaturedCoursesProps = {
  courses: ExtendedCourse[];
};

const FeaturedCourses = ({ courses }: FeaturedCoursesProps) => {
  // Helper function to ensure the category matches one of the standardized labels
  const getCategoryLabel = (category: string): string => {
    // Map old category names to standardized ones
    switch (category) {
      case 'Machine Learning & Artificial Intelligence':
        return 'AI/ML';
      case 'Analytics & Business Intelligence':
        return 'Analytics';
      case 'Data Engineering':
        return 'Data Engineering';
      case 'Business Intelligence':
        return 'Business Intelligence';
      case 'Data Science':
        return 'Data Engineering';
      case 'Web Development':
        return 'Data Engineering';
      default:
        // If it's already one of our standard categories, return it as is
        if (['AI/ML', 'Analytics', 'Data Engineering', 'Business Intelligence'].includes(category)) {
          return category;
        }
        // Default fallback
        return 'Data Engineering';
    }
  };
  
  // Get badge color based on category
  const getCategoryColor = (category: string): string => {
    switch (getCategoryLabel(category)) {
      case 'AI/ML':
        return 'bg-blue-100 text-blue-600';
      case 'Analytics':
        return 'bg-green-100 text-green-600';
      case 'Data Engineering':
        return 'bg-purple-100 text-purple-600';
      case 'Business Intelligence':
        return 'bg-amber-100 text-amber-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };
  
  // Get level badge style
  const getLevelStyle = (level: string): string => {
    switch (level.toLowerCase()) {
      case 'beginner':
        return 'bg-green-100 text-green-600 border-green-200';
      case 'intermediate':
        return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'advanced':
        return 'bg-purple-100 text-purple-600 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  // Get difficulty badge configuration
  const getDifficultyConfig = (difficulty?: CourseDifficulty | string) => {
    switch (difficulty?.toLowerCase()) {
      case 'beginner':
        return {
          icon: Target,
          color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200',
          label: 'Beginner'
        };
      case 'intermediate':
        return {
          icon: TrendingUp,
          color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200',
          label: 'Intermediate'
        };
      case 'advanced':
        return {
          icon: Award,
          color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200',
          label: 'Advanced'
        };
      default:
        return null;
    }
  };

  // Don't render a "Featured Courses" heading over a permanently empty grid.
  if (!courses || courses.length === 0) {
    return null;
  }

  return (
    <section className="py-20 bg-white dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold font-display bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">Featured Courses</h2>
          <Button variant="ghost" asChild className="group">
            <Link to="/courses" className="flex items-center">
              View All <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
          </Button>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {courses.map((course, index) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link to={`/courses/${course.id}`} className="block group">
                <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-md hover:shadow-xl transition-all duration-300 h-full flex flex-col">
                  <div className="aspect-video overflow-hidden relative">
                    {course.thumbnail ? (
                      <img
                        src={course.thumbnail}
                        alt={course.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div
                        className="w-full h-full bg-gradient-to-br from-primary/15 to-accent/15"
                        aria-hidden="true"
                      />
                    )}

                    {/* NOTE: no "Top Rated" badge — courses have no rating
                        column in the database, so any rating shown here would
                        be fabricated. */}

                    {/* Progress overlay - only show if progress exists */}
                    {course.progress !== undefined && (
                      <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gray-200">
                        <div 
                          className="h-full bg-primary" 
                          style={{ width: `${course.progress}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6 flex-grow flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <Badge className={`font-medium px-2.5 py-1 ${getCategoryColor(course.category)}`}>
                        {getCategoryLabel(course.category)}
                      </Badge>
                    </div>
                    
                    <h3 className="text-xl font-semibold mb-3 line-clamp-1 group-hover:text-primary transition-colors duration-300">{course.title}</h3>
                    <p className="text-muted-foreground mb-4 line-clamp-2">{course.description}</p>

                    {/* Difficulty and Estimated Hours Badges */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(() => {
                        const difficulty = (course as any).difficulty_level || (course as any).difficultyLevel;
                        const config = getDifficultyConfig(difficulty);
                        if (!config) return null;
                        const DifficultyIcon = config.icon;

                        return (
                          <Badge variant="outline" className={`${config.color} flex items-center gap-1 font-medium`}>
                            <DifficultyIcon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        );
                      })()}

                      {(() => {
                        const estimatedHours = (course as any).estimated_hours || (course as any).estimatedHours;
                        if (!estimatedHours) return null;

                        return (
                          <Badge variant="outline" className="flex items-center gap-1 border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                            <Clock className="h-3 w-3" />
                            {estimatedHours.toFixed(1)} hours
                          </Badge>
                        );
                      })()}
                    </div>

                    <div className="mt-auto flex justify-between items-center text-sm">
                      <Badge variant="outline" className={`${getLevelStyle(course.level)} font-medium`}>
                        {course.level}
                      </Badge>
                      <div className="flex items-center text-muted-foreground">
                        <Clock className="h-4 w-4 mr-1" />
                        <span>{course.duration}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-muted-foreground text-sm">
                        <BookOpen className="h-4 w-4 mr-1" />
                        <span>{course.modules?.length || 0} lessons</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-primary hover:text-primary hover:bg-primary/10 -mr-2 px-2 py-1 h-7"
                      >
                        <span className="mr-1">View</span>
                        <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform duration-300" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedCourses;
