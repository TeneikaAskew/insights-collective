// ABOUTME: Pins the career quiz scoring model — each track's real ceiling, the
// ABOUTME: raw-score-to-percentage conversion, and the skill-level thresholds.
import { describe, expect, it } from 'vitest';
import {
  affinityQuestions,
  CareerTrack,
  experienceQuestion,
  experienceLevelForOptionId,
  getExperienceLevel,
  quizQuestions,
  scaleAnswerWeightFraction,
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
      for (const question of affinityQuestions) {
        if (question.type === 'scale' && question.weights) {
          total += scaleAnswerWeightFraction(5) * question.weights[track];
        } else if (question.type === 'multiple-choice' && question.options) {
          total += Math.max(...question.options.map((o) => o.weights[track]));
        }
      }
      expect(total).toBe(trackMaxScores[track]);
    }
  });

  it('is unaffected by the experience question', () => {
    // Experience must not leak into affinity: a seasoned practitioner and a
    // newcomer with identical interests should get identical match scores.
    expect(experienceQuestion).toBeDefined();
    for (const option of experienceQuestion!.options ?? []) {
      for (const track of TRACKS) {
        expect(option.weights[track]).toBe(0);
      }
    }
    expect(affinityQuestions).not.toContain(experienceQuestion);
  });
});

describe('scaleAnswerWeightFraction', () => {
  it('spans the whole range, so the bottom of the scale contributes nothing', () => {
    // Was `value / 5`, which gave "Strongly Disagree" a fifth of the weight —
    // a flat disclaimer of interest still read as 20% interest, and no track
    // could score below roughly 16%.
    expect(scaleAnswerWeightFraction(1)).toBe(0);
    expect(scaleAnswerWeightFraction(3)).toBe(0.5);
    expect(scaleAnswerWeightFraction(5)).toBe(1);
  });

  it('clamps values outside the 1–5 scale', () => {
    expect(scaleAnswerWeightFraction(0)).toBe(0);
    expect(scaleAnswerWeightFraction(9)).toBe(1);
  });
});

describe('the questions themselves', () => {
  it('asks about experience exactly once', () => {
    const experienceQuestions = quizQuestions.filter((q) => q.measures === 'experience');
    expect(experienceQuestions).toHaveLength(1);
    // And every one of its answers maps to a level, or the level would be
    // silently null for a person who did answer.
    for (const option of experienceQuestions[0].options ?? []) {
      expect(option.experienceLevel).toBeTruthy();
    }
  });

  it('scores question 3 in the direction it is worded', () => {
    // It used to run on an A/B "preference" scale whose weights described pole
    // A while the score rose towards pole B, so preferring analysis awarded
    // Data Engineering all 4 of its points. Agreement must now favour the
    // weighted track.
    const q3 = quizQuestions.find((q) => q.id === 3)!;
    expect(q3.text).toMatch(/rather write scripts and build data systems/i);
    expect(q3.scaleType).toBe('agree');
    expect(q3.weights!['Data Engineering']).toBeGreaterThan(q3.weights!['Analytics']);
    // Strongly Agree gives Data Engineering the full weight; Strongly Disagree none.
    expect(scaleAnswerWeightFraction(5) * q3.weights!['Data Engineering']).toBe(4);
    expect(scaleAnswerWeightFraction(1) * q3.weights!['Data Engineering']).toBe(0);
  });

  it('has no question left on the removed A/B preference scale', () => {
    // The scale type is gone from the union; this catches a reintroduction in
    // data, which would render undefined labels rather than fail to compile.
    for (const question of quizQuestions) {
      expect(question.scaleType).not.toBe('preference');
    }
  });
});

describe('getExperienceLevel', () => {
  it('reads the level from the answered experience question', () => {
    expect(getExperienceLevel({ [experienceQuestion!.id]: 'none' })).toBe('Beginner');
    expect(getExperienceLevel({ [experienceQuestion!.id]: 'learning' })).toBe('Beginner');
    expect(getExperienceLevel({ [experienceQuestion!.id]: 'working' })).toBe('Intermediate');
    expect(getExperienceLevel({ [experienceQuestion!.id]: 'seasoned' })).toBe('Advanced');
  });

  it('returns null rather than guessing when the question was not answered', () => {
    // Attempts recorded before this question existed have no answer. Defaulting
    // them to a level is the exact failure this replaced — asserting a skill
    // level for someone who was never asked about their skill.
    expect(getExperienceLevel({})).toBeNull();
    expect(getExperienceLevel(null)).toBeNull();
    expect(getExperienceLevel({ 1: 5, 2: 5 })).toBeNull();
    expect(getExperienceLevel({ [experienceQuestion!.id]: 'not-an-option' })).toBeNull();
  });

  it('widens a stored option id back into a level', () => {
    expect(experienceLevelForOptionId('working')).toBe('Intermediate');
    expect(experienceLevelForOptionId(null)).toBeNull();
    expect(experienceLevelForOptionId('')).toBeNull();
    expect(experienceLevelForOptionId('bogus')).toBeNull();
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

