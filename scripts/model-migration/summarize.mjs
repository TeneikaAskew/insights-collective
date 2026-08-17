import { readFileSync } from 'fs';
const raw = readFileSync(process.argv[2],'utf8').replace(/^HTTP \d+\n/,'');
const d = JSON.parse(raw);
for (const r of d.results) {
  console.log('='.repeat(78));
  console.log(`CHALLENGE: ${r.challenge}  |  lang=${r.language}  |  mode=${r.mode}`);
  console.log(`attempt ${r.attempt_id.slice(0,8)}  passed_tests=${r.ground_truth_passed}`);
  console.log('-'.repeat(78));
  const b = r.production_baseline;
  console.log(`[PRODUCTION BASELINE — llama-3.3-70b-versatile, stored ${r.created_at.slice(0,10)}]`);
  console.log('  review:', JSON.stringify(b?.review ?? null));
  console.log('  suggestions:', JSON.stringify(b?.suggestions ?? null, null, 0));
  for (const c of r.candidates) {
    console.log('-'.repeat(78));
    if (!c.ok) { console.log(`[${c.model}] FAILED status=${c.status} ${c.error?.slice(0,200)}`); continue; }
    console.log(`[${c.model}]  ${c.latency_ms}ms  in=${c.usage?.prompt_tokens} out=${c.usage?.completion_tokens}  finish=${c.finish_reason}  prodParserOK=${c.prod_parser_ok}  reasoningField=${c.emitted_reasoning_field}`);
    console.log('  review:', JSON.stringify(c.parsed?.review ?? null));
    console.log('  suggestions:', JSON.stringify(c.parsed?.suggestions ?? null, null, 0));
    if (!c.prod_parser_ok) console.log('  RAW(400):', JSON.stringify(c.raw_content.slice(0,400)));
  }
}
