
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen, GraduationCap, Award, Layers } from 'lucide-react';
import { mockService } from '@/lib/mockData';

const Index = () => {
  const featuredCourses = mockService.getAllCourses().slice(0, 3);
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-learnflow-700 to-learnflow-900 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Welcome to LearnFlow Campus
            </h1>
            <p className="text-xl mb-8">
              A modern e-learning platform designed to help you achieve your educational goals
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" asChild>
                <Link to="/register">Get Started</Link>
              </Button>
              <Button size="lg" variant="outline" className="bg-transparent hover:bg-white/10" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose LearnFlow Campus?</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card shadow-sm">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <BookOpen className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Structured Learning</h3>
              <p className="text-muted-foreground">Courses organized into weekly modules for effective learning progression</p>
            </div>
            
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card shadow-sm">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Layers className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Comprehensive Content</h3>
              <p className="text-muted-foreground">Access lessons, assignments, quizzes, and interactive materials</p>
            </div>
            
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card shadow-sm">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <GraduationCap className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Expert Instructors</h3>
              <p className="text-muted-foreground">Learn from industry professionals with real-world experience</p>
            </div>
            
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card shadow-sm">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Award className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Certification</h3>
              <p className="text-muted-foreground">Earn certificates upon successful completion of courses</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Featured Courses */}
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
            {featuredCourses.map((course) => (
              <Link to={`/courses/${course.id}`} key={course.id} className="block">
                <div className="course-card group">
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
                        {course.category}
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
      
      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-learnflow-600 to-learnflow-800 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Learning?</h2>
          <p className="text-xl max-w-2xl mx-auto mb-8">
            Join thousands of students already learning on LearnFlow Campus. Sign up today and take the first step towards your educational goals.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/register">Create Free Account</Link>
          </Button>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4 flex items-center">
                <GraduationCap className="mr-2 h-6 w-6" />
                LearnFlow Campus
              </h3>
              <p className="text-gray-400">
                A modern e-learning platform designed to help you achieve your educational goals
              </p>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li><Link to="/courses" className="text-gray-400 hover:text-white">Courses</Link></li>
                <li><Link to="/register" className="text-gray-400 hover:text-white">Sign Up</Link></li>
                <li><Link to="/login" className="text-gray-400 hover:text-white">Sign In</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Contact Us</h4>
              <address className="text-gray-400 not-italic">
                <p>Email: info@learnflow.com</p>
                <p>Phone: (123) 456-7890</p>
              </address>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
            <p>© {new Date().getFullYear()} LearnFlow Campus. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
