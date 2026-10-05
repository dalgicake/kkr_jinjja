// PLAN 7.4 eval: command-line options.
import { DEFAULT_MODEL_TAG } from '../../server/env.js';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

export interface CliOptions {
  draft: boolean;
  force: boolean;
  help: boolean;
  dir: string | null;
}

export function parseArgs(argv: readonly string[]): CliOptions | { error: string } {
  const opts: CliOptions = { draft: false, force: false, help: false, dir: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--draft') opts.draft = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--dir') {
      const v = argv[++i];
      if (!v) return { error: '--dir needs a path' };
      opts.dir = v;
    } else return { error: `unknown option: ${a}` };
  }
  if (opts.force && !opts.draft) return { error: '--force only applies to --draft' };
  return opts;
}

export const HELP = `eval-tags — PLAN 7.4 price-tag reading accuracy

  npm run eval:tags                     score fixtures/tags/NNN.jpg against NNN.json → fixtures/tags/_report.md
  npm run eval:tags -- --draft          write NNN.draft.json (model output) for photos without NNN.json
  npm run eval:tags -- --draft --force  also overwrite existing NNN.draft.json (never NNN.json)
  --dir <path>                          use another fixture folder

Env: ANTHROPIC_API_KEY (required), MODEL_TAG (default ${DEFAULT_MODEL_TAG}).
.env.local / .env are read if present; values already in the shell win.`;
