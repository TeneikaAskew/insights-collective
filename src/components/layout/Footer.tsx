
import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { copyrightLine } from '@/components/layout/AppFooter';

const Footer = () => {
  return (
    <footer className="bg-foreground text-background py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <GraduationCap className="mr-2 h-6 w-6" />
              Insights Collective
            </h3>
            <p className="text-background/60">
              A modern e-learning platform designed to help you achieve your educational goals
            </p>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><Link to="/courses" className="text-background/60 hover:text-background">Courses</Link></li>
              <li><Link to="/resources" className="text-background/60 hover:text-background">Resources</Link></li>
              <li><Link to="/register" className="text-background/60 hover:text-background">Sign Up</Link></li>
              <li><Link to="/login" className="text-background/60 hover:text-background">Sign In</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Course Categories</h4>
            <ul className="space-y-2">
              <li><Link to="/courses?category=ai-ml" className="text-background/60 hover:text-background">AI/ML</Link></li>
              <li><Link to="/courses?category=analytics" className="text-background/60 hover:text-background">Analytics</Link></li>
              <li><Link to="/courses?category=data-engineering" className="text-background/60 hover:text-background">Data Engineering</Link></li>
              <li><Link to="/courses?category=business-intelligence" className="text-background/60 hover:text-background">Business Intelligence</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Follow Us</h4>
            <div className="flex space-x-4">
              <a href="https://twitter.com/teneikaask_you" aria-label="Twitter" target="_blank" rel="noopener noreferrer" className="text-background/60 hover:text-background">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-twitter"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
              </a>
              <a href="https://linkedin.com/in/teneikaaskew" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer" className="text-background/60 hover:text-background">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-linkedin"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect width="4" height="12" x="2" y="9"></rect><circle cx="4" cy="4" r="2"></circle></svg>
              </a>
              <a href="https://instagram.com/teneikaask_you" aria-label="Instagram" target="_blank" rel="noopener noreferrer" className="text-background/60 hover:text-background">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-instagram"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line></svg>
              </a>
            </div>
          </div>
        </div>
        
        <div className="border-t border-background/15 mt-8 pt-8 text-center text-background/60 text-sm">
          <p>{copyrightLine()}</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link to="/privacy-policy" className="hover:text-background">Privacy Policy</Link>
            <Link to="/terms-of-service" className="hover:text-background">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
