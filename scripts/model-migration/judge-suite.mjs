// Known-ground-truth judging suite for the Groq model migration.
// Each case has an unambiguous expected verdict, so "graded_right" is meaningful.
const LOG_PARSER = "c0de0003-0000-4000-8000-000000000003"; // python, parse_logs, compare_mode=set
const KPI = "c0de0005-0000-4000-8000-000000000005";        // javascript, solution, exact

const cases = [
  {
    label: "log-parser/correct",
    challenge_id: LOG_PARSER,
    expected_verdict: "correct",
    code: `def parse_logs(lines, n):
    counts = {}
    for line in lines:
        ip = line.split(' ')[0]
        counts[ip] = counts.get(ip, 0) + 1
    return [ip for ip, c in counts.items() if c > n]`,
  },
  {
    label: "log-parser/off-by-one (>= instead of >)",
    challenge_id: LOG_PARSER,
    expected_verdict: "incorrect",
    code: `def parse_logs(lines, n):
    counts = {}
    for line in lines:
        ip = line.split(' ')[0]
        counts[ip] = counts.get(ip, 0) + 1
    return [ip for ip, c in counts.items() if c >= n]`,
  },
  {
    label: "log-parser/correct-but-reversed-order (set mode must accept)",
    challenge_id: LOG_PARSER,
    expected_verdict: "correct",
    code: `def parse_logs(lines, n):
    counts = {}
    for line in lines:
        ip = line.split(' ')[0]
        counts[ip] = counts.get(ip, 0) + 1
    return [ip for ip, c in counts.items() if c > n][::-1]`,
  },
  {
    label: "kpi/correct (rounded to 2dp)",
    challenge_id: KPI,
    expected_verdict: "correct",
    code: `function solution(values) {
  return values.map((v, i) => {
    if (i === 0) return null;
    const pct = ((v - values[i - 1]) / values[i - 1]) * 100;
    return Math.round(pct * 100) / 100;
  });
}`,
  },
  {
    label: "kpi/missing-rounding (returns full precision)",
    challenge_id: KPI,
    expected_verdict: "incorrect",
    code: `function solution(values) {
  return values.map((v, i) => {
    if (i === 0) return null;
    return ((v - values[i - 1]) / values[i - 1]) * 100;
  });
}`,
  },
  {
    label: "kpi/empty-stub (control, matches production corpus)",
    challenge_id: KPI,
    expected_verdict: "incorrect",
    code: `function solution(values) {
  // Return percent change for each period
}`,
  },
];

const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/model-compare-judge`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error("no service key in env"); process.exit(1); }

const extra = JSON.parse(process.argv[2] ?? "{}");
const { sliceCases, ...rest } = extra;
const selected = sliceCases ? cases.slice(sliceCases[0], sliceCases[1]) : cases;
const resp = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ cases: selected, delayMs: 5000, ...rest }),
});
console.log(`HTTP ${resp.status}`);
console.log(await resp.text());
