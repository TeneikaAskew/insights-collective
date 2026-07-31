-- BLS wage reference data, and the mapping from this site's career roles onto it.
--
-- Salary figures shown anywhere on the site must be traceable to a source. This
-- adds that source: `bls_occupations` holds Occupational Employment and Wage
-- Statistics (OEWS) figures published by the U.S. Bureau of Labor Statistics,
-- and `career_roles` maps each of our role slugs onto exactly one BLS occupation
-- via a foreign key, so a role can never display a wage with no provenance.
--
-- Seed values below are the May 2025 national (cross-industry) OEWS estimates,
-- retrieved from the BLS public API on 2026-07-29. They are reproducible: the
-- `bls-wages` edge function refreshes them from the same series IDs.

-- ── Reference: one row per BLS Standard Occupational Classification code ──────

CREATE TABLE IF NOT EXISTS public.bls_occupations (
  soc_code            TEXT PRIMARY KEY,
  occupation_title    TEXT        NOT NULL,

  -- All wages are annual, in whole US dollars, national cross-industry.
  employment          INTEGER,
  annual_mean         INTEGER,
  pct10               INTEGER,
  pct25               INTEGER,
  median              INTEGER,
  pct75               INTEGER,
  pct90               INTEGER,

  -- Provenance. `reference_period` is the OEWS release these figures come from.
  -- 'seed' rows ship with this migration; 'discovered' rows were pulled from the
  -- BLS API on demand when something asked about an occupation we did not hold.
  source              TEXT        NOT NULL DEFAULT 'seed'
                                  CHECK (source IN ('seed', 'discovered')),

  reference_period    TEXT        NOT NULL DEFAULT 'May 2025',
  source_name         TEXT        NOT NULL DEFAULT 'U.S. Bureau of Labor Statistics, Occupational Employment and Wage Statistics',
  source_url          TEXT        NOT NULL DEFAULT 'https://www.bls.gov/oes/',
  retrieved_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT bls_occupations_soc_code_format CHECK (soc_code ~ '^[0-9]{2}-[0-9]{4}$'),
  -- Percentiles must be ordered, or a range bar would render inside out.
  CONSTRAINT bls_occupations_percentiles_ordered CHECK (
    pct10 <= pct25 AND pct25 <= median AND median <= pct75 AND pct75 <= pct90
  )
);

COMMENT ON TABLE public.bls_occupations IS
  'BLS OEWS national wage estimates, one row per SOC code. Public reference data; refreshed by the bls-wages edge function.';
COMMENT ON COLUMN public.bls_occupations.reference_period IS
  'The OEWS release these figures are from, e.g. "May 2025". Must be cited wherever the figures are displayed.';

-- ── Mapping: this site's roles → one BLS occupation each ─────────────────────
--
-- `slug` matches the `id` used in src/data/dataCareerRoles.ts, so the static
-- role content and these figures join without a second lookup table.

CREATE TABLE IF NOT EXISTS public.career_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL,

  -- The FK. NOT NULL on purpose: every one of the 33 roles has a mapping, so a
  -- nullable column would invent an "unmapped role" state that no data can reach
  -- and that every consumer would then have to guard against. RESTRICT rather
  -- than SET NULL for the same reason — deleting a referenced occupation is a
  -- mistake to block, not a way to silently blank out a role's salary.
  soc_code    TEXT NOT NULL REFERENCES public.bls_occupations (soc_code)
                ON UPDATE CASCADE
                ON DELETE RESTRICT,

  -- Why this occupation was chosen. BLS publishes no "Data Engineer" or
  -- "MLOps Engineer" occupation, so several roles map to a broader one and the
  -- UI has to say which. Surfaced next to the figures.
  mapping_note TEXT,

  -- 'curated' roles are the ones with editorial content in dataCareerRoles.ts
  -- and are the only ones Explore Careers lists. 'discovered' roles were created
  -- by the bls-wages lookup when a user or an assistant asked about an
  -- occupation outside that set — they carry wage data and nothing else.
  source      TEXT NOT NULL DEFAULT 'curated'
              CHECK (source IN ('curated', 'discovered')),

  -- The free-text title that triggered a discovery ("cyber security analyst"),
  -- kept so the title→occupation resolution stays auditable.
  requested_title TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A discovered role records what was asked for; a curated one never does.
  CONSTRAINT career_roles_requested_title_only_when_discovered CHECK (
    (source = 'discovered') OR (requested_title IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS career_roles_soc_code_idx  ON public.career_roles (soc_code);
CREATE INDEX IF NOT EXISTS career_roles_category_idx  ON public.career_roles (category);

COMMENT ON TABLE public.career_roles IS
  'Career roles shown on /explore-data-careers, each mapped to at most one BLS occupation for wage data.';
COMMENT ON COLUMN public.career_roles.soc_code IS
  'FK to bls_occupations. NOT NULL: a role without a defensible BLS mapping does not belong in this table.';

-- ── Seed: May 2025 OEWS national estimates ───────────────────────────────────

INSERT INTO public.bls_occupations
  (soc_code, occupation_title, employment, annual_mean, pct10, pct25, median, pct75, pct90)
VALUES
  ('15-2051', 'Data Scientists', 262440, 126800, 67240, 85660, 120230, 158880, 199130),
  ('15-1252', 'Software Developers', 1687890, 148100, 82460, 105210, 135980, 171980, 214670),
  ('15-1243', 'Database Architects', 67140, 144440, 86240, 109370, 139500, 169290, 204000),
  ('15-1221', 'Computer and Information Research Scientists', 37200, 153930, 82200, 103570, 140300, 188700, 230630),
  ('15-1253', 'Software Quality Assurance Analysts and Testers', 186740, 111490, 61440, 80310, 104300, 133180, 167010),
  ('13-1111', 'Management Analysts', 898280, 113790, 60640, 77950, 101860, 133370, 171640),
  ('15-1211', 'Computer Systems Analysts', 519530, 114610, 67340, 82860, 105850, 134110, 167710),
  ('15-2031', 'Operations Research Analysts', 108510, 99730, 57060, 68360, 88940, 125990, 159910),
  ('13-1161', 'Market Research Analysts and Marketing Specialists', 899580, 89490, 43390, 58350, 78760, 108310, 155480),
  ('15-1244', 'Network and Computer Systems Administrators', 314340, 103680, 62640, 78010, 99130, 126640, 155050),
  ('13-2051', 'Financial and Investment Analysts', 361980, 116800, 63720, 79290, 102740, 133340, 180860),
  ('15-1242', 'Database Administrators', 69990, 110090, 60230, 79610, 104620, 135460, 163320),
  ('11-3021', 'Computer and Information Systems Managers', 670570, 192160, 107550, 138060, 175140, 220730, 297510),
  ('15-1241', 'Computer Network Architects', 179740, 139580, 79900, 104620, 134050, 168200, 202680),
  ('15-1212', 'Information Security Analysts', 190650, 132510, 75090, 97810, 129180, 163500, 199850),
  ('15-1254', 'Web Developers', 70190, 98770, 48100, 64230, 92650, 126230, 162290)
ON CONFLICT (soc_code) DO UPDATE SET
  occupation_title = EXCLUDED.occupation_title,
  employment       = EXCLUDED.employment,
  annual_mean      = EXCLUDED.annual_mean,
  pct10            = EXCLUDED.pct10,
  pct25            = EXCLUDED.pct25,
  median           = EXCLUDED.median,
  pct75            = EXCLUDED.pct75,
  pct90            = EXCLUDED.pct90,
  updated_at       = now();

-- ── Seed: role → occupation mapping ──────────────────────────────────────────
-- Slugs match src/data/dataCareerRoles.ts. Exact-title matches carry no note;
-- broader mappings explain themselves.

INSERT INTO public.career_roles (slug, title, category, soc_code, mapping_note) VALUES
  ('data-analyst', 'Data Analyst', 'Analytics', '15-2051',
   'BLS reports data analysts within the Data Scientists occupation.'),
  ('machine-learning-engineer', 'Machine Learning Engineer', 'AI/ML', '15-1252',
   'BLS publishes no ML engineer occupation; wages shown are for Software Developers.'),
  ('data-engineer', 'Data Engineer', 'Data Engineering', '15-1243',
   'BLS publishes no data engineer occupation; wages shown are for Database Architects.'),
  ('bi-analyst', 'Business Intelligence Analyst', 'Business Intelligence', '15-2051',
   'BLS reports BI analysts within the Data Scientists occupation.'),
  ('data-scientist', 'Data Scientist', 'AI/ML', '15-2051', NULL),
  ('ai-engineer', 'AI Engineer', 'AI/ML', '15-1252',
   'BLS publishes no AI engineer occupation; wages shown are for Software Developers.'),
  ('ai-consultant', 'AI Consultant', 'AI/ML', '13-1111',
   'Mapped to Management Analysts, the BLS occupation covering consulting work.'),
  ('ai-test-engineer', 'AI Test Engineer', 'AI/ML', '15-1253', NULL),
  ('computer-information-research-scientist', 'Computer and Information Research Scientist', 'AI/ML', '15-1221', NULL),
  ('customer-engineer-data-ai', 'Customer Engineer, Data & AI', 'AI/ML', '15-1211',
   'Mapped to Computer Systems Analysts.'),
  ('decision-scientist', 'Decision Scientist', 'AI/ML', '15-2031',
   'Mapped to Operations Research Analysts.'),
  ('generative-ai-scientist', 'Generative AI Scientist', 'AI/ML', '15-1221',
   'Mapped to Computer and Information Research Scientists.'),
  ('insights-analyst', 'Insights Analyst', 'AI/ML, Analytics', '13-1161',
   'Mapped to Market Research Analysts and Marketing Specialists.'),
  ('mlops-engineer', 'MLOps Engineer', 'AI/ML', '15-1244',
   'BLS publishes no MLOps occupation; wages shown are for Network and Computer Systems Administrators.'),
  ('private-equity-analyst', 'Private Equity Analyst', 'AI/ML, Analytics', '13-2051',
   'Mapped to Financial and Investment Analysts.'),
  ('product-insights-analyst', 'Product or Product Insights Analyst', 'AI/ML, Analytics', '13-1161',
   'Mapped to Market Research Analysts and Marketing Specialists.'),
  ('qa-engineer-ai', 'Quality Assurance Engineer, AI', 'AI/ML', '15-1253', NULL),
  ('research-scientist', 'Research Scientist/Applied Research Scientist', 'AI/ML', '15-1221', NULL),
  ('solution-engineer-data-ai', 'Solution Engineer, Data & AI', 'Analytics', '15-1211',
   'Mapped to Computer Systems Analysts.'),
  ('cloud-data-engineer', 'Cloud Data Engineer', 'Data Engineering', '15-1243',
   'BLS publishes no data engineer occupation; wages shown are for Database Architects.'),
  ('data-governance-analyst', 'Data Governance Analyst', 'Analytics', '15-1242',
   'Mapped to Database Administrators.'),
  ('data-visualization-specialist', 'Data Visualization Specialist', 'Business Intelligence', '15-2051',
   'BLS reports visualization work within the Data Scientists occupation.'),
  ('data-metrics-analyst', 'Data and Metrics Analyst', 'Analytics', '15-2051',
   'BLS reports data analysts within the Data Scientists occupation.'),
  ('information-architect', 'Information Architect', 'Business Intelligence', '15-1243',
   'Mapped to Database Architects.'),
  ('intelligence-analyst', 'Intelligence Analyst', 'Business Intelligence', '15-2051',
   'Business intelligence work; BLS reports it within the Data Scientists occupation.'),
  ('mdm-analyst', 'Master Data Management (MDM) Analyst', 'Analytics', '15-1242',
   'Mapped to Database Administrators.'),
  ('sql-developer', 'SQL Developer', 'Data Engineering', '15-1242',
   'Mapped to Database Administrators.'),
  ('ai-governance-officer', 'AI Governance Officer', 'Business Intelligence', '11-3021',
   'Mapped to Computer and Information Systems Managers.'),
  ('cloud-engineer', 'Cloud Engineer', 'Data Engineering', '15-1241',
   'Mapped to Computer Network Architects.'),
  ('cloud-security-engineer', 'Cloud Security Engineer', 'Data Engineering', '15-1212',
   'Mapped to Information Security Analysts.'),
  ('full-stack-developer', 'Full-Stack Developer', 'Data Engineering', '15-1254',
   'Mapped to Web Developers.'),
  ('metadata-specialist', 'Metadata Specialist', 'Data Engineering', '15-1242',
   'Mapped to Database Administrators.'),
  ('software-engineer-ai-ml', 'Software Engineer (AI/ML)', 'Data Engineering, AI/ML', '15-1252', NULL)
ON CONFLICT (slug) DO UPDATE SET
  title        = EXCLUDED.title,
  category     = EXCLUDED.category,
  soc_code     = EXCLUDED.soc_code,
  mapping_note = EXCLUDED.mapping_note,
  updated_at   = now();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Both tables are public reference data: the landing page reads them while
-- signed out. Reads are open to everyone; writes are service-role only, which
-- is what the refresh edge function uses.

ALTER TABLE public.bls_occupations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_roles    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "BLS occupations are publicly readable" ON public.bls_occupations;
CREATE POLICY "BLS occupations are publicly readable"
  ON public.bls_occupations FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Career roles are publicly readable" ON public.career_roles;
CREATE POLICY "Career roles are publicly readable"
  ON public.career_roles FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── Convenience view: role joined to its wage figures ────────────────────────

CREATE OR REPLACE VIEW public.career_role_wages AS
  SELECT
    r.slug,
    r.title,
    r.category,
    r.mapping_note,
    r.source,
    o.soc_code,
    o.occupation_title,
    o.employment,
    o.annual_mean,
    o.pct10,
    o.pct25,
    o.median,
    o.pct75,
    o.pct90,
    o.reference_period,
    o.source_name,
    o.source_url
  -- Inner join: the NOT NULL FK guarantees a match, so a LEFT JOIN would only
  -- produce all-NULL wage columns that can never occur.
  FROM public.career_roles r
  JOIN public.bls_occupations o ON o.soc_code = r.soc_code;

COMMENT ON VIEW public.career_role_wages IS
  'Career roles with their BLS wage figures and citation, ready to render.';
