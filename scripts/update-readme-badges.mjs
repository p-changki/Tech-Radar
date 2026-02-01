import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();

const parseOrigin = (origin) => {
  if (!origin) return null;
  const sshMatch = origin.match(/git@github.com:([^/]+)\/(.+?)(\.git)?$/);
  if (sshMatch) return `${sshMatch[1]}/${sshMatch[2]}`;
  const httpsMatch = origin.match(/https?:\/\/github.com\/([^/]+)\/(.+?)(\.git)?$/);
  if (httpsMatch) return `${httpsMatch[1]}/${httpsMatch[2]}`;
  return null;
};

let origin = '';
try {
  origin = run('git remote get-url origin');
} catch {
  origin = '';
}

const repoPath = parseOrigin(origin);
if (!repoPath) {
  console.log('origin remote not found or not a GitHub URL.');
  console.log('Set origin first: git remote add origin https://github.com/<OWNER>/<REPO>.git');
  process.exit(1);
}

const readmePath = new URL('../README.md', import.meta.url);
const readme = readFileSync(readmePath, 'utf8');
const updated = readme.replaceAll('<OWNER>/<REPO>', repoPath);

if (updated === readme) {
  console.log('No <OWNER>/<REPO> placeholders found in README.md.');
  process.exit(0);
}

writeFileSync(readmePath, updated);
console.log(`Updated README badges to ${repoPath}.`);
