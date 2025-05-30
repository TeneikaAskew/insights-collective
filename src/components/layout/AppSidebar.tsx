
import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { LogIn, LogOut, Settings, ChevronsUpDown, Brain, BadgeCheck } from "lucide-react"

import { useAuth } from "@/contexts/AuthContext"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarInset, SidebarMenu, SidebarMenuAction, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSkeleton, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider, SidebarRail, SidebarSeparator, SidebarTrigger, useSidebar } from "@/components/ui/sidebar"

const careerToolsItems = [
  {
    title: "Resume Analyzer",
    url: "/resume",
    icon: React.forwardRef<
      SVGSVGElement,
      React.ComponentProps<"svg">
    >(({ className, ...props }, ref) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        ref={ref}
        {...props}
      >
        <path d="M2.5 2v20l4.7-3 4.8 3 4.8-3 4.7 3V2" />
        <line x1="7" x2="17" y1="8" y2="8" />
        <line x1="7" x2="17" y1="12" y2="12" />
        <line x1="7" x2="13" y1="16" y2="16" />
      </svg>
    )),
  },
  {
    title: "Interview Prep",
    url: "/interview-prep",
    icon: React.forwardRef<
      SVGSVGElement,
      React.ComponentProps<"svg">
    >(({ className, ...props }, ref) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        ref={ref}
        {...props}
      >
        <path d="M19 5v9M5 5v9M7 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0-2 2h-2" />
      </svg>
    )),
  },
  {
    title: "Career Agent",
    url: "/career-agent",
    icon: React.forwardRef<
      SVGSVGElement,
      React.ComponentProps<"svg">
    >(({ className, ...props }, ref) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        ref={ref}
        {...props}
      >
        <path d="M16 18a4 4 0 0 0-8 0" />
        <circle cx="12" cy="11" r="3" />
        <path d="M2 21a8 8 0 0 1 2-5.5M20 21a8 8 0 0 0-2-5.5" />
        <line x1="22" x2="2" y1="11" y2="11" />
        <line x1="22" x2="2" y1="5" y2="5" />
        <circle cx="12" cy="5" r="3" />
      </svg>
    )),
  },
]

const learningItems = [
  {
    title: "Courses",
    url: "/courses",
    icon: React.forwardRef<
      SVGSVGElement,
      React.ComponentProps<"svg">
    >(({ className, ...props }, ref) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        ref={ref}
        {...props}
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    )),
  },
  {
    title: "Career Pathway",
    url: "/career-pathway",
    icon: React.forwardRef<
      SVGSVGElement,
      React.ComponentProps<"svg">
    >(({ className, ...props }, ref) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        ref={ref}
        {...props}
      >
        <path d="M2 3h6a4 4 0 0 1 4 4v14a2 2 0 0 0-2-2H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a2 2 0 0 1 2-2h6z" />
      </svg>
    )),
  },
  {
    title: "Data Blueprint",
    url: "/data-blueprint",
    icon: React.forwardRef<
      SVGSVGElement,
      React.ComponentProps<"svg">
    >(({ className, ...props }, ref) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        ref={ref}
        {...props}
      >
        <rect width="7" height="7" x="2" y="2" rx="1" />
        <rect width="7" height="7" x="15" y="2" rx="1" />
        <rect width="7" height="7" x="2" y="15" rx="1" />
        <path d="M15 15h7v7h-7z" />
      </svg>
    )),
  },
]

const portfolioItems = [
  {
    title: "Portfolio Explorer",
    url: "/portfolio-explorer",
    icon: React.forwardRef<
      SVGSVGElement,
      React.ComponentProps<"svg">
    >(({ className, ...props }, ref) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        ref={ref}
        {...props}
      >
        <rect width="13" height="13" x="3" y="3" rx="2" ry="2" />
        <path d="m7 7v1m0 4v1m4-5v1m0 4v1" />
        <path d="M22 18H10V5h12z" />
      </svg>
    )),
  },
  {
    title: "Forums",
    url: "/forums",
    icon: React.forwardRef<
      SVGSVGElement,
      React.ComponentProps<"svg">
    >(({ className, ...props }, ref) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        ref={ref}
        {...props}
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M7 9h8" />
        <path d="M7 12h5" />
      </svg>
    )),
  },
  {
    title: "Community",
    url: "/community",
    icon: React.forwardRef<
      SVGSVGElement,
      React.ComponentProps<"svg">
    >(({ className, ...props }, ref) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        ref={ref}
        {...props}
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="22" x2="14" y1="11" y2="11" />
        <path d="M18 16v-2a2 2 0 0 0-2-2H3" />
      </svg>
    )),
  },
]

const personalItems = [
  {
    title: "Profile",
    url: "/profile",
    icon: React.forwardRef<
      SVGSVGElement,
      React.ComponentProps<"svg">
    >(({ className, ...props }, ref) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        ref={ref}
        {...props}
      >
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )),
  },
  {
    title: "Settings",
    url: "/settings",
    icon: React.forwardRef<
      SVGSVGElement,
      React.ComponentProps<"svg">
    >(({ className, ...props }, ref) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        ref={ref}
        {...props}
      >
        <path d="M12.22 2.16l-.41.2a5 5 0 0 0-1.08.5A5 5 0 0 0 8 5h-1a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h1a5 5 0 0 0 0 2h-1a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h1a5 5 0 0 0 1.08.5 5 5 0 0 0 1.08.5l.41.2" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )),
  },
]

const adminItems = [
  {
    title: "Users",
    url: "/admin/users",
    icon: React.forwardRef<
      SVGSVGElement,
      React.ComponentProps<"svg">
    >(({ className, ...props }, ref) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        ref={ref}
        {...props}
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="22" x2="16" y1="11" y2="11" />
      </svg>
    )),
  },
  {
    title: "Courses",
    url: "/admin/courses",
    icon: React.forwardRef<
      SVGSVGElement,
      React.ComponentProps<"svg">
    >(({ className, ...props }, ref) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        ref={ref}
        {...props}
      >
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <line x1="9" x2="15" y1="9" y2="9" />
        <line x1="9" x2="15" y1="15" y2="15" />
      </svg>
    )),
  },
]

export default function AppSidebar() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <Sidebar variant="inset" data-sidebar="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Brain className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Insights Collective</span>
                  <span className="truncate text-xs">Data Career Platform</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Career Tools Section */}
        <SidebarGroup data-tour="career-tools">
          <SidebarGroupLabel>Career Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {careerToolsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Learning Resources Section */}
        <SidebarGroup data-tour="learning-resources">
          <SidebarGroupLabel>Learning Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {learningItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Portfolio & Community Section */}
        <SidebarGroup data-tour="portfolio-community">
          <SidebarGroupLabel>Portfolio & Community</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {portfolioItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Personal Management Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Personal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {personalItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Section */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.url}
                    >
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        {user ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="rounded-lg">
                        {user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user.name}</span>
                      <span className="truncate text-xs">{user.email}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="bottom"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback className="rounded-lg">
                          {user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{user.name}</span>
                        <span className="truncate text-xs">{user.email}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => navigate('/profile')}>
                      <BadgeCheck />
                      Account
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/settings')}>
                      <Settings />
                      Settings
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/login">
                  <LogIn />
                  <span>Login</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
