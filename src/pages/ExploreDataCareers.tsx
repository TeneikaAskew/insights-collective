import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, ChevronDown, Briefcase, LineChart, Database, Monitor, Brain } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RoleCard } from '@/components/careers/RoleCard';
import { RoleTable } from '@/components/careers/RoleTable';
import { CareerRoleDetails } from '@/components/careers/CareerRoleDetails';
import { WageBandLegend } from '@/components/careers/WageBand';
import { useCareerRoleWages } from '@/hooks/useCareerRoleWages';
import { dataCareerRoles } from '@/data/dataCareerRoles';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const ExploreDataCareers = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [skillFilters, setSkillFilters] = useState<string[]>([]);
  const [salaryFilter, setSalaryFilter] = useState('all');
  const [visibleRoles, setVisibleRoles] = useState(9);
  const [sortKey, setSortKey] = useState('title');
  /** One dialog for the page, so all three views open the same instance. */
  const [openRoleId, setOpenRoleId] = useState<string | null>(null);
  const {
    bySlug: wagesBySlug,
    citation: wageCitation,
    isPending: wagesPending,
    isError: wagesFailed,
  } = useCareerRoleWages();
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
        // Open the role rather than scrolling to it. The list is paginated, so
        // #role-data-analyst is usually not in the DOM at all — the quiz's
        // "Explore … Careers" links (six call sites across QuizResults,
        // QuizResultsSection and SiteSearch) landed silently at the top of an
        // unrelated list. Opening the dialog does not depend on where the role
        // falls in the current page.
        setOpenRoleId(roleId);
      }
    }
  }, [searchParams]);
  const categories = ['all', 'AI/ML', 'Analytics', 'Data Engineering', 'Business Intelligence'];
  const allSkills = Array.from(new Set(dataCareerRoles.flatMap(role => role.skills ? Array.isArray(role.skills) ? role.skills : [] : []))).sort();
  // Filters on the BLS median for the occupation this role maps to. The previous
  // version regex-scraped dollar amounts out of the description prose and
  // averaged whatever it found, which is why the filter behaved unpredictably —
  // a role whose prose happened to mention "3,000 rows" was filtered on that.
  //
  // Only the in-flight render is exempt. Once the query has settled, a role with
  // no median does NOT match a specific band; it is excluded, and the notice
  // below says the figures are unavailable. Matching everything after settle
  // would let a failed request read as "every role earns over $120k" — wrong,
  // and indistinguishable from a deliberate result.
  const matchesSalaryFilter = (roleId: string, filter: string) => {
    // "All Salary Ranges" makes no claim about pay, so it needs no data.
    if (filter === 'all' || wagesPending) return true;
    const median = wagesBySlug.get(roleId)?.median;
    if (median === undefined) return false;
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
    const matchesSalary = matchesSalaryFilter(role.id, salaryFilter);
    return matchesSearch && matchesCategory && matchesSkills && matchesSalary;
  }).sort((a, b) => {
    // Median pay and US jobs both come from the BLS row, so without it there is
    // nothing to order by — `?? 0` would produce an arbitrary order presented as
    // "sorted by pay". Fall back to the name; the Sort control disables those
    // two options so the state cannot be selected in the first place.
    if (sortKey === 'title' || wagesFailed) return a.title.localeCompare(b.title);
    const av = wagesBySlug.get(a.id)?.[sortKey as 'median' | 'employment'] ?? 0;
    const bv = wagesBySlug.get(b.id)?.[sortKey as 'median' | 'employment'] ?? 0;
    return bv - av;
  });
  const rolesByCategory = categories.reduce((acc, category) => {
    if (category !== 'all') {
      acc[category] = dataCareerRoles.filter(role => role.category.split(',').some(cat => cat.trim() === category));
    }
    return acc;
  }, {} as Record<string, typeof dataCareerRoles>);
  const toggleSkillFilter = (skill: string) => {
    setSkillFilters(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]);
  };
  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSkillFilters([]);
    setSalaryFilter('all');
  };
  const hasActiveFilters =
    searchQuery !== '' || selectedCategory !== 'all' || skillFilters.length > 0 || salaryFilter !== 'all';
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
        return <Brain className="h-4 w-4" aria-hidden="true" />;
      case 'Analytics':
        return <LineChart className="h-4 w-4" aria-hidden="true" />;
      case 'Data Engineering':
        return <Database className="h-4 w-4" aria-hidden="true" />;
      case 'Business Intelligence':
        return <Monitor className="h-4 w-4" aria-hidden="true" />;
      default:
        return <Briefcase className="h-4 w-4" aria-hidden="true" />;
    }
  };
  const railLabel = 'text-xs font-semibold uppercase tracking-wider text-muted-foreground';
  return <AppLayout fullWidth>
      <div className="ss-wash min-h-full">
        <div className="container mx-auto py-10 px-4 space-y-8">
          <motion.div initial={{
          opacity: 0,
          y: -20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.5
        }} className="space-y-2">
            <h1 className="text-4xl tracking-tight">Explore Careers</h1>
            <p className="text-xl text-muted-foreground max-w-3xl">
              Browse real-world roles across data science, analytics, engineering, and AI —{' '}
              <span className="ss-serif text-ss-peach-deep">see which one fits you</span>.
            </p>
            {/* Pay is only shown on this page because of this citation. */}
            {wageCitation && <p className="text-sm text-muted-foreground max-w-3xl">
                Pay ranges show the middle half of earners (25th–75th percentile), national and cross-industry, from{' '}
                <a href={wageCitation.url} target="_blank" rel="noreferrer noopener" className="underline hover:text-foreground">
                  {wageCitation.source}
                </a>
                , {wageCitation.referencePeriod}. Each role is mapped to the closest BLS occupation, named on the role.
              </p>}
            {/* Says so, rather than rendering roles that silently carry no pay.
                The salary filter and the pay sort options are disabled while
                this is showing. */}
            {wagesFailed && <p role="status" data-testid="wages-unavailable" className="text-sm text-ss-bad max-w-3xl">
                Pay figures could not be loaded, so salary filtering and sorting are unavailable. Everything else on this page still works.
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
          }} className="hidden md:block min-w-0 space-y-6">
              <div className="ss-card bg-card p-5 space-y-5">
                <div className="space-y-3">
                  <h3 className={railLabel}>Search &amp; Filter</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input aria-label="Search roles" placeholder="Search roles..." className="pl-10 rounded-xl" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className={railLabel}>Category</h3>
                  <div className="space-y-1">
                    {categories.map(category => <div key={category} className="flex items-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`justify-start w-full rounded-xl ${selectedCategory === category ? 'bg-accent text-accent-foreground font-semibold hover:bg-accent' : 'text-foreground'}`}
                          onClick={() => setSelectedCategory(category)}
                        >
                          {category !== 'all' && <CategoryIcon category={category} />}
                          <span className={`ml-2 ${category === 'all' ? 'ml-0' : ''}`}>
                            {category === 'all' ? 'All Categories' : category}
                          </span>
                        </Button>
                      </div>)}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className={railLabel}>Top Skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {allSkills.slice(0, 10).map(skill => <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkillFilter(skill)}
                        aria-pressed={skillFilters.includes(skill)}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          skillFilters.includes(skill)
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}
                      >
                        {skill}
                      </button>)}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className={railLabel}>Salary Range</h3>
                  <Select value={salaryFilter} onValueChange={setSalaryFilter} disabled={wagesFailed}>
                    <SelectTrigger aria-label="Salary Range" className="rounded-xl">
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

                {hasActiveFilters && <Button variant="outline" className="w-full rounded-full" onClick={clearAllFilters}>
                    Clear All Filters
                  </Button>}
              </div>

              <div className="ss-card bg-card p-5 space-y-4">
                <h3 className={railLabel}>Career Resources</h3>
                {/* All four used to point at routes with no <Route>, so every
                    one fell through to NotFound: /resources/salary-guide,
                    /career-pathway/skills-assessment, /career-pathway/planner
                    and /resources/interview-prep. These are the real pages, and
                    each link is now named after the page it opens. */}
                <div className="space-y-3">
                  <Button variant="link" className="justify-start p-0 h-auto" asChild>
                    <a href="/career-agent">Take the Career Assessment</a>
                  </Button>
                  <Button variant="link" className="justify-start p-0 h-auto" asChild>
                    <a href="/career-pathway">Your Career Report</a>
                  </Button>
                  <Button variant="link" className="justify-start p-0 h-auto" asChild>
                    <a href="/interview-prep">Interview Preparation</a>
                  </Button>
                  <Button variant="link" className="justify-start p-0 h-auto" asChild>
                    <a href="/resources">All Resources</a>
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
                  <Input aria-label="Search roles (mobile)" placeholder="Search roles..." className="pl-10 rounded-xl" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <div className="flex justify-between gap-2">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger aria-label="Category (mobile)" className="rounded-xl">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => <SelectItem key={category} value={category}>
                          {category === 'all' ? 'All Categories' : category}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={salaryFilter} onValueChange={setSalaryFilter} disabled={wagesFailed}>
                    <SelectTrigger aria-label="Salary Range (mobile)" className="rounded-xl">
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
          }} className="md:col-span-4 min-w-0">
              <Tabs defaultValue="list" className="space-y-6">
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <TabsList className="bg-transparent gap-1 p-0">
                    <TabsTrigger value="list" data-testid="view-list" className="rounded-full px-4 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none">List View</TabsTrigger>
                    <TabsTrigger value="grid" data-testid="view-grid" className="rounded-full px-4 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none">Grid View</TabsTrigger>
                    <TabsTrigger value="categories" data-testid="view-categories" className="rounded-full px-4 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none">By Category</TabsTrigger>
                  </TabsList>
                  <div className="flex items-center gap-3 ml-auto">
                    <div className="flex items-center gap-2">
                      <label htmlFor="sort-roles" className="text-sm text-muted-foreground">Sort</label>
                      <Select value={sortKey} onValueChange={setSortKey}>
                        <SelectTrigger id="sort-roles" aria-label="Sort" className="w-[150px] rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="title">Role name</SelectItem>
                          <SelectItem value="median" disabled={wagesFailed}>Median pay</SelectItem>
                          <SelectItem value="employment" disabled={wagesFailed}>US jobs</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <span className="text-sm text-muted-foreground tabular-nums" data-testid="role-count">
                      {filteredRoles.length} role{filteredRoles.length !== 1 ? 's' : ''} found
                    </span>
                  </div>
                </div>

                {/* One key for the strip, rather than repeating it per role. */}
                <WageBandLegend />

                <TabsContent value="list" className="space-y-6">
                  {filteredRoles.length > 0 ? <>
                      <RoleTable
                        roles={filteredRoles.slice(0, visibleRoles)}
                        wagesBySlug={wagesBySlug}
                        onOpenRole={setOpenRoleId}
                      />
                      {visibleRoles < filteredRoles.length && <div className="flex justify-center pt-4">
                          <Button onClick={handleLoadMore} variant="outline" className="group rounded-full">
                            Load More
                            <ChevronDown className="ml-2 h-4 w-4 transition-transform group-hover:translate-y-1" />
                          </Button>
                        </div>}
                    </> : <div className="text-center py-12 ss-card bg-card">
                      <Briefcase className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
                      <h3 className="text-xl font-medium mb-2">No roles match your search</h3>
                      <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
                      <Button variant="outline" className="mt-4 rounded-full" onClick={clearAllFilters}>
                        Clear All Filters
                      </Button>
                    </div>}
                </TabsContent>

                <TabsContent value="grid" className="space-y-6">
                  {filteredRoles.length > 0 ? <>
                      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredRoles.slice(0, visibleRoles).map(role => <motion.div key={role.id} variants={itemVariants}>
                            <RoleCard role={role} wage={wagesBySlug.get(role.id)} onOpenRole={setOpenRoleId} />
                          </motion.div>)}
                      </motion.div>

                      {visibleRoles < filteredRoles.length && <div className="flex justify-center pt-4">
                          <Button onClick={handleLoadMore} variant="outline" className="group rounded-full">
                            Load More
                            <ChevronDown className="ml-2 h-4 w-4 transition-transform group-hover:translate-y-1" />
                          </Button>
                        </div>}
                    </> : <div className="text-center py-12 ss-card bg-card">
                      <Briefcase className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
                      <h3 className="text-xl font-medium mb-2">No roles match your search</h3>
                      <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
                      <Button variant="outline" className="mt-4 rounded-full" onClick={clearAllFilters}>
                        Clear All Filters
                      </Button>
                    </div>}
                </TabsContent>

                <TabsContent value="categories" className="space-y-10">
                  {Object.entries(rolesByCategory).map(([category, roles]) => <motion.div key={category} initial={{
                  opacity: 0,
                  y: 20
                }} animate={{
                  opacity: 1,
                  y: 0
                }} transition={{
                  duration: 0.5
                }} className="space-y-4">
                      <div className="flex items-baseline gap-3 border-b pb-3">
                        <div className="rounded-xl bg-accent p-2 text-accent-foreground self-center">
                          <CategoryIcon category={category} />
                        </div>
                        <h2 className="text-2xl">{category}</h2>
                        <span className="text-sm text-muted-foreground tabular-nums">{roles.length} roles</span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {roles.map(role => <RoleCard key={role.id} role={role} wage={wagesBySlug.get(role.id)} onOpenRole={setOpenRoleId} />)}
                      </div>
                    </motion.div>)}
                </TabsContent>
              </Tabs>
            </motion.div>
          </div>
        </div>

        {/* Mounted once for the page and driven by id, so all three views open
            the same instance rather than the grid mounting one Dialog per card. */}
        <Dialog open={openRoleId !== null} onOpenChange={open => !open && setOpenRoleId(null)}>
          {/* `[&>button]:hidden` drops DialogContent's own close X. RoleHeader
              already renders one at the same `top-4 right-4`, so the two stacked
              into a doubled glyph. Keeping RoleHeader's: it carries the rounded
              treatment and the onClose the dialog is driven by. Esc still closes. */}
          <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-4xl w-[95vw] [&>button]:hidden">
            {openRoleId && (() => {
              const role = dataCareerRoles.find(r => r.id === openRoleId);
              if (!role) return null;
              return <>
                {/* The visible title lives inside CareerRoleDetails' own header;
                    Radix still needs an accessible name and description here. */}
                <DialogTitle className="sr-only">{role.title}</DialogTitle>
                <DialogDescription className="sr-only">{role.shortDescription}</DialogDescription>
                <CareerRoleDetails
                  role={role}
                  wage={wagesBySlug.get(role.id)}
                  onClose={() => setOpenRoleId(null)}
                  // Following a similar role swaps this same dialog over to it,
                  // so the reader keeps browsing without a close/reopen round trip.
                  onSelectRole={setOpenRoleId}
                />
              </>;
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>;
};
export default ExploreDataCareers;
