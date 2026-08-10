import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { usePublishedCourses } from '@/hooks/usePublishedCourses';
import { allAssistants } from '@/data/assistantData';
import { dataCareerRoles } from '@/data/dataCareerRoles';

type SearchResult = {
  id: string;
  title: string;
  description?: string;
  url: string;
  type: 'course' | 'resource' | 'assistant' | 'event' | 'career' | 'page';
};

const SiteSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  // Published courses only. This used to be `useCoursesManagement`, the admin
  // hook — which the Navbar therefore ran on every page, and which filters its
  // result to the viewer's own instructed courses, so a member's search never
  // matched a course at all. See usePublishedCourses for the full note.
  const { courses } = usePublishedCourses();
  const isMobile = useIsMobile();

  // Search across multiple data sources - memoized for performance
  const getSearchResults = (query: string): SearchResult[] => {
    if (!query || query.length < 2) return [];
    
    const searchLower = query.toLowerCase();
    const results: SearchResult[] = [];
    
    // Search courses
    courses.forEach(course => {
      if (
        course.title.toLowerCase().includes(searchLower) ||
        course.description.toLowerCase().includes(searchLower)
      ) {
        results.push({
          id: course.id,
          title: course.title,
          description: course.description,
          url: `/courses/${course.id}`,
          type: 'course'
        });
      }
    });

    // Static site pages
    const pages = [
      { id: 'dashboard', title: 'Dashboard', description: 'Your personal dashboard', url: '/dashboard' },
      { id: 'resources', title: 'Resources', description: 'Browse all learning resources', url: '/resources' },
      { id: 'events', title: 'Events', description: 'Upcoming events and webinars', url: '/events' },
      // No Forum entry. App.tsx redirects /forum, /forums and /forum/:id to
      // /dashboard under "Forums disabled", and it is absent from
      // PAGE_MANIFEST — so searching "forum" advertised a feature that does
      // not exist and dropped the reader on the dashboard.
      { id: 'resume', title: 'Resume Builder', description: 'Build and analyze your resume', url: '/resume' },
      // One Career Pathway row, not two. The same URL appeared twice under the
      // same title, so every search for "career" returned it twice.
      { id: 'career-pathway', title: 'Career Pathway', description: 'AI-powered career guidance', url: '/career-pathway' },
      { id: 'explore-data-careers', title: 'Explore Data Careers', description: 'Browse data career roles', url: '/explore-data-careers' },
      { id: 'assistants', title: 'AI Assistants', description: 'AI-powered learning assistants', url: '/assistants' },
      { id: 'interview-prep', title: 'Interview Prep', description: 'Practice for technical interviews', url: '/interview-prep' },
      { id: 'mock-interviews', title: 'Mock Interviews', description: 'Simulate real interviews', url: '/mock-interviews' },
      { id: 'code-practice', title: 'Code Practice', description: 'Practice coding challenges', url: '/code-practice' },
      { id: 'portfolio-explorer', title: 'Portfolio Explorer', description: 'Browse student portfolios', url: '/portfolio-explorer' },
      { id: 'messages', title: 'Messages', description: 'Your messages', url: '/messages' },
      { id: 'profile', title: 'Profile', description: 'Your profile settings', url: '/profile' },
    ];

    pages.forEach(page => {
      if (
        page.title.toLowerCase().includes(searchLower) ||
        page.description.toLowerCase().includes(searchLower)
      ) {
        results.push({ ...page, type: 'page' });
      }
    });

    // Search assistants
    allAssistants.forEach(assistant => {
      if (
        assistant.name.toLowerCase().includes(searchLower) ||
        assistant.description.toLowerCase().includes(searchLower)
      ) {
        results.push({
          id: assistant.id,
          title: assistant.name,
          description: assistant.description,
          url: `/assistant/${assistant.id}`,
          type: 'assistant'
        });
      }
    });

    // Career roles, read from the catalog the page itself renders.
    //
    // This used to be six roles typed out by hand against a catalog of 33,
    // so 29 were unfindable — and two of the six, `analytics-engineer` and
    // `data-product-manager`, were slugs that no longer existed, so searching
    // them produced a result that deep-linked to nothing.
    dataCareerRoles.forEach(role => {
      if (role.title.toLowerCase().includes(searchLower)) {
        results.push({
          id: role.id,
          title: role.title,
          url: `/explore-data-careers?role=${role.id}`,
          type: 'career'
        });
      }
    });

    return results;
  };

  // Group results by type
  const groupedResults = React.useMemo(() => {
    return results.reduce<Record<string, SearchResult[]>>((acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push(result);
      return acc;
    }, {});
  }, [results]);

  // Get label for each result type
  const getGroupLabel = (type: string): string => {
    switch (type) {
      case 'course': return 'Courses';
      case 'event': return 'Events';
      case 'assistant': return 'Assistants';
      case 'career': return 'Data Careers';
      case 'resource': return 'Resources';
      case 'page': return 'Pages';
      default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (value.length >= 2) {
      setIsSearching(true);
      // Debounce to avoid excessive searches
      const results = getSearchResults(value);
      setResults(results);
    } else {
      setResults([]);
      setIsSearching(false);
    }
  };

  // Handle item selection
  const handleSelectItem = (item: SearchResult) => {
    setSearchQuery('');
    setIsSearching(false);
    setResults([]);
    navigate(item.url);
  };

  // Handle clicking outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearching(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Support keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const input = document.querySelector('input[type="search"]') as HTMLInputElement;
        if (input) {
          input.focus();
          setIsSearching(true);
        }
      }
      
      // Close on escape
      if (e.key === 'Escape' && isSearching) {
        setIsSearching(false);
      }
    };
    
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isSearching]);

  return (
    <div className="flex flex-1 relative" ref={searchRef}>
      <div className="w-full relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        {/* The shortcut used to live in the placeholder, which truncated to
            "Search enti…" at 390px — and a Ctrl/Cmd hint is meaningless on a
            phone anyway. It is a kbd hint now, hidden below `sm`, so the
            placeholder fits on mobile and the shortcut still shows where it
            can be used. */}
        <Input
          type="search"
          placeholder={isMobile ? 'Search…' : 'Search entire site...'}
          aria-label="Search entire site"
          className="w-full pl-8 pr-3 md:pr-16 bg-background"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={() => setIsSearching(true)}
        />
        {/* `md:` and not `sm:`, to match `useIsMobile`'s 768px breakpoint above.
            At `sm:` the hint appeared 128px before the placeholder grew back,
            so 640–767px showed a keyboard shortcut next to "Search…". */}
        <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground md:flex">
          Ctrl/⌘ K
        </kbd>
        
        {isSearching && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-[80vh] overflow-auto">
            {results.length === 0 && searchQuery.length >= 2 && (
              <div className="py-6 text-center text-sm">No results found.</div>
            )}
            
            {Object.keys(groupedResults).map((type) => (
              <div key={type} className="p-2">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {getGroupLabel(type)}
                </div>
                <div className="mt-1">
                  {groupedResults[type].map((result) => (
                    <div
                      key={`${result.type}-${result.id}`}
                      data-testid="search-result"
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                      onClick={() => handleSelectItem(result)}
                    >
                      <div className="flex flex-col">
                        <span data-testid="search-result-title">{result.title}</span>
                        {result.description && (
                          <span className="text-xs text-muted-foreground truncate max-w-md">
                            {result.description}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SiteSearch;
