You are the Audit & Review agent for the A3 ProposalGen pipeline. Perform a comprehensive production-readiness audit of the entire codebase, generate a scored report, and flag actionable findings.

## Phase 1: Run Automated Tests

1. Run the full pytest suite and capture results:
   ```
   cd /c/Users/tenei/proposalGen && python -m pytest tests/test_fact_verification.py tests/test_config_validation.py tests/test_retrieval_quality.py tests/test_anti_hallucination.py tests/test_scorer_independence.py -v --tb=short 2>&1
   ```
   Note: pass/fail/xfail counts per suite. Failures are HIGH severity findings.

2. Run config validator:
   ```
   python -m utils.config_validator 2>&1
   ```
   Any validation errors = HIGH severity finding.

3. Check API call stats:
   ```
   python -m utils.api_logger --stats 2>&1
   ```
   Note model usage, error rates, cost trends.

## Phase 2: Code Quality Checks

Run these grep-based scans and record counts:

4. **Silent exception handling** (HIGH risk pattern):
   ```
   grep -rn "except Exception.*pass\|except:$\|except Exception:$" pipeline/ utils/ proposal_evaluator/ sam_gov_opportunities/ --include="*.py" 2>&1
   ```
   Any match = finding.

5. **Wrong Gemini model version** (CRITICAL - violates CLAUDE.md):
   ```
   grep -rn "gemini-2\.0\|gemini-1\." pipeline/ utils/ config/ sam_gov_opportunities/ --include="*.py" 2>&1
   ```
   Any match = CRITICAL finding.

6. **API calls missing log_api_call** (CLAUDE.md requirement):
   ```
   grep -rn "model\.generate_content\|genai\.generate\|GenerativeModel(" pipeline/ utils/ sam_gov_opportunities/ --include="*.py" -l 2>&1
   ```
   Then for each file found, check if `log_api_call` is also present in that file:
   ```
   grep -rn "log_api_call" pipeline/ utils/ sam_gov_opportunities/ --include="*.py" -l 2>&1
   ```
   Files with generate but no log = MEDIUM finding.

7. **Hardcoded secrets or project IDs** (security risk):
   ```
   grep -rn "nomadic-tracker-486116-r6\|GEMINI_API_KEY.*=.*'" pipeline/ utils/ sam_gov_opportunities/ --include="*.py" 2>&1 | grep -v "config/gcp_config\|gcp_config.py\|\.env\|gcloud\|#"
   ```
   Any hardcoded secret outside of gcp_config.py = MEDIUM finding.

8. **Direct os.environ.get for secrets** (violates CLAUDE.md anti-pattern):
   ```
   grep -rn "os\.environ\.get.*API_KEY\|os\.environ\.get.*PASSWORD\|os\.environ\.get.*SECRET\|os\.environ\.get.*TOKEN" pipeline/ utils/ sam_gov_opportunities/ --include="*.py" 2>&1 | grep -v "gcp_config\|IS_CLOUD_RUN\|CLOUD_RUN\|PORT\|HOST"
   ```
   Any match = MEDIUM finding.

9. **Temperature values in generation code** (should be <= 0.2 for factual tasks):
   ```
   grep -rn "temperature.*=.*0\.[3-9]\|temperature.*=.*[1-9]\." pipeline/ --include="*.py" 2>&1
   ```
   temperature > 0.2 in generate_response = HIGH finding.

10. **Fallback similarity floor** (should be >= 0.35):
    ```
    grep -rn "min_similarity.*=.*0\.[0-2][0-9]\|similarity.*0\.1[0-9]\b" pipeline/ --include="*.py" 2>&1
    ```
    Any floor < 0.35 = HIGH finding.

11. **IS_CLOUD_RUN defined locally** (violates CLAUDE.md):
    ```
    grep -rn "IS_CLOUD_RUN\s*=" pipeline/ utils/ sam_gov_opportunities/ --include="*.py" 2>&1 | grep -v "from config.gcp_config\|config/gcp_config"
    ```

12. **Unicode/non-ASCII characters in code** (violates CLAUDE.md forbidden chars):
    ```
    grep -Prn "[^\x00-\x7F]" pipeline/ utils/ --include="*.py" 2>&1 | head -30
    ```

## Phase 3: Architecture & Config Checks

13. **Check ChromaDB collection health**:
    ```
    python -c "
    import chromadb
    client = chromadb.PersistentClient(path='rag/chroma_db')
    for col in client.list_collections():
        c = client.get_collection(col.name)
        print(f'{col.name}: {c.count()} docs')
    " 2>&1
    ```
    Zero counts = HIGH finding.

14. **Check proposal metadata for required fields**:
    ```
    python -c "
    import json, glob, os
    required = ['rfi_id', 'source_document', 'questions']
    issues = []
    for f in glob.glob('generated_proposals/*/proposal_metadata.json'):
        try:
            d = json.load(open(f, encoding='utf-8'))
            missing = [k for k in required if k not in d]
            if missing:
                issues.append(f'{f}: missing {missing}')
        except Exception as e:
            issues.append(f'{f}: parse error {e}')
    print('\n'.join(issues) if issues else 'All metadata valid')
    " 2>&1
    ```

15. **Check for uncommitted changes that could affect behavior**:
    ```
    git diff --stat HEAD 2>&1
    git status --short 2>&1
    ```

16. **Review recent commits for risky patterns**:
    ```
    git log --oneline -10 2>&1
    ```

17. **Check for TODO/FIXME/HACK comments in production code**:
    ```
    grep -rn "TODO\|FIXME\|HACK\|XXX\|BANDAID" pipeline/ utils/ proposal_evaluator/ --include="*.py" 2>&1 | head -30
    ```

## Phase 4: Generate Scorecard & Report

After collecting all data above, produce a structured report:

### Scorecard (score each 1-10, same rubric as PRODUCTION_AUDIT.md)

Score based on findings:
- 9-10: Production-grade, no significant issues
- 7-8: Good with minor issues
- 5-6: Functional but needs hardening
- 3-4: Significant gaps
- 1-2: Critical issues, not production-ready

| Component | Score | Issues Found |
|-----------|-------|--------------|
| Classification Pipeline (01-03) | X/10 | ... |
| Chunking & Extraction (04) | X/10 | ... |
| Embedding & Indexing (05) | X/10 | ... |
| Response Generation (08) | X/10 | ... |
| Quality Evaluation (11) | X/10 | ... |
| Source Verification | X/10 | ... |
| Config & Validation | X/10 | ... |
| Error Handling | X/10 | ... |
| Test Coverage | X/10 | ... |
| Anti-Hallucination | X/10 | ... |
| Code Style / CLAUDE.md Compliance | X/10 | ... |
| Secret Management | X/10 | ... |
| **OVERALL** | **X/10** | ... |

### Findings Summary

Organize findings by severity:

**CRITICAL** (must fix before production):
- List each with: What | File:Line | Risk | Recommended Fix

**HIGH** (significant risk):
- List each with: What | File:Line | Risk | Recommended Fix

**MEDIUM** (should fix):
- List each with: What | File:Line | Risk | Recommended Fix

**LOW / INFO** (monitor or nice-to-have):
- Brief list

### Test Results Summary

| Suite | Total | Passed | Failed | XFail | XPass |
|-------|-------|--------|--------|-------|-------|
| test_fact_verification | - | - | - | - | - |
| test_config_validation | - | - | - | - | - |
| test_retrieval_quality | - | - | - | - | - |
| test_anti_hallucination | - | - | - | - | - |
| test_scorer_independence | - | - | - | - | - |
| **TOTAL** | - | - | - | - | - |

### Delta from Last Audit (2026-02-14 baseline: 5.3/10 overall)

Note what improved, regressed, or is unchanged vs the PRODUCTION_AUDIT.md baseline.

### Action Items

Number and prioritize all CRITICAL and HIGH findings as a TODO list. For each:
- Item number and description
- File + line to change
- Specific fix command or code snippet
- Offer to implement each fix

## Agent Memory

Read `C:/Users/tenei/.claude/projects/c--Users-tenei-proposalGen/memory/agents/audit_review.md` if it exists for known recurring patterns. After the audit, update or create that file with:
- Any new recurring issues discovered
- Patterns that were clean (no longer need checking)
- Score trend over time

$ARGUMENTS
