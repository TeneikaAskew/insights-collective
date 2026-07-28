// ABOUTME: Featured course cards on the landing page, fed by the public catalog read.
// ABOUTME: Shows skeletons while loading and an explicit empty state instead of a blank grid.
import { Link } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Course } from '@/types';
import { Reveal, stagger } from './motion/Reveal';

// Extended Course type with optional progress property
type ExtendedCourse = Course & {
  progress?: number;
};

type FeaturedCoursesProps = {
  courses: ExtendedCourse[];
  isLoading?: boolean;
};

/**
 * Levels are free text on the row, so match loosely and fall back to a neutral
 * chip — an unset value used to throw and take the whole landing page down.
 */
const getLevelStyle = (level?: string): string => {
  switch (level?.toLowerCase()) {
    case 'beginner':
      return 'bg-studio-goodChip text-studio-good';
    case 'intermediate':
      return 'bg-studio-lavChip text-studio-lavDeeper';
    case 'advanced':
      return 'bg-studio-warnChip text-studio-peachDeep';
    default:
      return 'bg-studio-track text-studio-muted';
  }
};

const formatHours = (course: ExtendedCourse): string | null => {
  const hours = (course as any).estimated_hours ?? (course as any).estimatedHours;
  if (!hours) return null;
  const rounded = Math.round(Number(hours) * 10) / 10;
  return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`;
};

const FeaturedCourses = ({ courses, isLoading = false }: FeaturedCoursesProps) => {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4 max-w-6xl">
        <Reveal>
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <h2 className="text-3xl md:text-4xl font-bold text-studio-ink">Featured Courses</h2>
            <Button
              variant="ghost"
              asChild
              className="group text-studio-lavDeep hover:text-studio-lavDeeper"
            >
              <Link to="/courses" className="flex items-center">
                View All{' '}
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </Button>
          </div>
        </Reveal>

        {/* Loading: hold the grid's shape so the section doesn't jump when data lands. */}
        {isLoading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-10">
            {[0, 1, 2].map((i) => (
              <div key={i} className="studio-card overflow-hidden">
                <div className="aspect-video bg-studio-track animate-pulse" />
                <div className="p-6 space-y-3">
                  <div className="h-4 w-24 rounded-full bg-studio-track animate-pulse" />
                  <div className="h-5 w-3/4 rounded bg-studio-track animate-pulse" />
                  <div className="h-4 w-full rounded bg-studio-track animate-pulse" />
                  <div className="h-4 w-2/3 rounded bg-studio-track animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty: previously this section rendered a heading above a blank grid. */}
        {!isLoading && courses.length === 0 && (
          <div className="studio-card-warm p-10 text-center mt-10">
            <h3 className="text-xl font-semibold text-studio-ink mb-2">
              New courses are on the way
            </h3>
            <p className="text-studio-muted max-w-md mx-auto mb-6">
              Nothing is published in this view yet. Browse the full catalog to see everything
              available right now.
            </p>
            <Button asChild className="bg-studio-lavDeep hover:bg-studio-lavDeeper text-white rounded-full">
              <Link to="/courses">Browse all courses</Link>
            </Button>
          </div>
        )}

        {!isLoading && courses.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-10">
            {courses.map((course, index) => {
              const hours = formatHours(course);

              return (
                <Reveal key={course.id} delay={stagger(index)}>
                  <Link to={`/courses/${course.id}`} className="block group h-full">
                    <div className="studio-card overflow-hidden h-full flex flex-col hover:-translate-y-0.5 transition-transform duration-300">
                      <div className="aspect-video overflow-hidden relative bg-studio-track">
                        <img
                          src={course.thumbnail}
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />

                        {/* Progress overlay - only show if progress exists */}
                        {course.progress !== undefined && (
                          <div className="absolute bottom-0 left-0 w-full h-1.5 bg-studio-track">
                            <div
                              className="h-full bg-studio-lavDeep"
                              style={{ width: `${course.progress}%` }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="p-6 flex-grow flex flex-col">
                        {course.category && (
                          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-studio-peachDeep">
                            {course.category}
                          </span>
                        )}

                        <h3 className="text-lg font-semibold mt-2 text-studio-ink line-clamp-1 group-hover:text-studio-lavDeep transition-colors">
                          {course.title}
                        </h3>
                        <p className="text-[15px] leading-relaxed text-studio-muted mt-2 line-clamp-2">
                          {course.description}
                        </p>

                        <div className="mt-auto pt-5 flex items-center justify-between gap-3">
                          {course.level ? (
                            <span
                              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getLevelStyle(course.level)}`}
                            >
                              {course.level}
                            </span>
                          ) : (
                            <span />
                          )}
                          {hours && (
                            <span className="flex items-center gap-1.5 text-sm text-studio-muted">
                              <Clock className="h-4 w-4" />
                              {hours}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default FeaturedCourses;
