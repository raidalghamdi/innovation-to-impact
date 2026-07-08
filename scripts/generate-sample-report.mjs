// Generate a sample PDF report locally to preview the renderer output.
// Uses a hand-crafted ReportBundle with realistic data so we don't touch Supabase.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.chdir(path.resolve(__dirname, '..'));

// Register tsx-style loader via require of the compiled ESM? Easier: use ts-node/esm through node --loader.
// Instead, we'll import the compiled .ts by using the Next.js build's transpile through esbuild-register.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register('ts-node/esm', pathToFileURL('./'));
