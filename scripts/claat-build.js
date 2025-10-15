// Interactive builder that runs `claat export <ID>` for selected docs,
// then enforces favicon tags via the post-build script.
// Usage: node scripts/claat-build.js
// Optional non-interactive: node scripts/claat-build.js 1,3

const { spawnSync } = require('child_process');
const fs = require('fs');
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
    console.log(`[cmd] claat export ${doc.id}`);
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

function validateOutDir(doc) {
  const dirPath = path.join(ROOT, doc.outDir);
  const indexPath = path.join(dirPath, 'index.html');
  if (!fs.existsSync(dirPath)) {
    console.error(`[validate] 出力ディレクトリが見つかりません: ${doc.outDir}`);
    console.error('claat の出力先が想定外です。-o で明示的な出力先を指定してください。');
    process.exit(1);
  }
  if (!fs.existsSync(indexPath)) {
    console.error(`[validate] ${doc.outDir}/index.html が見つかりません。ディレクトリ構成が想定と異なります。`);
    console.error('claat の出力がサブディレクトリに入っていないかをご確認ください。');
    process.exit(1);
  }
  console.log(`[validate] OK: ${doc.outDir}/index.html`);
}

function parseSelection(input) {
  const tokens = String(input)
    .split(/[\s,]+/)
    .map(t => t.trim())
    .filter(Boolean);
  const selected = [];
  for (const tok of tokens) {
    const asNum = parseInt(tok, 10);
    if (!Number.isNaN(asNum) && [1, 2, 3].includes(asNum)) {
      const found = DOCS.find(d => d.num === asNum);
      if (found) selected.push(found);
      continue;
    }
    const byId = DOCS.find(d => d.id === tok);
    if (byId) selected.push(byId);
  }
  // de-dup by id
  const seen = new Set();
  return selected.filter(d => (seen.has(d.id) ? false : (seen.add(d.id), true)));
}

function printMenu() {
  console.log('どのドキュメントをビルドしますか？');
  console.log('1. glean-search: 16x-OdU8ooq3FszzRhmj-8hLzJejvYKGIVADoPWnlvos');
  console.log('2. glean-chat: 1AYqOEx4SQ9UgA_0fSpwV0ydjjBLhK1sv1-r8uuje07w');
  console.log('3. glean-agent: 1tw7IPtWMpOumljfOmLRrQ3O_P8Fxt7U5rT8BpFCnA6w');
  console.log('\n番号またはIDをカンマ区切りで入力してください (例: 1,3 または 1tw7IPtW...,1AYqOE...)');
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
    validateOutDir(doc);
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


