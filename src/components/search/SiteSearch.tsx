
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { mockService } from '@/lib/mock';
import { allAssistants } from '@/data/assistantData';

type SearchResult = {
  id: string;
  title: string;
  description?: string;
  url: string;
  type: 'course' | 'resource' | 'assistant' | 'event' | 'career' | 'blueprint';
};

const SiteSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Search across multiple data sources - memoized for performance
  const getSearchResults = (query: string): SearchResult[] => {
    if (!query || query.length < 2) return [];
    
    const searchLower = query.toLowerCase();
    const results: SearchResult[] = [];
    
    // Search courses
    const courses = mockService.getAllCourses();
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

    // Search events
    const events = mockService.getEvents();
    events.forEach(event => {
      if (
        event.title.toLowerCase().includes(searchLower) ||
        event.description.toLowerCase().includes(searchLower)
      ) {
        results.push({
          id: event.id,
          title: event.title,
          description: event.description,
          url: `/events#${event.id}`,
          type: 'event'
        });
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

    // Data Blueprint Series
    const blueprintEntries = [
      {
        id: "1",
        title: "What Is Data Science?",
        url: "/resources/data-blueprint/what-is-data-science",
      },
      {
        id: "2",
        title: "Core Roles in a Data Team",
        url: "/resources/data-blueprint/core-roles",
      },
      {
        id: "3",
        title: "The Data Science Lifecycle",
        url: "/resources/data-blueprint/lifecycle",
      },
      {
        id: "4",
        title: "How to Start a Career in Data Science",
        url: "/resources/data-blueprint/start-career",
      },
      {
        id: "5",
        title: "Responsible AI & Ethics in Data Science",
        url: "/resources/data-blueprint/responsible-ai",
      },
      {
        id: "6",
        title: "Wisdom From the Field – Career Lessons",
        url: "/resources/data-blueprint/career-lessons",
      },
      {
        id: "7",
        title: "Tools of the Trade",
        url: "/resources/data-blueprint/tools",
      },
      {
        id: "8",
        title: "Data Science Career Paths",
        url: "/resources/data-blueprint/career-paths",
      },
      {
        id: "9",
        title: "Resume & Portfolio Tips", 
        url: "/resources/data-blueprint/resume-portfolio",
      },
      {
        id: "10",
        title: "Case Studies That Inspire",
        url: "/resources/data-blueprint/case-studies",
      }
    ];

    blueprintEntries.forEach(entry => {
      if (entry.title.toLowerCase().includes(searchLower)) {
        results.push({
          id: entry.id,
          title: entry.title,
          url: entry.url,
          type: 'blueprint'
        });
      }
    });

    // Data Career Roles
    const careerRoles = [
      { id: "data-analyst", title: "Data Analyst" },
      { id: "data-scientist", title: "Data Scientist" },
      { id: "data-engineer", title: "Data Engineer" },
      { id: "machine-learning-engineer", title: "Machine Learning Engineer" },
      { id: "analytics-engineer", title: "Analytics Engineer" },
      { id: "data-product-manager", title: "Data Product Manager" }
    ];

    careerRoles.forEach(role => {
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
      case 'blueprint': return 'Data Blueprint';
      case 'career': return 'Data Careers';
      case 'resource': return 'Resources';
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
        <Input
          type="search"
          placeholder="Search entire site... (Press ⌘K)"
          className="w-full pl-8 bg-background"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={() => setIsSearching(true)}
        />
        
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
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                      onClick={() => handleSelectItem(result)}
                    >
                      <div className="flex flex-col">
                        <span>{result.title}</span>
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
