import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Search, Filter, ChevronDown, Briefcase, List, LayoutGrid, LineChart, Database, Monitor, Brain } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RoleCard } from '@/components/careers/RoleCard';
import { dataCareerRoles } from '@/data/dataCareerRoles';
import { useCareerRoleWages } from '@/hooks/useCareerRoleWages';
import { RoleTable } from '@/components/careers/RoleTable';
import { CareerRoleDetails } from '@/components/careers/CareerRoleDetails';
import { WageBandLegend } from '@/components/careers/WageBand';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const ExploreDataCareers = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [skillFilters, setSkillFilters] = useState<string[]>([]);
  const [salaryFilter, setSalaryFilter] = useState('all');
  const [visibleRoles, setVisibleRoles] = useState(9);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [sortKey, setSortKey] = useState('title');
  // One dialog for the page, shared by both views.
  const [openRoleId, setOpenRoleId] = useState<string | null>(null);
  const { bySlug: wagesBySlug, citation: wageCitation } = useCareerRoleWages();
  useEffect(() => {
    const roleId = searchParams.get('role');
    const category = searchParams.get('category');
    if (category && ['AI/ML', 'Analytics', 'Data Engineering', 'Business Intelligence'].includes(category)) {
      setSelectedCategory(category);
    } else {
      setSelectedCategory('all');
    }
    if (roleId) {
      const role = dataCareerRoles.find(r => r.id === roleId);
      if (role) {
        setTimeout(() => {
          const element = document.getElementById(`role-${roleId}`);
          if (element) {
            element.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }
        }, 300);
      }
    }
  }, [searchParams]);
  const categories = ['all', 'AI/ML', 'Analytics', 'Data Engineering', 'Business Intelligence'];
  const allSkills = Array.from(new Set(dataCareerRoles.flatMap(role => role.skills ? Array.isArray(role.skills) ? role.skills : [] : []))).sort();
  // Filters on the BLS median for the occupation this role maps to. The previous
  // version regex-scraped dollar amounts out of the description prose and
  // averaged whatever it found, which is why the filter behaved unpredictably.
  // Every role has a median once loaded; the guard covers the in-flight render,
  // where filtering on an empty map would blank the whole list.
  const matchesSalaryFilter = (roleId: string, filter: string) => {
    const median = wagesBySlug.get(roleId)?.median;
    if (median === undefined) return true;
    switch (filter) {
      case 'under-80k':
        return median < 80000;
      case '80k-120k':
        return median >= 80000 && median <= 120000;
      case 'over-120k':
        return median > 120000;
      default:
        return true;
    }
  };
  const filteredRoles = dataCareerRoles.filter(role => {
    const matchesSearch = role.title.toLowerCase().includes(searchQuery.toLowerCase()) || role.shortDescription.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || role.category.split(',').some(cat => cat.trim() === selectedCategory);
    const matchesSkills = skillFilters.length === 0 || role.skills && skillFilters.every(skill => Array.isArray(role.skills) && role.skills.includes(skill));
    const matchesSalary = salaryFilter === 'all' || matchesSalaryFilter(role.id, salaryFilter);
    return matchesSearch && matchesCategory && matchesSkills && matchesSalary;
  }).sort((a, b) => {
    if (sortKey === 'title') return a.title.localeCompare(b.title);
    // Pay and job counts read highest-first; both come from the BLS row.
    const av = wagesBySlug.get(a.id)?.[sortKey as 'median' | 'employment'] ?? 0;
    const bv = wagesBySlug.get(b.id)?.[sortKey as 'median' | 'employment'] ?? 0;
    return bv - av;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSkillFilters([]);
    setSalaryFilter('all');
  };
  const toggleSkillFilter = (skill: string) => {
    setSkillFilters(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]);
  };
  const handleLoadMore = () => {
    setVisibleRoles(prev => Math.min(prev + 6, filteredRoles.length));
  };
  const containerVariants = {
    hidden: {
      opacity: 0
    },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 20
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 100
      }
    }
  };
  const CategoryIcon = ({
    category
  }: {
    category: string;
  }) => {
    switch (category) {
      case 'AI/ML':
        return <Brain className="h-6 w-6" />;
      case 'Analytics':
        return <LineChart className="h-6 w-6" />;
      case 'Data Engineering':
        return <Database className="h-6 w-6" />;
      case 'Business Intelligence':
        return <Monitor className="h-6 w-6" />;
      default:
        return <Briefcase className="h-6 w-6" />;
    }
  };
  return <AppLayout>
      <div className="container mx-auto py-8 px-4 space-y-8">
        <motion.div initial={{
        opacity: 0,
        y: -20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.5
      }} className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-energeticAmber">Explore Careers</h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Browse real-world roles across data science, analytics, engineering, and AI to see which one fits your strengths and interests.
          </p>
          {/* Salary figures on this page are only shown because of this citation. */}
          {wageCitation && <p className="text-sm text-muted-foreground max-w-3xl">
              Pay ranges show the middle half of earners (25th–75th percentile), national and cross-industry, from{' '}
              <a href={wageCitation.url} target="_blank" rel="noreferrer noopener" className="underline hover:text-foreground">
                {wageCitation.source}
              </a>
              , {wageCitation.referencePeriod}. Each role is mapped to the closest BLS occupation, named on the card.
            </p>}
        </motion.div>

        <div className="grid gap-8 md:grid-cols-5">
          <motion.div initial={{
          opacity: 0,
          x: -20
        }} animate={{
          opacity: 1,
          x: 0
        }} transition={{
          duration: 0.5,
          delay: 0.2
        }} className="md:block space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 space-y-5 shadow-md">
              <div className="space-y-3">
                <h3 className="font-medium flex items-center">
                  <Filter className="h-4 w-4 mr-2" />
                  Search & Filter
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search roles..." className="pl-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-medium">Category</h3>
                <div className="space-y-2">
                  {categories.map(category => <div key={category} className="flex items-center">
                      <Button variant={selectedCategory === category ? "default" : "ghost"} size="sm" className={`justify-start w-full ${selectedCategory === category ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setSelectedCategory(category)}>
                        {category !== 'all' && <CategoryIcon category={category} />}
                        <span className={`ml-2 ${category === 'all' ? 'ml-0' : ''}`}>
                          {category === 'all' ? 'All Categories' : category}
                        </span>
                      </Button>
                    </div>)}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-medium">Top Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {allSkills.slice(0, 10).map(skill => <Button key={skill} variant={skillFilters.includes(skill) ? "default" : "outline"} size="sm" onClick={() => toggleSkillFilter(skill)} className="text-xs px-2 py-0 h-7">
                      {skill}
                    </Button>)}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-medium">Salary Range</h3>
                <Select value={salaryFilter} onValueChange={setSalaryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Salary Ranges" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Salary Ranges</SelectItem>
                    <SelectItem value="under-80k">Under $80k</SelectItem>
                    <SelectItem value="80k-120k">$80k - $120k</SelectItem>
                    <SelectItem value="over-120k">Over $120k</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(searchQuery || selectedCategory !== 'all' || skillFilters.length > 0 || salaryFilter !== 'all') && <Button variant="outline" className="w-full" onClick={clearFilters}>
                  Clear All Filters
                </Button>}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 space-y-4 shadow-md">
              <h3 className="font-medium">Career Resources</h3>
              {/* All four links here pointed at routes that do not exist
                  (/resources/salary-guide, /career-pathway/skills-assessment,
                  /career-pathway/planner, /resources/interview-prep) and fell
                  through to the catch-all NotFound. Pointed at the real ones;
                  the salary guide is gone because the pay data is now on the
                  cards themselves. Client-side navigation, not <a href>, so
                  they no longer force a full page reload. */}
              <div className="space-y-3">
                {/* Named after what each page actually is. "Career Path
                    Planner" and "Skills Assessment" were labels for pages that
                    were never built. */}
                <Button variant="link" className="justify-start p-0 h-auto" asChild>
                  <Link to="/career-agent">Take the Career Assessment</Link>
                </Button>
                <Button variant="link" className="justify-start p-0 h-auto" asChild>
                  <Link to="/career-pathway">Your Career Report</Link>
                </Button>
                <Button variant="link" className="justify-start p-0 h-auto" asChild>
                  <Link to="/interview-prep">Interview Preparation</Link>
                </Button>
                <Button variant="link" className="justify-start p-0 h-auto" asChild>
                  <Link to="/resources">All Resources</Link>
                </Button>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.5,
          delay: 0.2
        }} className="md:hidden space-y-4">
            <div className="flex flex-col gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search roles..." className="pl-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <div className="flex justify-between gap-2">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => <SelectItem key={category} value={category}>
                        {category === 'all' ? 'All Categories' : category}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={salaryFilter} onValueChange={setSalaryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Salary" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ranges</SelectItem>
                    <SelectItem value="under-80k">Under $80k</SelectItem>
                    <SelectItem value="80k-120k">$80k - $120k</SelectItem>
                    <SelectItem value="over-120k">Over $120k</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>
          
          <motion.div initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} transition={{
          duration: 0.5,
          delay: 0.4
        }} className="md:col-span-4">
            <div className="space-y-5">
              <div className="flex items-center gap-3 flex-wrap">
                {/* List and Grid are two readings of the same filtered set:
                    List compares pay across many roles at once, Grid gives each
                    role room to describe itself. "By Category" is gone — the
                    Category filter in the sidebar already does that, and it
                    ignored the filters entirely. */}
                <div className="inline-flex gap-1 p-1 rounded-xl border bg-muted/40">
                  <Button
                    size="sm"
                    variant={view === 'list' ? 'default' : 'ghost'}
                    className="gap-2"
                    aria-pressed={view === 'list'}
                    onClick={() => setView('list')}
                  >
                    <List className="h-4 w-4" /> List
                  </Button>
                  <Button
                    size="sm"
                    variant={view === 'grid' ? 'default' : 'ghost'}
                    className="gap-2"
                    aria-pressed={view === 'grid'}
                    onClick={() => setView('grid')}
                  >
                    <LayoutGrid className="h-4 w-4" /> Grid
                  </Button>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <label htmlFor="sort-roles" className="text-sm text-muted-foreground">Sort</label>
                  <Select value={sortKey} onValueChange={setSortKey}>
                    <SelectTrigger id="sort-roles" className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="title">Role name</SelectItem>
                      <SelectItem value="median">Median pay</SelectItem>
                      <SelectItem value="employment">US jobs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <span className="text-sm text-muted-foreground">
                  {filteredRoles.length} role{filteredRoles.length !== 1 ? 's' : ''} found
                </span>
              </div>

              {filteredRoles.length > 0 && <WageBandLegend />}

              {filteredRoles.length === 0 ? <div className="text-center py-12 bg-muted/50 rounded-lg">
                  <Briefcase className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
                  <h3 className="text-xl font-medium mb-2">No roles match your search</h3>
                  <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
                  <Button variant="outline" className="mt-4" onClick={clearFilters}>Clear All Filters</Button>
                </div> : <>
                  {view === 'list' ? <RoleTable
                      roles={filteredRoles.slice(0, visibleRoles)}
                      wagesBySlug={wagesBySlug}
                      onOpenRole={setOpenRoleId}
                    /> : <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredRoles.slice(0, visibleRoles).map(role => <motion.div key={role.id} variants={itemVariants}>
                          <RoleCard role={role} wage={wagesBySlug.get(role.id)} onOpenRole={setOpenRoleId} />
                        </motion.div>)}
                    </motion.div>}

                  {visibleRoles < filteredRoles.length && <div className="flex justify-center pt-4">
                      <Button onClick={handleLoadMore} variant="outline" className="group">
                        Load More
                        <ChevronDown className="ml-2 h-4 w-4 transition-transform group-hover:translate-y-1" />
                      </Button>
                    </div>}
                </>}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Shared detail dialog. Mounted once for the page instead of once per
          card, and driven by id so List and Grid open the same instance. */}
      <Dialog open={openRoleId !== null} onOpenChange={open => !open && setOpenRoleId(null)}>
        <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-4xl w-[95vw]">
          {openRoleId && (() => {
            const role = dataCareerRoles.find(r => r.id === openRoleId);
            if (!role) return null;
            return <>
              {/* Radix needs a title for screen readers; the visible one lives
                  inside RoleHeader, so this is the accessible-name copy. */}
              <DialogTitle className="sr-only">{role.title}</DialogTitle>
              <CareerRoleDetails role={role} wage={wagesBySlug.get(role.id)} onClose={() => setOpenRoleId(null)} />
            </>;
          })()}
        </DialogContent>
      </Dialog>
    </AppLayout>;
};
export default ExploreDataCareers;
