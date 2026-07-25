// ABOUTME: Deterministic ResumeAnalysis fixture shared by unit tests and the
// ABOUTME: dev-only Soft Studio preview route (src/pages/dev/SoftStudioPreview.tsx).
import { ResumeAnalysis, BulletAnalysis } from '@/components/assistants/types';

interface XYZ {
  action: number;
  metrics: number;
  clarity: number;
  industry: number;
  achievement: number;
}

const bullet = (
  original: string,
  rewritten: string,
  xyz: XYZ,
  balanceScore: number,
  tips: string[]
): BulletAnalysis => ({
  original,
  rewritten,
  tips,
  bullet_total: xyz.action + xyz.metrics + xyz.clarity + xyz.industry + xyz.achievement,
  xyz_scores: xyz,
  word_balance_score: balanceScore,
  word_balance: {
    word_balance_score: balanceScore,
    industry_pct: 38,
    common_pct: 41,
    action_pct: 12,
    metric_pct: 9,
  },
  improved_xyz_scores: {
    action: Math.min(10, xyz.action + 1),
    metrics: Math.min(30, xyz.metrics + 6),
    clarity: Math.min(15, xyz.clarity + 1),
    industry: Math.min(25, xyz.industry + 1),
    achievement: Math.min(20, xyz.achievement + 2),
  },
  improved_bullet_total: Math.min(
    100,
    xyz.action + xyz.metrics + xyz.clarity + xyz.industry + xyz.achievement + 11
  ),
});

const DEFAULT_TIPS = [
  'Include quantifiable results — %, $, or scale',
  'Name the team size to signal leadership scope',
  'Keep it under 25 words for scannability',
];

// 5 bullets score >= 80 ("strong"), 7 below ("need work"); XYZ average ≈ 76.
export const fixtureBullets: BulletAnalysis[] = [
  bullet(
    'Led development of the CAPTURE system for real-time object detection, improving detection reliability for mission-critical deployments.',
    'Led a 6-engineer team building the CAPTURE system for real-time object detection, raising detection reliability from 91% to 99.2% across 40+ mission-critical deployments.',
    { action: 9, metrics: 20, clarity: 13, industry: 23, achievement: 19 },
    84,
    DEFAULT_TIPS
  ),
  bullet(
    'Built adversarial training pipeline hardening vision models against attacks.',
    'Built an adversarial training pipeline that hardened 12 production vision models, cutting successful evasion attacks by 87%.',
    { action: 10, metrics: 22, clarity: 14, industry: 24, achievement: 18 },
    85,
    DEFAULT_TIPS
  ),
  bullet(
    'Designed reinforcement learning agents for autonomous inspection tasks.',
    'Designed reinforcement learning agents that automated 3 inspection workflows, saving 400 engineer-hours per quarter.',
    { action: 9, metrics: 19, clarity: 13, industry: 23, achievement: 18 },
    82,
    DEFAULT_TIPS
  ),
  bullet(
    'Collaborated with platform team on model deployment infrastructure.',
    'Partnered with the platform team to ship a model deployment service adopted by 5 product teams, reducing rollout time from days to hours.',
    { action: 8, metrics: 20, clarity: 12, industry: 23, achievement: 18 },
    80,
    DEFAULT_TIPS
  ),
  bullet(
    'Optimized inference latency for edge devices using quantization.',
    'Optimized edge inference with INT8 quantization, cutting median latency 63% while holding accuracy within 0.4 points.',
    { action: 9, metrics: 19, clarity: 12, industry: 22, achievement: 18 },
    83,
    DEFAULT_TIPS
  ),
  bullet(
    'Worked on data labeling improvements for the vision team.',
    'Introduced consensus labeling that lifted annotation agreement from 78% to 94% across 2M images.',
    { action: 6, metrics: 16, clarity: 11, industry: 24, achievement: 17 },
    79,
    DEFAULT_TIPS
  ),
  bullet(
    'Helped mentor junior engineers on ML best practices.',
    'Mentored 4 junior engineers through their first production model launches, all shipped on schedule.',
    { action: 6, metrics: 14, clarity: 12, industry: 22, achievement: 17 },
    78,
    DEFAULT_TIPS
  ),
  bullet(
    'Participated in research reading group and paper reviews.',
    'Organized a 20-person research reading group that produced 3 internally adopted techniques.',
    { action: 5, metrics: 13, clarity: 12, industry: 21, achievement: 17 },
    80,
    DEFAULT_TIPS
  ),
  bullet(
    'Maintained CI pipelines for the model training codebase.',
    'Rebuilt training CI to run 2.4× faster, unblocking 30+ daily merges for the ML org.',
    { action: 7, metrics: 17, clarity: 12, industry: 23, achievement: 17 },
    82,
    DEFAULT_TIPS
  ),
  bullet(
    'Responsible for documentation of model evaluation procedures.',
    'Authored the model evaluation handbook now required reading for all 60 ML engineers.',
    { action: 4, metrics: 12, clarity: 11, industry: 21, achievement: 17 },
    77,
    DEFAULT_TIPS
  ),
  bullet(
    'Assisted with quarterly planning for the AI platform roadmap.',
    'Drove quarterly planning for the AI platform roadmap, aligning 3 teams on a single deployment standard.',
    { action: 6, metrics: 15, clarity: 12, industry: 22, achievement: 17 },
    81,
    DEFAULT_TIPS
  ),
  bullet(
    'Contributed to open source computer vision libraries.',
    'Contributed 14 merged PRs to open source vision libraries used by the core product pipeline.',
    { action: 5, metrics: 14, clarity: 12, industry: 22, achievement: 17 },
    81,
    DEFAULT_TIPS
  ),
];

export const fixtureResumeAnalysis: ResumeAnalysis = {
  resume_percent: 82.82,
  letter_grade: 'B',
  themes: [
    'Quantify outcomes — most bullets describe activity, not results',
    'Lead with stronger action verbs in the first two roles',
    'Surface MLOps and deployment keywords for ATS parsing',
  ],
  elevator_pitch:
    'Machine learning engineer with deep expertise in computer vision, adversarial defense, and reinforcement learning. Proven ability to lead research and ship production-scale AI systems with PyTorch, TensorFlow, and modern MLOps practice.',
  explanation:
    'A technically deep, well-organized record with standout work in computer vision and adversarial defense. The single biggest lever is evidence: the CAPTURE System and defense projects read as impressive engineering, but few bullets carry numbers a hiring manager can weigh. Converting the strongest five bullets to quantified, outcome-first statements would likely move this resume into the A range.',
  bullets: fixtureBullets,
  resume_id: 'fixture-resume-id',
};

export const fixtureResume = {
  id: 'fixture-resume-id',
  file_name: 'resume_jess_ml.pdf',
  file_path: 'fixtures/resume_jess_ml.pdf',
  uploaded_at: '2026-07-22T10:00:00.000Z',
  updated_at: '2026-07-25T09:42:00.000Z',
  text: 'Jess Adebayo — Machine Learning Engineer. Computer vision, adversarial defense, reinforcement learning, PyTorch, TensorFlow, MLOps.',
};
