// Interactive builder that runs `claat export <ID>` for selected docs,
// then enforces favicon tags via the post-build script.
// Usage: node scripts/claat-build.js
// Optional non-interactive: node scripts/claat-build.js 1,3

const { spawnSync } = require('child_process');
const path = require('path');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');

const DOCS = [
  { num: 1, name: 'glean-search', id: '16x-OdU8ooq3FszzRhmj-8hLzJejvYKGIVADoPWnlvos', outDir: '1-glean-search' },
  { num: 2, name: 'glean-chat',   id: '1AYqOEx4SQ9UgA_0fSpwV0ydjjBLhK1sv1-r8uuje07w', outDir: '2-glean-assistant' },
  { num: 3, name: 'glean-agent',  id: '1tw7IPtWMpOumljfOmLRrQ3O_P8Fxt7U5rT8BpFCnA6w', outDir: '3-glean-agents' },
];

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, shell: true, ...opts });
  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runClaatExportWithRetry(doc) {
  const MAX_RETRIES = 5;
  let delayMs = 5000; // 5s -> 10s -> 20s -> 40s -> 60s cap

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`\n[claat] exporting ${doc.name} (attempt ${attempt}/${MAX_RETRIES}) -> ./${doc.outDir}`);
    const res = spawnSync('claat', ['export', '-o', doc.outDir, doc.id], {
      cwd: ROOT,
      shell: true,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    if (res.stdout) process.stdout.write(res.stdout);
    if (res.stderr) process.stderr.write(res.stderr);

    if (res.status === 0) {
      return; // success
    }

    const combined = `${res.stdout || ''}${res.stderr || ''}`;
    const is429 = /429|Too\s+Many\s+Requests/i.test(combined);
    if (is429 && attempt < MAX_RETRIES) {
      const waitSec = Math.round(delayMs / 1000);
      console.warn(`[claat] 429 Too Many Requests を検出。${waitSec}s 待ってリトライします...`);
      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, 60000);
      continue;
    }

    // 非429の失敗、またはリトライ尽きた場合は終了
    process.exit(res.status || 1);
  }

  console.error('[claat] リトライ回数上限に達しました。処理を終了します。');
  process.exit(1);
}

function parseSelection(input) {
  const tokens = String(input)
    .split(/[^0-9]+/)
    .map(t => t.trim())
    .filter(Boolean);
  const nums = Array.from(new Set(tokens.map(t => parseInt(t, 10)).filter(n => [1,2,3].includes(n))));
  return nums
    .map(n => DOCS.find(d => d.num === n))
    .filter(Boolean);
}

function printMenu() {
  console.log('どのドキュメントをビルドしますか？');
  console.log('1. glean-search: 16x-OdU8ooq3FszzRhmj-8hLzJejvYKGIVADoPWnlvos');
  console.log('2. glean-chat: 1AYqOEx4SQ9UgA_0fSpwV0ydjjBLhK1sv1-r8uuje07w');
  console.log('3. glean-agent: 1tw7IPtWMpOumljfOmLRrQ3O_P8Fxt7U5rT8BpFCnA6w');
  console.log('\n番号をカンマ区切りで入力してください (例: 1,3)');
}

async function main() {
  // Non-interactive CLI usage: node scripts/claat-build.js 1,3
  const argSel = process.argv[2];
  let selected = [];

  if (argSel) {
    selected = parseSelection(argSel);
  } else {
    printMenu();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => rl.question('> ', ans => { rl.close(); resolve(ans); }));
    selected = parseSelection(answer);
  }

  if (selected.length === 0) {
    console.log('有効な番号が選択されませんでした。処理を終了します。');
    process.exit(1);
  }

  // Run claat export for each selection with retry/backoff
  for (const doc of selected) {
    await runClaatExportWithRetry(doc);
    // small gap between docs to be gentle on rate limits
    await sleep(1500);
  }

  // Enforce favicon tags
  console.log('\n[postbuild] favicon を挿入/更新します...');
  run('node', [path.join('scripts', 'postbuild-favicon.js')]);

  console.log('\n完了しました。');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


