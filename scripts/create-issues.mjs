// Створює мітки, віхи (milestones) та issues із scripts/issues.json через GitHub CLI (gh).
// За замовчуванням лише показує, що буде зроблено. Для виконання: node scripts/create-issues.mjs --apply
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const apply = process.argv.includes('--apply');
const data = JSON.parse(readFileSync(new URL('./issues.json', import.meta.url), 'utf8'));

function gh(args, { ignoreError = false } = {}) {
  if (!apply) { console.log('gh ' + args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')); return ''; }
  try { return execFileSync('gh', args, { encoding: 'utf8' }); }
  catch (e) { if (!ignoreError) throw e; return ''; }
}

for (const l of data.labels) gh(['label', 'create', l, '--force']);
for (const m of data.milestones) gh(['api', 'repos/{owner}/{repo}/milestones', '-f', `title=${m}`], { ignoreError: true });
for (const i of data.issues) {
  const args = ['issue', 'create', '--title', i.title, '--body', i.body, '--milestone', i.milestone];
  for (const l of i.labels) args.push('--label', l);
  gh(args);
}
console.log(apply ? `Створено ${data.issues.length} issues` : `Пробний запуск: ${data.issues.length} issues. Додайте --apply, щоб виконати.`);
