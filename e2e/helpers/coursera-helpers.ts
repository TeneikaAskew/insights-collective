// ABOUTME: Network stubs for the Coursera catalog tables. Specs that assert on
// ABOUTME: recommended courses must stub these reads — the live table is a
// ABOUTME: moving crawl target, and this suite never writes to shared data.

import type { Page } from '@playwright/test';

export interface StubCourseraCourse {
  slug: string;
  url: string;
  title: string;
  partner: string;
  format: string;
  level: string;
  rating: number | null;
  reviews: number | null;
  subjects: string[];
  primary_subjects: string[];
  skills: string[];
  description: string;
  languages: string[];
  is_featured?: boolean;
}

/** Small, deterministic catalog covering the common analytics subjects. */
export const COURSERA_FIXTURE_COURSES: StubCourseraCourse[] = [
  {
    slug: 'e2e-sql-foundations',
    url: 'https://www.coursera.org/learn/e2e-sql-foundations',
    title: 'E2E SQL Foundations',
    partner: 'Fixture University',
    format: 'Course',
    level: 'Beginner',
    rating: 4.8,
    reviews: 12000,
    subjects: ['sql', 'data-analysis'],
    primary_subjects: ['sql'],
    skills: ['SQL'],
    description: 'Deterministic fixture course for SQL.',
    languages: ['en'],
  },
  {
    slug: 'e2e-data-viz',
    url: 'https://www.coursera.org/specializations/e2e-data-viz',
    title: 'E2E Data Visualization',
    partner: 'Fixture Institute',
    format: 'Specialization',
    level: 'Intermediate',
    rating: 4.6,
    reviews: 8000,
    subjects: ['data-visualization', 'business-intelligence'],
    primary_subjects: ['data-visualization'],
    skills: ['Tableau'],
    description: 'Deterministic fixture course for visualization.',
    languages: ['en'],
  },
  {
    slug: 'e2e-statistics',
    url: 'https://www.coursera.org/learn/e2e-statistics',
    title: 'E2E Statistics',
    partner: 'Fixture College',
    format: 'Course',
    level: 'Beginner',
    rating: 4.7,
    reviews: 9500,
    subjects: ['statistics', 'data-analysis'],
    primary_subjects: ['statistics'],
    skills: ['Statistics'],
    description: 'Deterministic fixture course for statistics.',
    languages: ['en'],
  },
];

/**
 * Route both coursera tables to fixtures. GET only — nothing in the app
 * writes to these tables, and this helper must keep it that way.
 *
 * Pass `courses: []` to exercise the genuinely-empty case. There is no bundled
 * fallback any more: an empty database result means no external courses render,
 * which is the honest outcome. To exercise a FAILED read instead, fulfil the
 * route with a 5xx — the consumers show "Couldn't load course recommendations"
 * and a Retry, which is a different state and must not be confused with this one.
 */
export async function stubCourseraCatalog(
  page: Page,
  courses: StubCourseraCourse[] = COURSERA_FIXTURE_COURSES,
): Promise<void> {
  await page.route('**/rest/v1/coursera_courses*', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(courses),
    });
  });
  await page.route('**/rest/v1/coursera_subject_keywords*', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    // The frontend classifies with the bundled subjectKeywords.json, so the
    // table read only exists server-side today — stubbed for completeness so
    // no spec ever depends on the live rows.
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { subject: 'sql', keyword: 'sql' },
        { subject: 'data-visualization', keyword: 'visualization' },
        { subject: 'statistics', keyword: 'statistics' },
      ]),
    });
  });
}
