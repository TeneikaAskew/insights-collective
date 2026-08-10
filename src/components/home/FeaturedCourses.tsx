
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getCategoryDisplayName } from '@/constants/courseCategories';
import { motion } from 'framer-motion';
import { CourseImage } from '@/components/common/CourseImage';

/**
 * Only the fields this card actually renders.
 *
 * It used to take the full `Course`, which forced every caller through an
 * `as any` because no public-facing query returns all of it. Narrowing the
 * prop lets a caller pass exactly what it has, and makes "this card cannot
 * show a lesson count unless modules were loaded" a type-level fact rather
 * than a runtime `|| 0`.
 */
export type FeaturedCourse = {
  id: string;
  title: string;
  description: string;
  category: string;
  level?: string | null;
  thumbnail?: string | null;
  estimated_hours?: number | null;
  /** Present only when the caller genuinely loaded the course's modules. */
  modules?: unknown[];
  progress?: number;
};

type FeaturedCoursesProps = {
  courses: FeaturedCourse[];
};

const FeaturedCourses = ({ courses }: FeaturedCoursesProps) => {
  // Category labels come from the shared map in @/constants/courseCategories.
  // The local switch this replaces had gone stale against the live catalog: it
  // mapped 'Data Science' AND 'Web Development' to "Data Engineering", and fell
  // back to "Data Engineering" for anything it didn't recognize — which is
  // every category the catalog actually uses ('Analytics & BI', 'ML/AI'). Real
  // Analytics and Data Science courses were relabelled on the landing page.
  const getCategoryColor = (category: string): string => {
    switch (getCategoryDisplayName(category)) {
      case 'ML/AI':
        return 'bg-ss-teal-chip text-ss-teal';
      case 'Analytics & BI':
        return 'bg-ss-good-chip text-ss-good';
      case 'Data Engineering':
        return 'bg-ss-lav-chip text-ss-lav-deep';
      case 'Data Science':
        return 'bg-ss-warn-chip text-ss-warn';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };
  
  // Get level badge style
  const getLevelStyle = (level: string): string => {
    switch (level.toLowerCase()) {
      case 'beginner':
        return 'bg-ss-good-chip text-ss-good border-border';
      case 'intermediate':
        return 'bg-ss-teal-chip text-ss-teal border-border';
      case 'advanced':
        return 'bg-ss-lav-chip text-ss-lav-deep border-border';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  // Don't render a "Featured Courses" heading over a permanently empty grid.
  if (!courses || courses.length === 0) {
    return null;
  }

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground">Featured Courses</h2>
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
                <div className="rounded-xl overflow-hidden border border-border bg-card shadow-md hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
                  <div className="aspect-video overflow-hidden relative">
                    <CourseImage
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* NOTE: no "Top Rated" badge — courses have no rating
                        column in the database, so any rating shown here would
                        be fabricated. */}

                    {/* Progress overlay - only show if progress exists */}
                    {course.progress !== undefined && (
                      <div className="absolute bottom-0 left-0 w-full h-1.5 bg-muted">
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
                        {getCategoryDisplayName(course.category)}
                      </Badge>
                    </div>
                    
                    <h3 className="text-xl font-semibold mb-3 line-clamp-1 group-hover:text-primary transition-colors duration-300">{course.title}</h3>
                    <p className="text-muted-foreground mb-4 line-clamp-2">{course.description}</p>

                    {/* NOTE: no difficulty badge. `difficulty_level` and `level`
                        are separate columns that disagree — every course in the
                        catalog carries difficulty_level 'intermediate' while
                        its level ranges Beginner..Advanced — so rendering both
                        put "Beginner" and "Intermediate" on the same card. The
                        catalog shows `level`, so this card does too. */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(() => {
                        const estimatedHours = course.estimated_hours;
                        if (!estimatedHours) return null;

                        return (
                          <Badge variant="outline" className="flex items-center gap-1 border-border bg-ss-teal-chip text-ss-teal">
                            <Clock className="h-3 w-3" />
                            {estimatedHours.toFixed(1)} hours
                          </Badge>
                        );
                      })()}
                    </div>

                    {/* Level and duration are both nullable in the database, and
                        an empty badge or a lone clock icon reads as broken —
                        omit each one when the course does not carry it. */}
                    <div className="mt-auto flex justify-between items-center text-sm">
                      {course.level ? (
                        <Badge variant="outline" className={`${getLevelStyle(course.level)} font-medium`}>
                          {course.level}
                        </Badge>
                      ) : (
                        <span />
                      )}
                      {/* NOTE: `duration` is a bare smallint with no unit
                          anywhere in the schema or the UI, so it rendered as a
                          clock icon next to a naked "12" — beside an
                          "4.3 hours" badge reading off a different column.
                          Estimated hours is the one with a known unit; show
                          that alone rather than guessing this one means weeks. */}
                    </div>
                  </div>
                  
                  <div className="px-6 py-4 border-t border-border bg-muted/50">
                    <div className="flex items-center justify-between">
                      {/* NOTE: no lesson count unless modules were actually
                          loaded. This read `modules?.length || 0`, and no
                          caller has ever passed modules — so every card on the
                          landing page claimed "0 lessons" for courses that
                          have lessons. Same rule as the absent rating badge:
                          omit rather than state a number that isn't true. */}
                      {course.modules ? (
                        <div className="flex items-center text-muted-foreground text-sm">
                          <BookOpen className="h-4 w-4 mr-1" />
                          <span>{course.modules.length} lessons</span>
                        </div>
                      ) : (
                        <span />
                      )}
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
