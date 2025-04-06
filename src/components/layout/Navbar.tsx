
import { Bell, Menu, Search, UserCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';
import { useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { toggleSidebar, state } = useSidebar();
  
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 gap-4">
        <div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleSidebar}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
        
        <div className="flex items-center mr-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <span>Insights Collective</span>
          </Link>
        </div>
        
        <div className="hidden lg:flex space-x-4 flex-1">
          {!isAuthenticated || (isAuthenticated && user?.role !== 'admin') ? (
            <>
              <Link to="/dashboard" className="px-3 py-2 text-sm font-medium hover:text-primary">Dashboard</Link>
              <Link to="/courses" className="px-3 py-2 text-sm font-medium hover:text-primary">Courses</Link>
              <Link to="/resources" className="px-3 py-2 text-sm font-medium hover:text-primary">Resources</Link>
              <Link to="/resources/data-blueprint" className="px-3 py-2 text-sm font-medium hover:text-primary">Data Blueprint</Link>
              <Link to="/explore-data-careers" className="px-3 py-2 text-sm font-medium hover:text-primary">Explore Careers</Link>
            </>
          ) : (
            <>
              <Link to="/admin" className="px-3 py-2 text-sm font-medium hover:text-primary">Admin Dashboard</Link>
              <Link to="/admin/courses" className="px-3 py-2 text-sm font-medium hover:text-primary">Manage Courses</Link>
              <Link to="/admin/users" className="px-3 py-2 text-sm font-medium hover:text-primary">Manage Users</Link>
              <Link to="/admin/certificates" className="px-3 py-2 text-sm font-medium hover:text-primary">Manage Certificates</Link>
              <Link to="/admin/resources" className="px-3 py-2 text-sm font-medium hover:text-primary">Manage Resources</Link>
            </>
          )}
        </div>
        
        <div className="hidden lg:flex lg:flex-1 relative lg:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search courses..."
            className="w-full pl-8 bg-background"
          />
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/notifications">
                <Bell className="h-5 w-5" />
                <span className="sr-only">Notifications</span>
              </Link>
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full overflow-hidden">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <UserCircle className="h-8 w-8" />
                  )}
                  <span className="sr-only">User menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAuthenticated ? (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/profile">Profile</Link>
                    </DropdownMenuItem>
                    {user?.role !== 'admin' && (
                      <DropdownMenuItem asChild>
                        <Link to="/dashboard">Dashboard</Link>
                      </DropdownMenuItem>
                    )}
                    {user?.role === 'admin' && (
                      <DropdownMenuItem asChild>
                        <Link to="/admin">Admin Dashboard</Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout}>
                      Logout
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/login">Login</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/register">Register</Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
