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

// Add specific industry keywords but exclude EEO and boilerplate terms
export const excludedIndustryTerms = [
  "equal", "opportunity", "employer", "eeo", "discriminate", "protected", "veteran", 
  "status", "disability", "legally", "race", "color", "national", "origin", "sexual",
  "orientation", "gender", "identity", "ethnicity", "marital", "citizenship", "ancestry", 
  "genetic", "information", "accommodation", "reasonable", "affirmative", "action", 
  "retaliation", "harassment", "recruit", "pregnancy", "pregnant", "parental", 
  "familial", "caregiver", "military", "service", "qualified", "regardless"
];

// Filter out excluded terms from industryWords
const filteredIndustryWords = industryWords.filter(word => !excludedIndustryTerms.includes(word));

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

// Filter out any potential EDO terms from softSkills
export const filteredSoftSkills = softSkills.filter(skill => !excludedIndustryTerms.includes(skill));

// For keyword matching, use the filtered lists
export const skillsKeywords = [...filteredIndustryWords, ...actionWords, ...filteredSoftSkills];

// Use this to identify weak phrases in resumes
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

// Function to detect EEO statements in bullet points
export function isEEOStatement(text) {
  const eeoPatterns = [
    /equal.*opportunity.*employer/i,
    /eeo|eeoc/i,
    /discriminat(e|ion|ing|ory)/i,
    /protect(ed)?\s*(class|status|veteran|characteristics)/i,
    /diversity.*inclusion/i,
    /inclusion.*diversity/i,
    /affirmative\s*action/i,
    /(regard|irrespective|regardless)\s*of\s*(race|gender|religion|age|disability|orientation)/i,
    /we\s*(are|provide)\s*an\s*equal\s*opportunity/i,
    /qualified\s*(applicants|candidates)/i,
    /without\s*regard\s*to/i,
    /prohibit(s|ed)?\s*discrimination/i
  ];
  
  return eeoPatterns.some(pattern => pattern.test(text));
}

// Analyze word balance
export function analyzeWordBalance(bullet) {
  // Skip analysis for EEO statements
  if (isEEOStatement(bullet)) {
    return {
      industry_pct: 0,
      common_pct: 0,
      action_pct: 0,
      metric_pct: 0,
      word_balance_score: 0
    };
  }
  
  const words = bullet.split(/\s+/);
  
  let industryCount = 0;
  let commonCount = 0;
  let actionCount = 0;
  let metricCount = 0;
  
  for (const word of words) {
    const cleanWord = word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    
    if (/\d/.test(cleanWord) || /%|\$/.test(cleanWord)) {
      metricCount++;
    }
    else if (actionWords.includes(cleanWord)) {
      actionCount++;
    }
    else if (filteredIndustryWords.includes(cleanWord)) {
      industryCount++;
    }
    else {
      commonCount++;
    }
  }
  
  const totalWords = words.length;
  const industry_pct = Math.round((industryCount / totalWords) * 100);
  const common_pct = Math.round((commonCount / totalWords) * 100);
  const action_pct = Math.round((actionCount / totalWords) * 100);
  const metric_pct = Math.round((metricCount / totalWords) * 100);
  
  const idealIndustry = 45;
  const idealCommon = 25;
  const idealAction = 15;
  const idealMetric = 15;
  
  const industryDev = Math.abs(industry_pct - idealIndustry);
  const commonDev = Math.abs(common_pct - idealCommon);
  const actionDev = Math.abs(action_pct - idealAction);
  const metricDev = Math.abs(metric_pct - idealMetric);
  
  const totalDeviation = industryDev + commonDev + actionDev + metricDev;
  const word_balance_score = Math.max(0, 25 - totalDeviation);
  
  return {
    industry_pct,
    common_pct,
    action_pct,
    metric_pct,
    word_balance_score
  };
}

// XYZ ATS Quality Check - Enhanced version with EEO statement filtering
export function xyzCheck(bullet) {
  // Skip scoring for EEO statements
  if (isEEOStatement(bullet)) {
    return {
      action: 0,
      metrics: 0,
      clarity: 0,
      industry: 0,
      achievement: 0,
      xyz_total: 0
    };
  }
  
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
  const clarity = wordCount <= 7 ? 0 : (wordCount <= 20 ? 15 : (wordCount <= 30 ? 10 : 5));
  
  // Industry relevance check
  const industryKeywords = filteredIndustryWords.filter(keyword => 
    bullet.toLowerCase().includes(keyword.toLowerCase())
  );
  const industryKeywordCount = industryKeywords.length;
  const industry = industryKeywordCount >= 3 ? 25 : (industryKeywordCount >= 1 ? 15 : 0);
  
  // Achievement-focused vs duty-focused check
  const weakRegex = new RegExp(`\\b(${weakPhrases.map(phrase => phrase.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`,'i');
  const hasWeakPhrasing = weakRegex.test(bullet);
  const achievementKeywords = ["achieved", "improved", "increased", "reduced", "led", "created", "developed"];
  const hasAchievementLanguage = achievementKeywords.some(keyword => bullet.toLowerCase().includes(keyword));
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

// Keep the commented out older version for reference
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
