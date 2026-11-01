import { Bell, Menu, UserCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import SiteSearch from '@/components/search/SiteSearch';
import { ProfileMenu } from '@/components/layout/ProfileMenu';
import ThemeToggle from '@/components/layout/ThemeToggle';
import { FeedbackSlot, showsCourseFeedback } from '@/components/course/feedbackSlot';
const Navbar = () => {
  const location = useLocation();
  const {
    toggleSidebar
  } = useSidebar();
  const {
    user,
    isAuthenticated,
    isAdminAuthenticated,
    logout
  } = useAuth();
  // On course pages the Feedback trigger sits in this bar (never floating over content); below sm the bar tightens its
  // gaps by the trigger's width so the site search keeps the room it had. Every other page is unchanged.
  const feedback = showsCourseFeedback(location.pathname, isAuthenticated);
  return <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <div className={`flex h-14 items-center pl-4 w-full ${feedback ? 'pr-3 gap-2 sm:pr-8 sm:gap-4' : 'pr-6 sm:pr-8 gap-4'}`}>
        <div>
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
        
        <SiteSearch />
        
        <div className="flex items-center justify-end space-x-4">
          <nav className={`flex items-center ${feedback ? 'space-x-0.5 sm:space-x-2' : 'space-x-2'}`}>
            {feedback && <FeedbackSlot />}
            <ThemeToggle />
            <Button variant="ghost" size="icon" asChild>
              <Link to="/notifications">
                <Bell className="h-5 w-5" />
                <span className="sr-only">Notifications</span>
              </Link>
            </Button>
            
            <ProfileMenu />
          </nav>
        </div>
      </div>
    </header>;
};
export default Navbar;