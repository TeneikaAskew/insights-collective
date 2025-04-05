
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen, GraduationCap, Award, Layers } from 'lucide-react';
import { mockService } from '@/lib/mockData';
import QuizSection from '@/components/quiz/QuizSection';

const Index = () => {
  const featuredCourses = mockService.getAllCourses().slice(0, 3);
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-learnflow-700 to-learnflow-900 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Welcome to Insights Collective
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
      
      {/* Career Quiz Section */}
      <QuizSection />
      
      {/* Features Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose Insights Collective?</h2>
          
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
            Join thousands of students already learning on Insights Collective. Sign up today and take the first step towards your educational goals.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/register">Create Free Account</Link>
          </Button>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4 flex items-center">
                <GraduationCap className="mr-2 h-6 w-6" />
                Insights Collective
              </h3>
              <p className="text-gray-400">
                A modern e-learning platform designed to help you achieve your educational goals
              </p>
              <address className="text-gray-400 not-italic mt-4">
                <p>Email: info@ic.tech</p>
                <p>Phone: (123) 456-7890</p>
              </address>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li><Link to="/courses" className="text-gray-400 hover:text-white">Courses</Link></li>
                <li><Link to="/resources" className="text-gray-400 hover:text-white">Resources</Link></li>
                <li><Link to="/register" className="text-gray-400 hover:text-white">Sign Up</Link></li>
                <li><Link to="/login" className="text-gray-400 hover:text-white">Sign In</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Course Categories</h4>
              <ul className="space-y-2">
                <li><Link to="/courses?category=data-science" className="text-gray-400 hover:text-white">Data Science</Link></li>
                <li><Link to="/courses?category=analytics" className="text-gray-400 hover:text-white">Analytics</Link></li>
                <li><Link to="/courses?category=data-engineering" className="text-gray-400 hover:text-white">Data Engineering</Link></li>
                <li><Link to="/courses?category=machine-learning" className="text-gray-400 hover:text-white">Machine Learning & AI</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Follow Us</h4>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-twitter"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-linkedin"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect width="4" height="12" x="2" y="9"></rect><circle cx="4" cy="4" r="2"></circle></svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-instagram"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line></svg>
                </a>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
            <p>© {new Date().getFullYear()} Insights Collective. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
