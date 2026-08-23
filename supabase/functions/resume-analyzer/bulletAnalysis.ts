// import stemmer from "https://esm.sh/porter-stemmer-js@1.0.0";
import { PorterStemmer } from "https://esm.sh/porter-stemmer-js@1.0.0/es2022/porter-stemmer-js.mjs";
const stemmer = new PorterStemmer();
// console.log(stemmer.stem("running"));  // prints "run"

// // 1 ▸ Porter stemmer (small, no Node built-ins)
// import {stemmer} from "https://esm.sh/porter-stemmer-js@1.0.0";
// import { stemmer } from "https://deno.land/x/porter_stemmer@v1.1.0/mod.ts";
// import { stemmer } from "https://deno.land/x/porter_stemmer@v1.1.0/porter-stemmer.ts";
// import { stemmer as stem} from "https://deno.land/x/porter_stemmer@v1.1.0/porterStemmer.ts";
// import stemmer from "npm:stemmer";



// 2 ▸ English stop-word list
import { en as STOPWORDS } from "https://esm.sh/stopword@1.0.7";
export const industryWords = [
    /* Core data & analytics */
    "data","analytics","analysis","bi","intelligence","insights","sql","nosql","python","r","scala","java","julia","sas","matlab","stata",
    "tableau","powerbi","looker","qlik","superset","mode","redash","excel","sheets",
    "bigquery","snowflake","redshift","athena","presto","trino","hive","hadoop","spark","pyspark","flink","beam","storm",
    "kafka","kinesis","pubsub","rabbitmq","databricks","airflow","dbt","glue","datafactory","informatica","talend","pentaho","ssis","nifi","luigi",
    "etl","elt","ingestion","pipeline","pipelines","orchestration","lake","lakehouse","warehouse","parquet","avro","orc","delta",
    "ml","mlops","ai","model","models","training","inference","deployment","monitoring","drift","featurestore","feast",
    "tensorflow","keras","pytorch","scikit","sklearn","xgboost","lightgbm","catboost","sagemaker","vertex","azureml","mlflow",
    "classification","regression","clustering","forecasting","timeseries","optimization","statistics","statistical",
    "dashboard","dashboards","visualization","dataviz","kpi","kpis","okr","metric","metrics",
    "cloud","aws","azure","gcp","googlecloud","s3","gcs","adls","ec2","lambda","iam","vpc",
    "api","rest","graphql","json","yaml","xml",
  
    /* Strategy & consulting jargon */
    "strategy","strategic","roadmap","roadmaps","gtm","market","competitive","benchmark","benchmarks","swot","roi","npv","irr",
    "tom","operating","governance","compliance","regulatory","stakeholder","alignment","transformation","maturity","assessment","capability",
    "value","realization","businesscase","costbenefit","risk","mitigation","dependency","deliverable","deliverables","milestone","milestones",
    "program","portfolio","pmo","pm","agile","scrum","kanban","safe","waterfall","lean","sixsigma","kaizen","reengineering",
    "process","processes","improvement","change","adkar","prosci","communication","workshop","workshops","facilitation","training","adoption","readiness",
    "consulting","consultant","client","clients","engagement","engagements","workstream","proposal","rfp","sow","deck","presentation","presentations",
    "storytelling","findings","recommendations","operatingmodel","digital","transformation",
  
    /* Product & growth */
    "product","productmanagement","productmanager","productowner","backlog","user","story","stories","epic","feature","features","mvp",
    "prototype","wireframe","mockup","figma","ux","ui","design","designthinking","ideation","persona","personas","journey","segmentation",
    "pricing","monetization","growth","acquisition","retention","churn","ltv","nps","csat","activation","engagement",
    "launch","release","releases","beta","alpha","ga","telemetry","instrumentation","tracking","mixpanel","amplitude","segment","snowplow","heap",
    "ga4","adobe","experimentation","abtest","multivariate","hypothesis",
  
    /* General tech & engineering */
    "software","development","engineering","devops","ci","cd","jenkins","github","gitlab","bitbucket","terraform","ansible","docker","kubernetes","helm","serverless",
    "security","encryption","gdpr","hipaa","pci","sox","access","lineage","catalog","datacatalog","collibra","alation",
    "jira","confluence","api","microservice","microservices","serverless","event","events","logging","observability"
  ];

export const actionWords = [
    "accelerated", "accomplished", "achieved", "acquired", "activated", "adapted", "addressed", "administered", "advanced", "advised",
    "advocated", "aligned", "allocated", "analyzed", "applied", "appraised", "assembled", "assessed", "assigned", "assisted",
    "attained", "automated", "boosted", "budgeted", "built", "calculated", "centralized", "championed", "changed", "clarified",
    "coached", "collaborated", "collected", "communicated", "compared", "compiled", "completed", "conceived", "conceptualized", "concluded",
    "conducted", "consolidated", "constructed", "consulted", "contributed", "controlled", "converted", "coordinated", "corrected", "created",
    "cultivated", "customized", "decreased", "defined", "delivered", "demonstrated", "designed", "developed", "devised", "diagnosed",
    "directed", "discovered", "dispatched", "documented", "doubled", "drove", "enabled", "encouraged", "engaged", "engineered",
    "enforced", "enhanced", "enlarged", "ensured", "established", "evaluated", "executed", "expanded", "expedited", "explained",
    "explored", "facilitated", "forecasted", "formed", "formulated", "fostered", "founded", "generated", "governed", "guided",
    "headed", "identified", "implemented", "improved", "increased", "influenced", "informed", "initiated", "innovated", "inspected",
    "inspired", "installed", "instituted", "instructed", "integrated", "intensified", "introduced", "invented", "investigated", "launched",
    "led", "leveraged", "maintained", "managed", "maximized", "merged", "minimized", "modernized", "monitored", "motivated",
    "negotiated", "optimized", "orchestrated", "organized", "outperformed", "overhauled", "oversaw", "partnered", "performed", "piloted",
    "pioneered", "planned", "prepared", "presented", "prioritized", "produced", "programmed", "projected", "promoted", "proposed",
    "protected", "provided", "qualified", "quantified", "realigned", "realized", "rebuilt", "received", "reconciled", "recruited",
    "reduced", "redesigned", "refined", "reformed", "reengineered", "reinforced", "reorganized", "replaced", "reported", "resolved",
    "restructured", "revamped", "reviewed", "revised", "saved", "scheduled", "secured", "selected", "simplified", "solved",
    "spearheaded", "specified", "stabilized", "standardized", "started", "streamlined", "strengthened", "structured", "supervised", "supported",
    "surpassed", "surveyed", "synthesized", "targeted", "tested", "trained", "transformed", "translated", "updated", "upgraded",
    "validated", "won", "yielded"
  ];

export const softSkills = [
    "leadership", "management", "mentoring", "coaching", "teamwork", "presentation",
    "stakeholder", "negotiation", "influence", "persuasion", "problem-solving",
    "critical-thinking", "adaptability", "creativity", "innovation", "strategic-thinking",
    "time-management", "organization", "prioritization", "attention-to-detail", "empathy",
    "resilience", "conflict-resolution", "decision-making", "networking",
    "relationship-building", "customer-service", "analytical-thinking", "business-acumen",
    "initiative", "ownership", "accountability", "flexibility"
  ];

export const skillsKeywords = [...industryWords, ...actionWords, ...softSkills];
export const achievementKeywords = [
  // General Success & Milestones
  "achieved", "attained", "accomplished", "completed", "fulfilled", "realized", "delivered",
  "reached", "surpassed", "exceeded", "culminated", "finalized", "closed", "obtained", "secured",
  "won", "earned", "garnered", "captured", "gained", "succeeded", "triumphed",

  // Recognition, Awards, Status
  "awarded", "recognized", "honored", "commended", "certified", "nominated", "accredited", "featured",
  "distinguished", "ranked", "placed", "licensed", "endorsed", "spotlighted", "celebrated", "hailed",
  "titled", "topped", "selected", "received accolades", "winner", "top performer", "recipient", "recipient of",

  // Improvement, Enhancement, Growth
  "improved", "enhanced", "strengthened", "elevated", "boosted", "increased", "raised", "grew",
  "expanded", "maximized", "amplified", "advanced", "multiplied", "escalated", "intensified",
  "escalated", "revitalized", "optimized", "upgraded", "enriched", "perfected", "heightened",

  // Financial Impact & Business Value
  "profited", "yielded", "generated revenue", "increased revenue", "grew profit", "cut costs",
  "saved", "reduced expense", "delivered savings", "improved ROI", "captured value",
  "capitalized", "monetized", "sustained profit", "drove growth", "drove results", "contributed to growth",

  // Surpassing Benchmarks/Records
  "broke record", "set record", "record-breaking", "topped charts", "topped rankings", "outperformed", "outpaced",
  "led industry", "first to", "fastest", "highest", "best in class", "benchmark-setting", "industry-leading",
  "market leader", "standard setter", "trailblazer", "pioneer",

  // Reduction, Efficiency Gains
  "reduced", "lowered", "decreased", "curtailed", "minimized", "eliminated", "streamlined", "compressed",
  "saved time", "shortened", "improved efficiency", "enhanced productivity", "contained", "diminished",
  "tightened", "trimmed", "conserved", "preserved",

  // Quality, Compliance, Excellence
  "perfect record", "flawless", "zero errors", "error-free", "exceeded standards", "outstanding", "exceptional",
  "passed inspection", "certified", "met compliance", "exemplary", "merit", "highly rated", "award-winning",
  "commendation", "lauded", "recognized for excellence",

  // Customer/User Impact
  "satisfied", "retained", "delighted", "increased satisfaction", "improved retention", "reduced churn",
  "grew loyalty", "captured positive feedback", "received testimonials", "gained 5-star reviews",
  "improved NPS", "customer champion", "user favorite", "brand advocate",

  // Innovation, Patents, Breakthroughs
  "patented", "granted patent", "innovation award", "innovator of the year", "filed patent",
  "breakthrough", "invented", "discovered", "pioneered", "transformed", "revolutionized", "first to market",

  // Growth, Expansion, Reach
  "expanded reach", "entered new market", "opened new location", "grew user base", "acquired clients",
  "secured contract", "signed partnership", "increased market share", "attracted new customers", "won account",

  // Positive Impact & Community
  "made impact", "gave back", "volunteered", "donated", "community leader", "positive difference",
  "recognized contribution", "philanthropic achievement",

  // Miscellaneous
  "closed sale", "landed deal", "contract won", "repeat business", "renewal secured", "new business acquired",
  "long-term contract", "key win", "milestone", "notable", "standout", "star performer", "lead story",
  "success story", "breakthrough result", "impressive outcome"
];


export const weakPhrases = [
  "responsible for", "duties include", "helped with", "assisted with", "involved in", "participated in", "worked on", "tasked with",
  "supporting", "responsible to", "a part of", "contributed to", "played a role in", "worked alongside", "was part of",
  "was responsible for", "was involved in", "provided support", "helped manage", "helped develop", "helped implement",
  "helped design", "helped create", "provided assistance", "collaborated with", "cooperated with", "supported the team",
  "team member", "worked under", "assisted in", "assisted on", "assisted the", "helped to", "helped", "contributed",
  "coordinated with", "participated", "participated on", "participated at", "in conjunction with", "along with",
  "under the supervision of", "under supervision", "shadowed", "observed", "attended", "saw to", "helped out",
  "did some", "did work", "completed tasks", "carried out", "carried out tasks", "responsible", "involved", "worked", "assisted"
];
const ACTION   = new Set(actionWords.map(w => stemmer.stem(w)));
const INDUSTRY = new Set(industryWords.map(w => stemmer.stem(w)));
const STOP = new Set(STOPWORDS.map(w => stemmer.stem(w)));


// Analyze word balance
export function analyzeWordBalance(bullet: string): {
  industry_pct: number;
  common_pct: number;
  action_pct: number;
  metric_pct: number;
  word_balance_score: number;
} {
  // const words = bullet.replace(/-/g, " ").split(/\s+/);
  const words = bullet.replace(/(?!\d)['’\-](?!\d)/g, " ")
                      .split(/[^A-Za-z0-9%$]+/)
                      .filter(w => w && !STOP.has(stemmer.stem(w.toLowerCase())));
                      // .replace(STOPWORDS, "").replace(/-/g, " ").split(/\s+/)
  
  let industryCount = 0;
  let commonCount = 0;
  let actionCount = 0;
  let metricCount = 0;
  
  for (const word of words) {

    const cleanWord = word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    
    // if (/\d/.test(cleanWord) || /%|\$/.test(cleanWord)) {
    //   metricCount++;
    // }
    // // else if (actionWords.includes(cleanWord)) {
    // else if (stemmer(actionWords.includes(cleanWord))){
    //   actionCount++;
    // }
    // // else if (industryWords.includes(cleanWord)) {
    // else if (stemmer(industryWords.includes(cleanWord))){
    //   industryCount++;
    // }
    // else {
    //   commonCount++;
    // }}
  /* metrics first – faster short-circuit                                  */
  if (/\d/.test(cleanWord) || /[%$]/.test(cleanWord)) {
    metricCount++;
    continue;
  }
  const root = stemmer.stem(cleanWord);
  if (ACTION.has(root)|| ACTION.has(cleanWord)) actionCount++;
  else if (INDUSTRY.has(root)|| INDUSTRY.has(cleanWord)) industryCount++;
  else commonCount++;

  }
  
  const totalWords = words.length;
  const industry_pct = Math.round((industryCount / totalWords) * 100);
  const common_pct = Math.round((commonCount / totalWords) * 100);
  const action_pct = Math.round((actionCount / totalWords) * 100);
  const metric_pct = Math.round((metricCount / totalWords) * 100);
  
  const idealIndustry = 15;
  const idealCommon = 55;
  const idealAction = 15;
  const idealMetric = 15;


  // const IDEAL = { industry: 15, action: 15, metric: 15, common: 55 };

  // const getBalanceScore = (balance) => {
  //   if (!balance) return 0;
  //   // deviation per bucket, capped so "way off" doesn't sink the score too fast
  //   let score = 100;
  //   for (const k in IDEAL) {
  //     const dev = Math.abs((balance[k + "_pct"] || 0) - IDEAL[k]);
  //     score -= dev; // or Math.min(dev, maxDevPerBucket)
  //   }
  //   return Math.max(0, score);
  // };

  const getBucketScore = (actual: number, ideal: number) => {
    const dev = Math.abs(actual - ideal);
    if (dev <= 5) return 25;
    if (dev <= 10) return 20;
    if (dev <= 20) return 10;
    return 0;
  };
  
  // const word_balance_score = (balance) => {
  //   if (!balance) return 0;
  //   return (
  //     getBucketScore(balance.industry_pct, 15) +
  //     getBucketScore(balance.action_pct, 15) +
  //     getBucketScore(balance.metric_pct, 15) +
  //     getBucketScore(balance.common_pct, 55)
  //   );
  // };
  
  // Aggregate "balance" score (0–100)
const word_balance_score = 
  getBucketScore(industry_pct, idealIndustry) +
  getBucketScore(action_pct,   idealAction)   +
  getBucketScore(metric_pct,   idealMetric)   +
  getBucketScore(common_pct,   idealCommon);
//   | Bucket                | New **ideal %** | Rationale                                                                                        |
// | --------------------- | --------------- | ------------------------------------------------------------------------------------------------ |
// | **Industry / domain** | **15 %**        | 3–5 domain words in a 30-word bullet feels natural and keyword-rich.                             |
// | **Common**            | **55 %**        | After stop-word removal, half the sentence will always be connective tissue + descriptive nouns. |
// | **Action**            | **15 %**        | One strong verb every \~12 words (2–3 verbs) keeps energy high.                                  |
// | **Metric**            | **15 %**        | Two numeric wins per bullet is enough to showcase impact.                                        |

  // const industryDev = Math.abs(industry_pct - idealIndustry);
  // const commonDev = Math.abs(common_pct - idealCommon);
  // const actionDev = Math.abs(action_pct - idealAction);
  // const metricDev = Math.abs(metric_pct - idealMetric);
  
  // const totalDeviation = industryDev + commonDev + actionDev + metricDev;
  // const word_balance_score = Math.max(0, 25 - totalDeviation);
  
  return {
    industry_pct,
    common_pct,
    action_pct,
    metric_pct,
    word_balance_score
  };
}
// XYZ ATS Quality Check - Enhanced version
export function xyzCheck(bullet: string): {
  action: number,
  metrics: number,
  clarity: number,
  industry: number,
  achievement: number,
  xyz_total: number
} {
  const words = bullet.split(/\s+/);
  const wordCount = words.length;
  
  // Action word at beginning check
  const actionRegex = new RegExp(`^(${actionWords.map(w => w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})`,'i');
  const startsWithAction = actionRegex.test(bullet);
  const action = startsWithAction ? 10 : 0;
  
  // Metrics/quantifiable results check
  const hasMetrics = /\d+%|\d+x|\$\d+|\d+ percent|\d+k|\d+M|\d+B/i.test(bullet);
  const hasPartialMetrics = /\d+/.test(bullet);
  const metrics = hasMetrics ? 30 : (hasPartialMetrics ? 15 : 0);
  
  // Clarity and conciseness check
  // const clarity = wordCount <= 20 ? 15 : (wordCount <= 30 ? 10 : 5);
  // More penalty for extremely short bullets
  const clarity = wordCount <= 10 ? 0 : (wordCount <= 20 ? 10 : (wordCount <= 35 ? 15 : 5)); //changed from 30-36 to remediate penalty from llm
//   | Range           | Quality       | Recommendation                                        |
// | --------------- | ------------- | ----------------------------------------------------- |
// | **<10 words**   | Weak          | Too vague, expand for context                         |
// | **10–14 words** | Fair          | Acceptable for simple actions, but expand if possible |
// | **15–25 words** | Excellent     | Sweet spot—concise and detailed                       |
// | **26–30 words** | Good          | Still strong, tighten if possible                     |
// | **31–40 words** | Marginal      | Trim; split into two bullets if needed                |
// | **>40 words**   | Weak/Red Flag | Rework, split into multiple bullets                   |

  
  // Industry relevance check
  const bulletWords = bullet
    .replace(/(?!\d)['’\-](?!\d)/g, ' ')
    .split(/[^A-Za-z0-9%$]+/)
    .filter(w => w)
    .map(w => stemmer.stem(w.toLowerCase()));
  const industryKeywords = industryWords.filter(keyword =>
    bulletWords.includes(stemmer.stem(keyword.toLowerCase()))
  );
  const industryKeywordCount = industryKeywords.length;
  const industry = industryKeywordCount >= 3 ? 25 : (industryKeywordCount >= 1 ? 15 : 0);
  
  // Achievement-focused vs duty-focused check (with stemming)
  // Stemmed achievement check
  const stemmedAchievementKeywords = achievementKeywords.map(k => stemmer.stem(k.toLowerCase()));
  const hasAchievementLanguage = bulletWords.some(word => stemmedAchievementKeywords.includes(word));

  // Stemmed weak phrase check (n-gram match)
  const stemmedBullet = bullet
    .replace(/(?!\d)['’\-](?!\d)/g, ' ')
    .toLowerCase();
  const bulletTokens = stemmedBullet.split(/[^a-z0-9%$]+/).filter(Boolean);
  let hasWeakPhrasing = false;
  for (const phrase of weakPhrases) {
    const phraseTokens = phrase.toLowerCase().split(/\s+/).map(w => stemmer.stem(w));
    for (let i = 0; i <= bulletTokens.length - phraseTokens.length; i++) {
      const ngram = bulletTokens.slice(i, i + phraseTokens.length).map(w => stemmer.stem(w));
      if (ngram.join(' ') === phraseTokens.join(' ')) {
        hasWeakPhrasing = true;
        break;
      }
    }
    if (hasWeakPhrasing) break;
  }
  const achievement = hasAchievementLanguage ? 20 : (hasWeakPhrasing ? 0 : 10);
  
  // Calculate total score (max 100 points)
  const xyz_total = action + metrics + clarity + industry + achievement;
  
  return {
    action,
    metrics,
    clarity,
    industry,
    achievement,
    xyz_total
  };
}
// XYZ ATS Quality Check
// export function xyzCheck(bullet: string): {
//   hard_soft: number;
//   action_words: number;
//   measurable_results: number;
//   clarity_focus: number;
//   xyz_total: number;
// } {
//   const hasSkills = skillsKeywords.some(keyword => bullet.toLowerCase().includes(keyword));
//   const hard_soft = hasSkills ? 5 : 0;
  
//   const actionRegex = new RegExp(`^(${actionWords.map(w => w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})`,'i');
//   const startsWithAction = actionRegex.test(bullet);
//   const weakRegex = new RegExp(`\\b(${weakPhrases.map(phrase => phrase.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&')).join('|')})\\b`,'i');
//   const noWeakPhrasing = !weakRegex.test(bullet);
//   const action_words = (startsWithAction && noWeakPhrasing) ? 5 : (startsWithAction || noWeakPhrasing ? 3 : 0);
  
//   const hasNumbers = /\d+%|\d+x|\$\d+|\d+ percent|\d+k|\d+M|\d+B/i.test(bullet);
//   const measurable_results = hasNumbers ? 5 : 0;
  
//   const wordCount = bullet.split(/\s+/).length;
//   const isConcise = wordCount <= 25;
//   const clarity_focus = isConcise ? 5 : (wordCount <= 30 ? 3 : 0);
  
//   const xyz_total = hard_soft + action_words + measurable_results + clarity_focus;
  
//   return {
//     hard_soft,
//     action_words,
//     measurable_results,
//     clarity_focus,
//     xyz_total
//   };
// }