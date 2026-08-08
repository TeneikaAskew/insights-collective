
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, LineChart, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Line, Cell, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { BarChart2, DollarSign, LineChart as LineIcon, ArrowRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

// Share of 1,355 US data analyst postings on Glassdoor that require each skill.
// Source: 365 Data Science, "Data Analyst Job Outlook 2026".
// https://365datascience.com/career-advice/data-analyst-job-outlook-2025/
const barData = [
  { name: 'SQL', value: 50, color: 'hsl(var(--ss-teal))' },
  { name: 'Excel', value: 41.3, color: 'hsl(var(--ss-lav-deep))' },
  { name: 'Python', value: 33, color: 'hsl(var(--ss-bad))' },
  { name: 'Tableau', value: 28.1, color: 'hsl(var(--ss-warn))' },
  { name: 'Power BI', value: 24.7, color: 'hsl(var(--ss-good))' },
  { name: 'R', value: 20, color: 'hsl(var(--ss-peach-deep))' },
];

const lineData = [
  { month: 'Jan', learners: 4000, completions: 2400 },
  { month: 'Feb', learners: 3000, completions: 1398 },
  { month: 'Mar', learners: 2000, completions: 9800 },
  { month: 'Apr', learners: 2780, completions: 3908 },
  { month: 'May', learners: 1890, completions: 4800 },
  { month: 'Jun', learners: 2390, completions: 3800 },
  { month: 'Jul', learners: 3490, completions: 4300 },
];

// Median annual wage by occupation, United States.
// Source: BLS Occupational Employment and Wage Statistics, May 2025.
// https://www.bls.gov/news.release/ocwage.t01.htm
const payData = [
  { name: 'Database Architect', value: 144440, color: 'hsl(var(--ss-teal))' },
  { name: 'Data Scientist', value: 126800, color: 'hsl(var(--ss-lav-deep))' },
  { name: 'Statistician', value: 115700, color: 'hsl(var(--ss-bad))' },
  { name: 'Database Administrator', value: 110090, color: 'hsl(var(--ss-warn))' },
  { name: 'Operations Research Analyst', value: 99730, color: 'hsl(var(--ss-good))' },
];

const InteractiveShowcase = () => {
  const [activeTab, setActiveTab] = useState('skills');
  const isMobile = useIsMobile();

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 font-display">Data Skills In Demand</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Explore interactive visualizations showing the most in-demand data skills, learning trends, and what data roles pay.
          </p>
        </div>

        <Tabs defaultValue="skills" value={activeTab} onValueChange={setActiveTab} className="max-w-4xl mx-auto">
          <div className="flex justify-center mb-8">
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="skills" className="flex items-center gap-1.5 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
                <BarChart2 className="h-4 w-4 shrink-0" />
                <span className="truncate">Skills</span>
              </TabsTrigger>
              <TabsTrigger value="growth" className="flex items-center gap-1.5 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
                <LineIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">Growth</span>
              </TabsTrigger>
              <TabsTrigger value="pay" className="flex items-center gap-1.5 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
                <DollarSign className="h-4 w-4 shrink-0" />
                <span className="truncate">Pay</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <Card className="border shadow-lg overflow-hidden">
            <CardContent className="p-4 sm:p-6">
              <TabsContent value="skills" className="mt-0">
                <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4">Most In-Demand Data Skills</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-6">
                  Share of 1,355 US data analyst postings requiring each skill. Source:{' '}
                  <a
                    href="https://365datascience.com/career-advice/data-analyst-job-outlook-2025/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    365 Data Science, 2026
                  </a>
                  .
                </p>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={barData}
                      layout="vertical"
                      margin={{ top: 20, right: isMobile ? 20 : 30, left: isMobile ? 0 : 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={{ fontSize: isMobile ? 11 : 12 }}
                        tickFormatter={(value: number) => `${value}%`}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={isMobile ? 60 : 80}
                        tick={{ fontSize: isMobile ? 11 : 12 }}
                      />
                      <Tooltip formatter={(value) => [`${value}%`, 'Market Demand']} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {barData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="growth" className="mt-0">
                <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4">Growth Trends in Data Learning</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-6">
                  Learners and course completions over time. Illustrative sample data.
                </p>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={lineData}
                      margin={{ top: 20, right: isMobile ? 8 : 30, left: isMobile ? 0 : 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: isMobile ? 11 : 12 }} />
                      <YAxis
                        width={isMobile ? 48 : 60}
                        tick={{ fontSize: isMobile ? 11 : 12 }}
                        tickFormatter={(value: number) => (isMobile && value >= 1000 ? `${value / 1000}k` : `${value}`)}
                      />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: isMobile ? 12 : 14 }} />
                      <Line type="monotone" dataKey="learners" stroke="hsl(var(--ss-teal))" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="completions" stroke="hsl(var(--ss-lav-deep))" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="pay" className="mt-0">
                <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4">What Data Roles Pay</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-6">
                  Median annual wage in the US. Source:{' '}
                  <a
                    href="https://www.bls.gov/news.release/ocwage.t01.htm"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    BLS Occupational Employment and Wage Statistics, May 2025
                  </a>
                  .
                </p>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={payData}
                      layout="vertical"
                      /* The $150k tick sits flush against the plot edge, so the right
                         margin has to hold it even on the narrowest screens. */
                      margin={{ top: 20, right: isMobile ? 20 : 30, left: isMobile ? 0 : 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, 150000]}
                        /* Left to itself recharts labels $0/$40k/$80k and then the
                           domain edge, leaving an unlabelled gridline at $120k. */
                        ticks={[0, 50000, 100000, 150000]}
                        tick={{ fontSize: isMobile ? 11 : 12 }}
                        tickFormatter={(value: number) => `$${value / 1000}k`}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={isMobile ? 96 : 150}
                        tick={{ fontSize: isMobile ? 10 : 12 }}
                      />
                      <Tooltip
                        formatter={(value: number) => [`$${value.toLocaleString()}`, 'Median annual wage']}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {payData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>

        <div className="flex justify-center mt-10">
          <Button asChild variant="outline" className="group">
            <Link to="/explore-data-careers" className="flex items-center">
              Explore Career Insights 
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default InteractiveShowcase;
