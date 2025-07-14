import { Bell, Menu, UserCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import SiteSearch from '@/components/search/SiteSearch';
import { ProfileMenu } from '@/components/layout/ProfileMenu';
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
  return <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <div className="flex h-14 items-center px-4 gap-4 w-full">
        <div>
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
        
        <div className="flex items-center mr-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <span>Insights Collective</span>
          </Link>
        </div>
        
        <SiteSearch />
        
        <div className="flex items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
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