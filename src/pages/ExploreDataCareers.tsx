import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, ChevronDown, Briefcase, LineChart, Database, Monitor, Brain } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RoleCard } from '@/components/careers/RoleCard';
import { dataCareerRoles } from '@/data/dataCareerRoles';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const ExploreDataCareers = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [skillFilters, setSkillFilters] = useState<string[]>([]);
  const [salaryFilter, setSalaryFilter] = useState('all');
  const [visibleRoles, setVisibleRoles] = useState(6);
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
  const matchesSalaryFilter = (role: typeof dataCareerRoles[0], filter: string) => {
    if (!role) return false;

    // Get salary range from the longDescription or shortDescription
    // Try to extract numbers from these fields if needed
    const salaryText = role.longDescription || role.shortDescription || '';
    const numbers = salaryText.match(/\d+k|\$\d+,\d+|\d+,\d+|\$\d+k/g);
    if (!numbers || numbers.length < 1) return true; // If no salary info found, include it in results

    // Estimate an average salary based on extracted numbers
    const cleanNumbers = numbers.map(num => parseInt(num.replace(/[$,k]/g, '')) * (num.includes('k') ? 1000 : 1));
    const avgSalary = cleanNumbers.reduce((a, b) => a + b, 0) / cleanNumbers.length;
    switch (filter) {
      case 'under-80k':
        return avgSalary < 80000;
      case '80k-120k':
        return avgSalary >= 80000 && avgSalary <= 120000;
      case 'over-120k':
        return avgSalary > 120000;
      default:
        return true;
    }
  };
  const filteredRoles = dataCareerRoles.filter(role => {
    const matchesSearch = role.title.toLowerCase().includes(searchQuery.toLowerCase()) || role.shortDescription.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || role.category.split(',').some(cat => cat.trim() === selectedCategory);
    const matchesSkills = skillFilters.length === 0 || role.skills && skillFilters.every(skill => Array.isArray(role.skills) && role.skills.includes(skill));
    const matchesSalary = salaryFilter === 'all' || matchesSalaryFilter(role, salaryFilter);
    return matchesSearch && matchesCategory && matchesSkills && matchesSalary;
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
  return <AppLayout>
      <div className="ss-wash">
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
          }} className="hidden md:block space-y-6">
              <div className="ss-card bg-card p-5 space-y-5">
                <div className="space-y-3">
                  <h3 className={railLabel}>Search &amp; Filter</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search roles..." className="pl-10 rounded-xl" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
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
                  <Select value={salaryFilter} onValueChange={setSalaryFilter}>
                    <SelectTrigger className="rounded-xl">
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
                <div className="space-y-3">
                  <Button variant="link" className="justify-start p-0 h-auto" asChild>
                    <a href="/resources/salary-guide">Salary Guide 2025</a>
                  </Button>
                  <Button variant="link" className="justify-start p-0 h-auto" asChild>
                    <a href="/career-pathway/skills-assessment">Skills Assessment</a>
                  </Button>
                  <Button variant="link" className="justify-start p-0 h-auto" asChild>
                    <a href="/career-pathway/planner">Career Path Planner</a>
                  </Button>
                  <Button variant="link" className="justify-start p-0 h-auto" asChild>
                    <a href="/resources/interview-prep">Interview Preparation</a>
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
                  <Input placeholder="Search roles..." className="pl-10 rounded-xl" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <div className="flex justify-between gap-2">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => <SelectItem key={category} value={category}>
                          {category === 'all' ? 'All Categories' : category}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={salaryFilter} onValueChange={setSalaryFilter}>
                    <SelectTrigger className="rounded-xl">
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
              <Tabs defaultValue="grid" className="space-y-6">
                <div className="flex justify-between items-center">
                  <TabsList className="bg-transparent gap-1 p-0">
                    <TabsTrigger value="grid" className="rounded-full px-4 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none">Grid View</TabsTrigger>
                    <TabsTrigger value="categories" className="rounded-full px-4 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none">By Category</TabsTrigger>
                  </TabsList>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {filteredRoles.length} role{filteredRoles.length !== 1 ? 's' : ''} found
                  </span>
                </div>

                <TabsContent value="grid" className="space-y-6">
                  {filteredRoles.length > 0 ? <>
                      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredRoles.slice(0, visibleRoles).map(role => <motion.div key={role.id} variants={itemVariants}>
                            <RoleCard role={role} />
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
                        {roles.map(role => <RoleCard key={role.id} role={role} />)}
                      </div>
                    </motion.div>)}
                </TabsContent>
              </Tabs>
            </motion.div>
          </div>
        </div>
      </div>
    </AppLayout>;
};
export default ExploreDataCareers;
