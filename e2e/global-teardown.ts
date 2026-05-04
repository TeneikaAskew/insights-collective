import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function globalTeardown(): Promise<void> {
  const sessionsDir = path.join(process.cwd(), '.playwright-sessions');
  // Clean up session files in CI to avoid stale tokens being committed
  if (process.env.CI && fs.existsSync(sessionsDir)) {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
    console.log('[global-teardown] Cleaned up .playwright-sessions/');
  }
}

export default globalTeardown;
