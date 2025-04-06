
import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import CourseCard from '@/components/common/CourseCard';
import EventsSection from '@/components/homepage/EventsSection';

// Mock data for courses
const featuredCourses = [
  {
    id: '1',
    title: 'Introduction to Data Science',
    description: 'Learn the fundamentals of data science, from data preprocessing to model deployment.',
    category: 'AI/ML',
    author: 'Dr. John Smith',
    duration: '8 weeks',
    level: 'Beginner',
    enrollments: 523,
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1557853197-aefb550b6fdc?ixlib=rb-1.2.1&auto=format&fit=crop&w=700&q=80',
  },
  {
    id: '2',
    title: 'Advanced Python for Data Analysis',
    description: 'Master Python libraries like Pandas, NumPy, and Matplotlib for effective data analysis.',
    category: 'Analytics',
    author: 'Jane Johnson, PhD',
    duration: '6 weeks',
    level: 'Intermediate',
    enrollments: 412,
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?ixlib=rb-1.2.1&auto=format&fit=crop&w=700&q=80',
  },
  {
    id: '3',
    title: 'Data Engineering Fundamentals',
    description: 'Build data pipelines, design data lakes, and implement ETL processes for big data.',
    category: 'Data Engineering',
    author: 'David Williams',
    duration: '10 weeks',
    level: 'Intermediate',
    enrollments: 287,
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?ixlib=rb-1.2.1&auto=format&fit=crop&w=700&q=80',
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero section */}
      <section className="bg-gradient-to-b from-primary/10 to-background px-4 py-20 text-center">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Unlock Your Data Potential</h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8">
            Join our community of data professionals and master the skills that drive innovation in today's data-driven world.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" asChild>
              <Link to="/courses">Explore Courses</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/register">Join Now</Link>
            </Button>
          </div>
        </div>
      </section>
      
      {/* Featured courses section */}
      <section className="py-12 px-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold">Featured Courses</h2>
            <Button variant="outline" asChild>
              <Link to="/courses">View All Courses</Link>
            </Button>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </div>
      </section>
      
      {/* Events section */}
      <EventsSection />
      
      {/* Why choose us section */}
      <section className="bg-muted/50 py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose Insights Collective</h2>
          
          <div className="grid gap-8 md:grid-cols-3">
            <div className="bg-card p-6 rounded-lg shadow-sm">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Industry-Relevant Curriculum</h3>
              <p className="text-muted-foreground">Courses designed in collaboration with leading data companies to ensure you learn skills that matter.</p>
            </div>
            
            <div className="bg-card p-6 rounded-lg shadow-sm">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Community-Driven Learning</h3>
              <p className="text-muted-foreground">Join a vibrant community of data enthusiasts to collaborate, learn, and grow together.</p>
            </div>
            
            <div className="bg-card p-6 rounded-lg shadow-sm">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Practical Projects & Certifications</h3>
              <p className="text-muted-foreground">Build a portfolio of real-world projects and earn industry-recognized certifications.</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA section */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-3xl font-bold mb-6">Ready to Start Your Data Journey?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of students who have transformed their careers with our data skills platform.
          </p>
          <Button size="lg" asChild>
            <Link to="/register">Get Started Today</Link>
          </Button>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-muted py-12 px-4">
        <div className="container mx-auto">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <h3 className="text-lg font-semibold mb-4">Insights Collective</h3>
              <p className="text-muted-foreground">
                Empowering data professionals with the skills, community, and opportunities they need to thrive.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Explore</h3>
              <ul className="space-y-2">
                <li><Link to="/courses" className="text-muted-foreground hover:text-foreground">Courses</Link></li>
                <li><Link to="/resources" className="text-muted-foreground hover:text-foreground">Resources</Link></li>
                <li><Link to="/events" className="text-muted-foreground hover:text-foreground">Events</Link></li>
                <li><Link to="/explore-data-careers" className="text-muted-foreground hover:text-foreground">Data Careers</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-muted-foreground hover:text-foreground">About Us</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground">Our Team</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground">Careers</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Connect</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-muted-foreground hover:text-foreground">Twitter</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground">LinkedIn</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground">GitHub</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground">YouTube</a></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Insights Collective. All rights reserved.
            </p>
            <div className="flex mt-4 md:mt-0 space-x-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Privacy Policy</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Terms of Service</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
