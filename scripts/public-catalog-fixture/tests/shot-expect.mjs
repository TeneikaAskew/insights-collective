// ABOUTME: The lane's strict, hand-written screenshot contract: each export name -> {project, width, height}, plus a
// ABOUTME: fixture copy of the job's NAMES list. Literal on purpose: controls compare the shot plan against it, never derive it.
export const PUBLIC_SHOT_EXPECT = Object.freeze({
  'PC-catalog-desktop-1440x900': Object.freeze({ project: 'desktop', width: 1440, height: 900 }),
  'PC-catalog-tablet-768x1024': Object.freeze({ project: 'tablet-768', width: 768, height: 1024 }),
  'PC-catalog-mobile-390x844': Object.freeze({ project: 'mobile', width: 390, height: 844 }),
  'PC-rail-desktop-1180x757': Object.freeze({ project: 'desktop', width: 1180, height: 757 }),
});
/** Fixture copy of the shared job's NAMES="..." value (.github/workflows/e2e.yml, PR134-owned). */
export const JOB_NAMES_FIXTURE = 'PC-catalog-desktop-1440x900 PC-catalog-tablet-768x1024 PC-catalog-mobile-390x844 PC-rail-desktop-1180x757';
