
// Track definitions for the career quiz
export type CareerTrack = 'AI/ML' | 'Analytics' | 'Data Engineering' | 'Business Intelligence';

// Skill level definitions
export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced';

// Question type definition
export interface QuizQuestion {
  id: number;
  text: string;
  type: 'scale' | 'multiple-choice';
  /**
   * 'preference' is deliberately absent. It described an A/B scale, but a
   * two-pole question needs one weight set per pole and this shape carries
   * only one — so whichever pole the weights described, the other pole scored
   * it. The single question that used it (id 3) is now an agree scale.
   */
  scaleType?: 'comfort' | 'agree';
  /**
   * What the answer is evidence of.
   *
   * 'affinity' (the default) feeds the track match scores. 'experience' does
   * not: it establishes how far along the person is, which the match scores
   * cannot tell you — every other question asks what someone enjoys or
   * prefers, and enthusiasm is not proficiency.
   */
  measures?: 'affinity' | 'experience';
  options?: {
    id: string;
    text: string;
    weights: Record<CareerTrack, number>;
    /** Set on 'experience' questions: the level this answer establishes. */
    experienceLevel?: SkillLevel;
  }[];
  weights?: Record<CareerTrack, number>;
}

// Track persona definition
export interface TrackPersona {
  track: CareerTrack;
  description: string;
  idealFor: string;
  tools: string[];
  sampleRoles: string[];
  icon: string;
}

// Course recommendation definition
export interface CourseRecommendation {
  track: CareerTrack;
  level: SkillLevel;
  courses: {
    id: string;
    title: string;
    description: string;
  }[];
}

// Quiz questions (updated)
export const quizQuestions: QuizQuestion[] = [
  {
    id: 1,
    text: "How comfortable are you with coding in Python, Java, or SQL?",
    type: "scale",
    scaleType: "comfort",
    weights: {
      "AI/ML": 3,
      "Analytics": 2,
      "Data Engineering": 3,
      "Business Intelligence": 1
    }
  },
  {
    id: 2,
    text: "Do you enjoy working with statistical models or machine learning algorithms?",
    type: "scale",
    scaleType: "agree",
    weights: {
      "AI/ML": 4,
      "Analytics": 2,
      "Data Engineering": 1,
      "Business Intelligence": 0
    }
  },
  {
    id: 3,
    // Reworded from "Do you prefer writing scripts and building systems (A)
    // over analyzing trends (B)?" on the A/B "preference" scale, which scored
    // backwards. Scoring runs one direction — higher answer, more of this
    // question's weights — but the weights here describe pole A (systems, so
    // Data Engineering 4 / Analytics 0) while the top of the A/B scale is pole
    // B. "Strongly Prefer B", meaning analysis, awarded Data Engineering all 4
    // of its points; "Strongly Prefer A", meaning systems, awarded it 0.8. That
    // is 21% of Data Engineering's ceiling handed out for the opposite answer.
    //
    // A two-pole question needs a weight set per pole, which this shape cannot
    // express. An agree scale can: agreement now means the weights below.
    text: "I would rather write scripts and build data systems than analyze trends.",
    type: "scale",
    scaleType: "agree",
    weights: {
      "AI/ML": 2,
      "Analytics": 0,
      "Data Engineering": 4,
      "Business Intelligence": 1
    }
  },
  {
    id: 4,
    text: "I enjoy turning data into insights that drive business decisions.",
    type: "scale",
    scaleType: "agree",
    weights: {
      "AI/ML": 1,
      "Analytics": 4,
      "Data Engineering": 1,
      "Business Intelligence": 3
    }
  },
  {
    id: 5,
    text: "How comfortable are you talking to stakeholders to understand their problems and presenting dashboards?",
    type: "scale",
    scaleType: "comfort",
    weights: {
      "AI/ML": 0,
      "Analytics": 2,
      "Data Engineering": 0,
      "Business Intelligence": 4
    }
  },
  {
    id: 6,
    text: "I'm more interested in the 'why' behind numbers than how the data is processed.",
    type: "scale",
    scaleType: "agree",
    weights: {
      "AI/ML": 1,
      "Analytics": 3,
      "Data Engineering": 0,
      "Business Intelligence": 3
    }
  },
  {
    id: 7,
    text: "I like optimizing systems or automating processes.",
    type: "scale",
    scaleType: "agree",
    weights: {
      "AI/ML": 2,
      "Analytics": 1,
      "Data Engineering": 4,
      "Business Intelligence": 1
    }
  },
  {
    id: 8,
    text: "I enjoy exploring patterns in data to build predictive models.",
    type: "scale",
    scaleType: "agree",
    weights: {
      "AI/ML": 4,
      "Analytics": 3,
      "Data Engineering": 1,
      "Business Intelligence": 1
    }
  },
  {
    id: 9,
    text: "I prefer using data to answer specific business questions.",
    type: "scale",
    scaleType: "agree",
    weights: {
      "AI/ML": 1,
      "Analytics": 3,
      "Data Engineering": 1,
      "Business Intelligence": 4
    }
  },
  {
    id: 10,
    text: "Which tool excites you most?",
    type: "multiple-choice",
    options: [
      {
        id: "a",
        text: "Jupyter Notebook",
        weights: {
          "AI/ML": 4,
          "Analytics": 2,
          "Data Engineering": 1,
          "Business Intelligence": 0
        }
      },
      {
        id: "b",
        text: "Tableau or Power BI",
        weights: {
          "AI/ML": 0,
          "Analytics": 2,
          "Data Engineering": 0,
          "Business Intelligence": 4
        }
      },
      {
        id: "c",
        text: "Apache Spark or Airflow",
        weights: {
          "AI/ML": 1,
          "Analytics": 1,
          "Data Engineering": 4,
          "Business Intelligence": 0
        }
      },
      {
        id: "d",
        text: "Excel with pivot tables",
        weights: {
          "AI/ML": 0,
          "Analytics": 3,
          "Data Engineering": 0,
          "Business Intelligence": 3
        }
      }
    ]
  },
  {
    /**
     * The only question that asks about proficiency.
     *
     * Every question above it asks what the person enjoys, prefers or is
     * excited by — "Do you enjoy...", "I like...", "Which tool excites you
     * most?". Two ask about comfort, which is closer, but still a feeling.
     * The skill level was previously read off the sum of those answers, so
     * someone who found four tracks appealing was told they were "Advanced"
     * in all of them, and the course recommendations keyed on that level sent
     * an enthusiastic beginner to "MLOps and Model Deployment".
     *
     * Weights are all zero: experience says nothing about which track fits,
     * only how far along the person is, and mixing it into the match scores
     * would let seniority masquerade as affinity.
     */
    id: 15,
    text: "How much hands-on experience do you have working with data?",
    type: "multiple-choice",
    measures: "experience",
    options: [
      {
        id: "none",
        text: "None yet — I'm exploring what this field involves",
        experienceLevel: "Beginner",
        weights: { "AI/ML": 0, "Analytics": 0, "Data Engineering": 0, "Business Intelligence": 0 }
      },
      {
        id: "learning",
        text: "Some — coursework, personal projects, or under a year on the job",
        experienceLevel: "Beginner",
        weights: { "AI/ML": 0, "Analytics": 0, "Data Engineering": 0, "Business Intelligence": 0 }
      },
      {
        id: "working",
        text: "One to three years using data in a working role",
        experienceLevel: "Intermediate",
        weights: { "AI/ML": 0, "Analytics": 0, "Data Engineering": 0, "Business Intelligence": 0 }
      },
      {
        id: "seasoned",
        text: "More than three years, and I help others with their data work",
        experienceLevel: "Advanced",
        weights: { "AI/ML": 0, "Analytics": 0, "Data Engineering": 0, "Business Intelligence": 0 }
      }
    ]
  }
];
// // Track definitions for the career quiz
// export type CareerTrack = 'AI/ML' | 'Analytics' | 'Data Engineering' | 'Business Intelligence';

// // Skill level definitions
// export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced';

// // Question type definition
// export interface QuizQuestion {
//   id: number;
//   text: string;
//   type: 'scale' | 'multiple-choice';
//   options?: {
//     id: string;
//     text: string;
//     weights: Record<CareerTrack, number>;
//   }[];
//   weights?: Record<CareerTrack, number>;
// }

// // Track persona definition
// export interface TrackPersona {
//   track: CareerTrack;
//   description: string;
//   idealFor: string;
//   tools: string[];
//   sampleRoles: string[];
//   icon: string;
// }

// // Course recommendation definition
// export interface CourseRecommendation {
//   track: CareerTrack;
//   level: SkillLevel;
//   courses: {
//     id: string;
//     title: string;
//     description: string;
//   }[];
// }

// // Quiz questions
// export const quizQuestions: QuizQuestion[] = [
//   {
//     id: 1,
//     text: "How comfortable are you with coding in Python, Java, or SQL?",
//     type: "scale",
//     weights: {
//       "AI/ML": 3,
//       "Analytics": 2,
//       "Data Engineering": 3,
//       "Business Intelligence": 1
//     }
//   },
//   {
//     id: 2,
//     text: "Do you enjoy working with statistical models or machine learning algorithms?",
//     type: "scale",
//     weights: {
//       "AI/ML": 4,
//       "Analytics": 2,
//       "Data Engineering": 1,
//       "Business Intelligence": 0
//     }
//   },
//   {
//     id: 3,
//     text: "Do you prefer writing scripts and building systems over analyzing trends?",
//     type: "scale",
//     weights: {
//       "AI/ML": 2,
//       "Analytics": 0,
//       "Data Engineering": 4,
//       "Business Intelligence": 1
//     }
//   },
//   {
//     id: 4,
//     text: "I enjoy turning data into insights that drive business decisions.",
//     type: "scale",
//     weights: {
//       "AI/ML": 1,
//       "Analytics": 4,
//       "Data Engineering": 1,
//       "Business Intelligence": 3
//     }
//   },
//   {
//     id: 5,
//     text: "I prefer talking to stakeholders to understand their problems and presenting dashboards.",
//     type: "scale",
//     weights: {
//       "AI/ML": 0,
//       "Analytics": 2,
//       "Data Engineering": 0,
//       "Business Intelligence": 4
//     }
//   },
//   {
//     id: 6,
//     text: "I'm more interested in the 'why' behind numbers than how the data is processed.",
//     type: "scale",
//     weights: {
//       "AI/ML": 1,
//       "Analytics": 3,
//       "Data Engineering": 0,
//       "Business Intelligence": 3
//     }
//   },
//   {
//     id: 7,
//     text: "I like optimizing systems or automating processes.",
//     type: "scale",
//     weights: {
//       "AI/ML": 2,
//       "Analytics": 1,
//       "Data Engineering": 4,
//       "Business Intelligence": 1
//     }
//   },
//   {
//     id: 8,
//     text: "I enjoy exploring patterns in data to build predictive models.",
//     type: "scale",
//     weights: {
//       "AI/ML": 4,
//       "Analytics": 3,
//       "Data Engineering": 1,
//       "Business Intelligence": 1
//     }
//   },
//   {
//     id: 9,
//     text: "I prefer using data to answer specific business questions.",
//     type: "scale",
//     weights: {
//       "AI/ML": 1,
//       "Analytics": 3,
//       "Data Engineering": 1,
//       "Business Intelligence": 4
//     }
//   },
//   {
//     id: 10,
//     text: "Which tool excites you most?",
//     type: "multiple-choice",
//     options: [
//       {
//         id: "a",
//         text: "Jupyter Notebook",
//         weights: {
//           "AI/ML": 4,
//           "Analytics": 2,
//           "Data Engineering": 1,
//           "Business Intelligence": 0
//         }
//       },
//       {
//         id: "b",
//         text: "Tableau or Power BI",
//         weights: {
//           "AI/ML": 0,
//           "Analytics": 2,
//           "Data Engineering": 0,
//           "Business Intelligence": 4
//         }
//       },
//       {
//         id: "c",
//         text: "Apache Spark or Airflow",
//         weights: {
//           "AI/ML": 1,
//           "Analytics": 1,
//           "Data Engineering": 4,
//           "Business Intelligence": 0
//         }
//       },
//       {
//         id: "d",
//         text: "Excel with pivot tables",
//         weights: {
//           "AI/ML": 0,
//           "Analytics": 3,
//           "Data Engineering": 0,
//           "Business Intelligence": 3
//         }
//       }
//     ]
//   },
//   {
//     id: 11,
//     text: "I want to build cutting-edge AI products.",
//     type: "scale",
//     weights: {
//       "AI/ML": 4,
//       "Analytics": 1,
//       "Data Engineering": 1,
//       "Business Intelligence": 0
//     }
//   },
//   {
//     id: 12,
//     text: "I want to inform strategic decisions with data.",
//     type: "scale",
//     weights: {
//       "AI/ML": 1,
//       "Analytics": 4,
//       "Data Engineering": 1,
//       "Business Intelligence": 3
//     }
//   },
//   {
//     id: 13,
//     text: "I want to design robust data infrastructure.",
//     type: "scale",
//     weights: {
//       "AI/ML": 1,
//       "Analytics": 1,
//       "Data Engineering": 4,
//       "Business Intelligence": 1
//     }
//   },
//   {
//     id: 14,
//     text: "I want to become a go-to person for reporting and KPIs.",
//     type: "scale",
//     weights: {
//       "AI/ML": 0,
//       "Analytics": 2,
//       "Data Engineering": 1,
//       "Business Intelligence": 4
//     }
//   }
// ];

// Track personas
export const trackPersonas: TrackPersona[] = [
  {
    track: "AI/ML",
    description: "Machine Learning engineers and AI specialists develop models that learn from data and make predictions or decisions.",
    idealFor: "Those who enjoy mathematics, statistics, and building intelligent systems.",
    tools: ["TensorFlow", "PyTorch", "Scikit-learn", "Jupyter", "Python"],
    sampleRoles: ["Machine Learning Engineer", "AI Researcher", "NLP Specialist", "Computer Vision Engineer"],
    icon: "brain-circuit"
  },
  {
    track: "Analytics",
    description: "Data Analysts extract meaningful insights from data and communicate them to stakeholders to drive business decisions.",
    idealFor: "Those who enjoy finding insights in data and solving business problems with analysis.",
    tools: ["SQL", "Python/R", "Excel", "Pandas", "Matplotlib/Seaborn"],
    sampleRoles: ["Data Analyst", "Business Analyst", "Marketing Analyst", "Financial Analyst"],
    icon: "bar-chart-3"
  },
  {
    track: "Data Engineering",
    description: "Data Engineers build and maintain the infrastructure needed to store, process, and analyze large datasets.",
    idealFor: "Those who enjoy building systems, optimizing pipelines, and working with distributed computing.",
    tools: ["Apache Spark", "Airflow", "Kafka", "SQL", "NoSQL", "Docker"],
    sampleRoles: ["Data Engineer", "ETL Developer", "Database Administrator", "Data Architect"],
    icon: "database"
  },
  {
    track: "Business Intelligence",
    description: "BI professionals create dashboards and reports that help businesses monitor performance and make data-driven decisions.",
    idealFor: "Those who enjoy creating visualizations and reports to communicate insights clearly.",
    tools: ["Tableau", "Power BI", "SQL", "Excel", "Looker"],
    sampleRoles: ["BI Analyst", "BI Developer", "Dashboard Designer", "Reporting Specialist"],
    icon: "presentation"
  }
];

// Course recommendations
export const courseRecommendations: CourseRecommendation[] = [
  {
    track: "AI/ML",
    level: "Beginner",
    courses: [
      {
        id: "ml101",
        title: "Introduction to Machine Learning",
        description: "Learn the fundamentals of machine learning algorithms and techniques."
      },
      {
        id: "py101",
        title: "Python for Data Science",
        description: "Master Python programming for data manipulation and analysis."
      },
      {
        id: "stat101",
        title: "Statistics for Machine Learning",
        description: "Understand the statistical concepts behind machine learning models."
      }
    ]
  },
  {
    track: "AI/ML",
    level: "Intermediate",
    courses: [
      {
        id: "ml201",
        title: "Deep Learning Fundamentals",
        description: "Explore neural networks and deep learning architectures."
      },
      {
        id: "nlp201",
        title: "Natural Language Processing",
        description: "Learn techniques for processing and analyzing text data."
      }
    ]
  },
  {
    track: "AI/ML",
    level: "Advanced",
    courses: [
      {
        id: "ml301",
        title: "Advanced Deep Learning",
        description: "Master advanced topics like GANs, transformers, and reinforcement learning."
      },
      {
        id: "mlops301",
        title: "MLOps and Model Deployment",
        description: "Learn to deploy and maintain machine learning models in production."
      }
    ]
  },
  {
    track: "Analytics",
    level: "Beginner",
    courses: [
      {
        id: "da101",
        title: "Introduction to Data Analysis",
        description: "Learn the fundamentals of analyzing data to extract insights."
      },
      {
        id: "sql101",
        title: "SQL for Data Analysis",
        description: "Master SQL queries for retrieving and manipulating data."
      }
    ]
  },
  {
    track: "Analytics",
    level: "Intermediate",
    courses: [
      {
        id: "da201",
        title: "Statistical Analysis with Python",
        description: "Apply statistical methods to analyze data and test hypotheses."
      },
      {
        id: "viz201",
        title: "Data Visualization Techniques",
        description: "Create effective visualizations to communicate insights."
      }
    ]
  },
  {
    track: "Analytics",
    level: "Advanced",
    courses: [
      {
        id: "da301",
        title: "Advanced Analytics and Predictive Modeling",
        description: "Build sophisticated analytical models to predict outcomes."
      },
      {
        id: "ba301",
        title: "Business Analytics Strategy",
        description: "Learn to align analytics with business strategy and drive decisions."
      }
    ]
  },
  {
    track: "Data Engineering",
    level: "Beginner",
    courses: [
      {
        id: "de101",
        title: "Introduction to Data Engineering",
        description: "Learn the fundamentals of data pipelines and data architecture."
      },
      {
        id: "sql102",
        title: "Database Design and SQL",
        description: "Master database design principles and advanced SQL."
      }
    ]
  },
  {
    track: "Data Engineering",
    level: "Intermediate",
    courses: [
      {
        id: "de201",
        title: "ETL Processes and Tools",
        description: "Build efficient data pipelines using modern ETL tools."
      },
      {
        id: "de202",
        title: "Cloud Data Platforms",
        description: "Learn to work with cloud-based data solutions and services."
      }
    ]
  },
  {
    track: "Data Engineering",
    level: "Advanced",
    courses: [
      {
        id: "de301",
        title: "Distributed Computing Systems",
        description: "Master big data processing with Spark, Hadoop, and other frameworks."
      },
      {
        id: "de302",
        title: "Data Architecture and Governance",
        description: "Design scalable data architectures and implement data governance."
      }
    ]
  },
  {
    track: "Business Intelligence",
    level: "Beginner",
    courses: [
      {
        id: "bi101",
        title: "Introduction to Business Intelligence",
        description: "Learn the fundamentals of BI tools and reporting techniques."
      },
      {
        id: "viz101",
        title: "Dashboard Design Fundamentals",
        description: "Create effective dashboards that communicate insights clearly."
      }
    ]
  },
  {
    track: "Business Intelligence",
    level: "Intermediate",
    courses: [
      {
        id: "bi201",
        title: "Advanced Power BI Techniques",
        description: "Master advanced features in Power BI for sophisticated reporting."
      },
      {
        id: "bi202",
        title: "Data Modeling for BI",
        description: "Learn to design effective data models for business intelligence."
      }
    ]
  },
  {
    track: "Business Intelligence",
    level: "Advanced",
    courses: [
      {
        id: "bi301",
        title: "Enterprise BI Solutions",
        description: "Design and implement enterprise-scale BI solutions and strategies."
      },
      {
        id: "bi302",
        title: "Advanced Analytics for BI Professionals",
        description: "Incorporate predictive analytics into business intelligence workflows."
      }
    ]
  }
];

/**
 * The highest raw score each track can reach, derived from the questions
 * themselves rather than assumed.
 *
 * A scale question contributes `(answer / 5) * weight`, so its maximum is the
 * weight. A multiple-choice question contributes the chosen option's weight, so
 * its maximum is the largest weight among the options. Summing those gives a
 * per-track ceiling that is currently 19–23 depending on the track — not the
 * flat 20 that `score * 5` assumed everywhere. That assumption both understated
 * tracks with a ceiling below 20 and let the others print above 100%.
 */
export const CAREER_TRACKS: CareerTrack[] = [
  'AI/ML',
  'Analytics',
  'Data Engineering',
  'Business Intelligence',
];

/** Questions that contribute to the track match scores. */
export const affinityQuestions = quizQuestions.filter((q) => q.measures !== 'experience');

/**
 * A scale answer's share of its question's weight.
 *
 * Was `value / 5`, which gave the bottom of the scale 20% of the weight rather
 * than none: answering "Strongly Disagree" to all nine scale questions still
 * scored 16–20% on every track, so the bottom fifth of the range was
 * unreachable and a total disclaimer of interest still read as partial
 * interest. `(value - 1) / 4` spans the full range — 1 contributes nothing, 5
 * contributes the whole weight — and leaves the ceilings unchanged.
 */
export const scaleAnswerWeightFraction = (value: number): number =>
  Math.max(0, Math.min(1, (value - 1) / 4));

export const trackMaxScores: Record<CareerTrack, number> = (() => {
  const totals = { 'AI/ML': 0, 'Analytics': 0, 'Data Engineering': 0, 'Business Intelligence': 0 } as Record<CareerTrack, number>;

  for (const question of affinityQuestions) {
    for (const track of CAREER_TRACKS) {
      if (question.type === 'scale' && question.weights) {
        totals[track] += question.weights[track] ?? 0;
      } else if (question.type === 'multiple-choice' && question.options) {
        totals[track] += Math.max(0, ...question.options.map((o) => o.weights[track] ?? 0));
      }
    }
  }

  return totals;
})();

/**
 * Convert a raw track score into the 0–100 "Match Score" the UI shows.
 *
 * Guards the degenerate case: a track with no weight anywhere would divide by
 * zero, and a stored score from an older question set can exceed today's
 * ceiling, so the result is clamped rather than allowed past 100%.
 */
export const toMatchPercentage = (track: CareerTrack, rawScore: number): number => {
  const max = trackMaxScores[track];
  if (!max || !Number.isFinite(rawScore)) return 0;
  return Math.max(0, Math.min(100, Math.round((rawScore / max) * 100)));
};

/** The question whose answer establishes the person's experience level. */
export const experienceQuestion = quizQuestions.find((q) => q.measures === 'experience');

/**
 * The person's self-reported experience level, or null if they have not
 * answered that question — as every attempt taken before it existed has not.
 *
 * Null is a real state and is rendered as "not recorded" rather than being
 * defaulted to 'Beginner'. Guessing a level for someone is exactly the failure
 * this replaces: the level used to be inferred from how much they said they
 * enjoyed each track, which is not evidence of proficiency in any direction.
 */
export const getExperienceLevel = (
  answers: Record<number, number | string> | null | undefined,
): SkillLevel | null => {
  if (!answers || !experienceQuestion) return null;
  const answer = answers[experienceQuestion.id];
  if (typeof answer !== 'string') return null;
  return experienceQuestion.options?.find((o) => o.id === answer)?.experienceLevel ?? null;
};

/** Widen a stored option id (e.g. from the database) back into a level. */
export const experienceLevelForOptionId = (optionId: string | null | undefined): SkillLevel | null =>
  (optionId && experienceQuestion?.options?.find((o) => o.id === optionId)?.experienceLevel) || null;

// Helper function to get course recommendations based on track and level
export const getCourseRecommendations = (track: CareerTrack, level: SkillLevel): CourseRecommendation['courses'] => {
  const recommendation = courseRecommendations.find(
    rec => rec.track === track && rec.level === level
  );
  return recommendation ? recommendation.courses : [];
};

// Helper function to get persona for a track
export const getTrackPersona = (track: CareerTrack): TrackPersona | undefined => {
  return trackPersonas.find(persona => persona.track === track);
};
