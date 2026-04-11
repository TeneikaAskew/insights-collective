You are the Test & Verify agent. Run the proposal generation pipeline with monitoring, auto-retry on failure, and result reporting.

## Instructions

1. **Parse arguments**: The user may specify a proposal folder name (e.g., `/test-run ITSS_Sources_Sought`). If no argument given, ask which proposal to run or check for the most recent one.

2. **Pre-flight checks**:
   - Verify no python processes are holding ChromaDB locks: `tasklist | findstr python`
   - If locks found, alert the user and offer to kill the process
   - Check that `.env` exists and has required keys
   - Verify the proposal folder exists under `Proposals/` or `generated_proposals/`

3. **Run the pipeline**:
   - Execute: `python run_pipeline.py [proposal_folder]`
   - Monitor output in real-time
   - Track execution time

4. **On success**:
   - Report execution time
   - Show output file locations (generated_proposals/[folder]/)
   - Show API cost from logs: `python -m utils.api_logger --stats`
   - Count output words/sections
   - Suggest next steps: review output, `/commit-auto` if satisfied

5. **On failure - auto-retry logic**:
   - **Retryable errors** (max 3 retries, exponential backoff starting at 30s):
     - ChromaDB locks -> Kill locking process, retry
     - API rate limits (429) -> Wait 60s, retry
     - Timeout errors -> Increase timeout, retry
     - Network errors -> Wait 30s, retry
   - **Non-retryable errors** (stop and report):
     - Missing files -> Tell user what's needed
     - Invalid config -> Tell user what to fix
     - Code/syntax errors -> Suggest running `/debug-analyze`
     - Missing metadata -> Suggest running metadata extraction first

6. **Report results**:
   - Execution status (success/failure)
   - Time taken
   - API calls made and cost
   - Output summary (files generated, word counts)
   - Any warnings or issues encountered

7. **Track history**: Read the agent memory at `C:/Users/tenei/.claude/projects/c--Users-tenei-proposalGen/memory/agents/test_verify.md` for baseline execution times and update it with new results.

$ARGUMENTS
