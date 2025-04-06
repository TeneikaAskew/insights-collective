
import { Book, BarChart2, Star, GraduationCap, PieChart, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const LearningJourney = () => {
  return (
    <section className="py-16 bg-gradient-to-b from-background to-background/80">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Your Data Science Learning Journey</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Our carefully designed learning pathway helps you achieve your data science goals with structured progression. 
            Each step is optimized to maximize your learning potential and career advancement.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10 mt-12">
          {/* Step 1 */}
          <div className="flex flex-col items-start p-6 bg-card rounded-lg shadow-sm relative">
            <div className="absolute -top-4 -left-4 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">1</div>
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <Book className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Choose Your Path</h3>
            <p className="text-muted-foreground mb-4">
              Explore our curriculum offerings in Data Engineering, AI/ML, Analytics, or Business Intelligence based on your interests and career goals.
            </p>
            <div className="flex-grow"></div>
            <div className="mt-3">
              <Link to="/courses" className="text-primary font-medium flex items-center">
                Explore Paths →
              </Link>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-start p-6 bg-card rounded-lg shadow-sm relative">
            <div className="absolute -top-4 -left-4 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">2</div>
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <BarChart2 className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Personalized Learning</h3>
            <p className="text-muted-foreground mb-4">
              Receive AI-generated recommendations tailored to your skill level, learning style, and career objectives in the data science field.
            </p>
            <div className="flex-grow"></div>
            <div className="mt-3">
              <Link to="/explore-data-careers" className="text-primary font-medium flex items-center">
                Take Assessment →
              </Link>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-start p-6 bg-card rounded-lg shadow-sm relative">
            <div className="absolute -top-4 -left-4 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">3</div>
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <Star className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Master Fundamentals</h3>
            <p className="text-muted-foreground mb-4">
              Build a strong foundation with our core courses in statistics, programming, and data manipulation - essential skills for any data professional.
            </p>
            <div className="flex-grow"></div>
            <div className="mt-3">
              <Link to="/resources/data-blueprint" className="text-primary font-medium flex items-center">
                View Blueprint →
              </Link>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex flex-col items-start p-6 bg-card rounded-lg shadow-sm relative">
            <div className="absolute -top-4 -left-4 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">4</div>
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <GraduationCap className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Applied Projects</h3>
            <p className="text-muted-foreground mb-4">
              Apply your knowledge to real-world scenarios through hands-on projects and gain practical experience valued by employers.
            </p>
            <div className="flex-grow"></div>
            <div className="mt-3">
              <Link to="/courses" className="text-primary font-medium flex items-center">
                Browse Projects →
              </Link>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex flex-col items-start p-6 bg-card rounded-lg shadow-sm relative">
            <div className="absolute -top-4 -left-4 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">5</div>
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <PieChart className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Track Progress</h3>
            <p className="text-muted-foreground mb-4">
              Monitor your skill development, course completion, and assessment results with our comprehensive analytics dashboard.
            </p>
            <div className="flex-grow"></div>
            <div className="mt-3">
              <Link to="/dashboard" className="text-primary font-medium flex items-center">
                View Dashboard →
              </Link>
            </div>
          </div>

          {/* Step 6 */}
          <div className="flex flex-col items-start p-6 bg-card rounded-lg shadow-sm relative">
            <div className="absolute -top-4 -left-4 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">6</div>
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <Award className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Earn Certification</h3>
            <p className="text-muted-foreground mb-4">
              Showcase your expertise with industry-recognized certifications and enhance your professional profile in the data science field.
            </p>
            <div className="flex-grow"></div>
            <div className="mt-3">
              <Link to="/courses" className="text-primary font-medium flex items-center">
                View Certifications →
              </Link>
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
          <Button size="lg" className="bg-primary hover:bg-primary/90">
            Start Your Learning Journey →
          </Button>
        </div>
      </div>
    </section>
  );
};

export default LearningJourney;
