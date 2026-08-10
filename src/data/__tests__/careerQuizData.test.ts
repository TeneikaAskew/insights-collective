// ABOUTME: Pins the career quiz scoring model — each track's real ceiling, the
// ABOUTME: raw-score-to-percentage conversion, and the skill-level thresholds.
import { describe, expect, it } from 'vitest';
import {
  CareerTrack,
  getSkillLevel,
  quizQuestions,
  toMatchPercentage,
  trackMaxScores,
} from '../careerQuizData';

const TRACKS: CareerTrack[] = ['AI/ML', 'Analytics', 'Data Engineering', 'Business Intelligence'];

describe('trackMaxScores', () => {
  it('matches the ceiling implied by the questions', () => {
    // Hand-computed from the weights: scale questions contribute their weight at
    // answer 5, the multiple-choice question contributes its best option. These
    // are the numbers the old `score * 5` (a flat 20 for every track) got wrong.
    expect(trackMaxScores).toEqual({
      'AI/ML': 22,
      Analytics: 23,
      'Data Engineering': 19,
      'Business Intelligence': 22,
    });
  });

  it('is exactly what a perfectly-answered quiz would score', () => {
    // Independent of the reduction above: replay the scoring the quiz itself
    // performs, choosing the best answer for one track at a time.
    for (const track of TRACKS) {
      let total = 0;
      for (const question of quizQuestions) {
        if (question.type === 'scale' && question.weights) {
          total += (5 / 5) * question.weights[track];
        } else if (question.type === 'multiple-choice' && question.options) {
          total += Math.max(...question.options.map((o) => o.weights[track]));
        }
      }
      expect(total).toBe(trackMaxScores[track]);
    }
  });
});

describe('toMatchPercentage', () => {
  it('normalizes against the track ceiling, not a flat 20', () => {
    // Analytics tops out at 23, so a raw 20 is 87% — the old arithmetic called
    // it 100% and left no headroom above it.
    expect(toMatchPercentage('Analytics', 20)).toBe(87);
    // Data Engineering tops out at 19, so a raw 17 outranks that in percentage
    // terms despite the lower raw score.
    expect(toMatchPercentage('Data Engineering', 17)).toBe(89);
  });

  it('returns 100 for a perfect score on every track', () => {
    for (const track of TRACKS) {
      expect(toMatchPercentage(track, trackMaxScores[track])).toBe(100);
    }
  });

  it('clamps a score from an older question set rather than printing over 100%', () => {
    // Historic attempts were scored against a 14-question version and can carry
    // raw values above today's ceiling.
    expect(toMatchPercentage('Analytics', 27)).toBe(100);
  });

  it('handles zero and non-finite input without producing NaN', () => {
    expect(toMatchPercentage('AI/ML', 0)).toBe(0);
    expect(toMatchPercentage('AI/ML', Number.NaN)).toBe(0);
  });
});

describe('getSkillLevel', () => {
  it('splits the 0–100 percentage range across all three levels', () => {
    expect(getSkillLevel(0)).toBe('Beginner');
    expect(getSkillLevel(40)).toBe('Beginner');
    expect(getSkillLevel(41)).toBe('Intermediate');
    expect(getSkillLevel(70)).toBe('Intermediate');
    expect(getSkillLevel(71)).toBe('Advanced');
    expect(getSkillLevel(100)).toBe('Advanced');
  });

  it('does not call a middling match "Advanced"', () => {
    // The old thresholds (20/40) were written for a raw score. Fed the
    // percentage both call sites actually pass, every result above 40% came
    // back Advanced — including the 60% that answering "Neutral" throughout
    // produces on every track.
    expect(getSkillLevel(60)).toBe('Intermediate');
  });
});
