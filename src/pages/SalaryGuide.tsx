// ABOUTME: Public data & AI salary guide built from the BLS OEWS bands already in career_role_wages.
// ABOUTME: Every figure on the page is read live from that view — no hardcoded or invented salary numbers.

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import PageSeo, { SITE_NAME, SITE_URL } from '@/components/seo/PageSeo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import WageBand, { } from '@/components/careers/WageBand';
import { useCareerRoleWages, CareerRoleWage } from '@/hooks/useCareerRoleWages';
import { dataCareerRoles } from '@/data/dataCareerRoles';
import { ArrowRight, BarChart3, Compass, GraduationCap, TrendingUp } from 'lucide-react';

const PATH = '/resources/salary-guide';

const usd = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Roles carry a comma-separated category string; the first one is the primary track. */
const primaryCategory = (row: CareerRoleWage) => row.category.split(',')[0].trim();

const descriptionFor = (slug: string) =>
  dataCareerRoles.find((role) => role.id === slug)?.shortDescription;

const SalaryGuide: React.FC = () => {
  const { rows, citation, isPending, isError } = useCareerRoleWages();

  /**
   * One entry per role, deduplicated by title, sorted by median. Several roles
   * map to the same BLS occupation (Data Engineer and Cloud Data Engineer are
   * both Database Architects), which the occupation column makes explicit.
   */
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.median - a.median),
    [rows],
  );

  const byCategory = useMemo(() => {
    const groups = new Map<string, CareerRoleWage[]>();
    for (const row of sorted) {
      const key = primaryCategory(row);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sorted]);

  const top = sorted[0];
  const entry = useMemo(
    () => (sorted.length ? [...sorted].sort((a, b) => a.pct10 - b.pct10)[0] : undefined),
    [sorted],
  );

  const period = citation?.referencePeriod ?? 'the latest BLS release';

  const jsonLd = useMemo(() => {
    const blocks: Record<string, unknown>[] = [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'Data & AI salary guide',
        description:
          'Salary ranges for data, analytics and AI roles in the United States, using BLS Occupational Employment and Wage Statistics percentiles.',
        url: `${SITE_URL}${PATH}`,
        publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
        isBasedOn: citation?.url,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Resources', item: `${SITE_URL}/resources` },
          { '@type': 'ListItem', position: 3, name: 'Data & AI salary guide', item: `${SITE_URL}${PATH}` },
        ],
      },
    ];

    if (top && entry) {
      blocks.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'How much do data and AI roles pay in the US?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Across the ${sorted.length} roles in this guide, median US pay runs from ${usd(
                sorted[sorted.length - 1].median,
              )} to ${usd(top.median)} a year, based on ${period} BLS Occupational Employment and Wage Statistics for the occupations these roles map to.`,
            },
          },
          {
            '@type': 'Question',
            name: 'Which data or AI role pays the most?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Of the roles covered here, ${top.title} maps to the highest-paying occupation — ${top.occupation_title} (SOC ${top.soc_code}), with a median of ${usd(top.median)} and a 90th percentile of ${usd(top.pct90)}.`,
            },
          },
          {
            '@type': 'Question',
            name: 'What can I expect to earn starting out?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Entry pay is best read off the 10th percentile. The lowest 10th percentile in this guide is ${usd(
                entry.pct10,
              )} for ${entry.title}; most roles here start between ${usd(entry.pct10)} and ${usd(top.pct25)}.`,
            },
          },
        ],
      });
    }

    return blocks;
  }, [citation?.url, entry, period, sorted, top]);

  return (
    <AppLayout>
      <PageSeo
        title="Data & AI Salary Guide (US) — Insights Collective"
        description="What data, analytics and AI roles pay in the US: 10th to 90th percentile salary bands for 20+ roles, sourced from BLS Occupational Employment and Wage Statistics."
        path={PATH}
        type="article"
        jsonLd={jsonLd}
      />

      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-10">
        <header className="space-y-4">
          <Badge variant="secondary" className="gap-1">
            <BarChart3 className="h-3.5 w-3.5" /> Reference data · {period}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Data &amp; AI salary guide</h1>
          <p className="text-muted-foreground max-w-3xl">
            What data, analytics and AI roles actually pay in the United States. Every figure below is the
            wage distribution the U.S. Bureau of Labor Statistics publishes for the occupation each role maps
            to — the 10th percentile as a realistic entry point, the median as the middle of the market, and
            the 90th percentile as what senior and specialist work reaches. No survey estimates, no
            self-reported numbers.
          </p>
        </header>

        {isError && (
          <Alert variant="destructive">
            <AlertTitle>Salary data could not be loaded</AlertTitle>
            <AlertDescription>
              The reference wage data is temporarily unavailable, so no figures are shown rather than
              estimated ones. Please try again shortly.
            </AlertDescription>
          </Alert>
        )}

        {isPending && (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}

        {!isPending && !isError && top && entry && (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Highest median</CardDescription>
                  <CardTitle className="text-2xl">{usd(top.median)}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {top.title} — mapped to {top.occupation_title}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Typical entry point (lowest 10th percentile)</CardDescription>
                  <CardTitle className="text-2xl">{usd(entry.pct10)}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {entry.title} — mapped to {entry.occupation_title}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Roles covered</CardDescription>
                  <CardTitle className="text-2xl">{sorted.length}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Across {byCategory.length} tracks: {byCategory.map(([name]) => name).join(', ')}
                </CardContent>
              </Card>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight">Salary bands by role</h2>
              <p className="text-sm text-muted-foreground max-w-3xl">
                Read a row left to right as a career arc: the 10th percentile is where people entering the
                occupation sit, the 25th–75th percentile box is the bulk of the market, and the 90th
                percentile is senior, specialist or management-track pay.
              </p>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Role</TableHead>
                      <TableHead className="text-right">10th</TableHead>
                      <TableHead className="text-right">25th</TableHead>
                      <TableHead className="text-right">Median</TableHead>
                      <TableHead className="text-right">75th</TableHead>
                      <TableHead className="text-right">90th</TableHead>
                      <TableHead className="min-w-[220px]">BLS occupation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((row) => (
                      <TableRow key={row.slug}>
                        <TableCell className="font-medium">
                          <Link
                            to={`/explore-data-careers?role=${row.slug}`}
                            className="text-primary hover:underline"
                          >
                            {row.title}
                          </Link>
                          <div className="text-xs text-muted-foreground">{primaryCategory(row)}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{usd(row.pct10)}</TableCell>
                        <TableCell className="text-right tabular-nums">{usd(row.pct25)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {usd(row.median)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{usd(row.pct75)}</TableCell>
                        <TableCell className="text-right tabular-nums">{usd(row.pct90)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.occupation_title}
                          <div className="text-xs">SOC {row.soc_code}</div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            {byCategory.map(([category, group]) => (
              <section key={category} className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">{category} salaries</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {group.map((row) => (
                    <Card key={`${category}-${row.slug}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{row.title}</CardTitle>
                        <CardDescription>
                          {descriptionFor(row.slug) ??
                            `Mapped to ${row.occupation_title} (SOC ${row.soc_code}).`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <WageBand wage={row} showOccupation showRange />
                        <p className="text-sm text-muted-foreground">
                          Median {usd(row.median)} · {row.employment.toLocaleString('en-US')} people employed
                          in this occupation nationally.
                        </p>
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/explore-data-careers?role=${row.slug}`}>
                            See the role in detail <ArrowRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">How to move up a band</h2>
          <p className="text-sm text-muted-foreground max-w-3xl">
            The gap between the 25th and 75th percentile inside a single occupation is usually larger than the
            gap between two occupations. In practice that gap is scope: owning a pipeline rather than a query,
            a model in production rather than a notebook, a stakeholder relationship rather than a ticket
            queue. Three things on this site are built around that:
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <Compass className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Pick a target role</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Compare responsibilities, tools and wage bands side by side before you commit.</p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/explore-data-careers">Explore data careers</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Map the steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Turn a target role into a sequence of skills, projects and milestones.</p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/career-pathway">Build a career pathway</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Close the skill gaps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Work through courses that match the skills the higher band asks for.</p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/courses">Browse courses</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">How to read these numbers</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground max-w-3xl">
            <li>
              These are national US figures for all industries and experience levels combined. Pay in major
              metros and in tech-sector employers commonly sits above the national median for the same
              occupation.
            </li>
            <li>
              Job titles in data move faster than statistical classifications, so each role here is mapped to
              the closest BLS occupation and that mapping is shown in every row. Where several roles share an
              occupation, they share a band.
            </li>
            <li>
              Figures are base annual wages. Bonus, equity and profit sharing are not included, which matters
              most at senior levels in tech.
            </li>
            {citation && (
              <li>
                Source:{' '}
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {citation.source}
                </a>
                , {citation.referencePeriod}.
              </li>
            )}
          </ul>
        </section>
      </div>
    </AppLayout>
  );
};

export default SalaryGuide;
