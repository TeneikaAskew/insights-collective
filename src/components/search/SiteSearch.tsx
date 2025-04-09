
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { mockService } from '@/lib/mock';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { allAssistants } from '@/data/assistantData';

type SearchResult = {
  id: string;
  title: string;
  description?: string;
  url: string;
  type: 'course' | 'resource' | 'assistant' | 'event' | 'career' | 'blueprint';
};

const SiteSearch = () => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Search across multiple data sources
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

  const searchResults = getSearchResults(searchQuery);

  // Create a map to group results by type
  const groupedResults = searchResults.reduce<Record<string, SearchResult[]>>((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {});

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

  // Keyboard shortcut to open search dialog
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelectItem = (item: SearchResult) => {
    setOpen(false);
    navigate(item.url);
  };

  return (
    <>
      <div 
        className="flex flex-1 relative cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search entire site... (Press ⌘K)"
          className="w-full pl-8 bg-background cursor-pointer"
          readOnly
        />
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search across the platform..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {Object.keys(groupedResults).map((type) => (
            <CommandGroup key={type} heading={getGroupLabel(type)}>
              {groupedResults[type].map((result) => (
                <CommandItem
                  key={`${result.type}-${result.id}`}
                  onSelect={() => handleSelectItem(result)}
                >
                  <div className="flex flex-col">
                    <span>{result.title}</span>
                    {result.description && (
                      <span className="text-xs text-muted-foreground truncate max-w-md">
                        {result.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
};

export default SiteSearch;
