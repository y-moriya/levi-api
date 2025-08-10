// deno-lint-ignore-file no-explicit-any
// 簡易: .tsファイルの行数を数えて400行超を一覧表示するDenoスクリプト
// 使い方: deno run -A scripts/list-large-files.ts [閾値(省略時400)]

const THRESHOLD = Number(Deno.args[0] ?? 400);

type Entry = { path: string; lines: number };

async function* walk(dir: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(dir)) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      // node_modulesや.gitなどはスキップ
      if (/node_modules|\.git|\.vscode/.test(full)) continue;
      yield* walk(full);
    } else if (entry.isFile) {
      // .tsのみ（.d.tsや.ts.newは除外）
      if (full.endsWith(".ts") && !full.endsWith(".d.ts") && !full.endsWith(".ts.new")) {
        yield full;
      }
    }
  }
}

async function countLines(path: string): Promise<number> {
  const text = await Deno.readTextFile(path);
  // 最後の行もカウント
  return (text.match(/\n/g)?.length ?? 0) + 1;
}

function toRelative(path: string): string {
  const cwd = Deno.cwd().replaceAll("\\", "/");
  return path.replaceAll("\\", "/").replace(cwd + "/", "");
}

const entries: Entry[] = [];
for await (const file of walk(Deno.cwd())) {
  try {
    const lines = await countLines(file);
    if (lines > THRESHOLD) entries.push({ path: toRelative(file), lines });
  } catch (e) {
    console.error(`読み込み失敗: ${file}`, e);
  }
}

entries.sort((a, b) => b.lines - a.lines);

// テーブル表示
console.log(`閾値: ${THRESHOLD} 行\n`);
console.log("行数\tパス");
for (const e of entries) {
  console.log(`${e.lines}\t${e.path}`);
}

// JSONも併せて出力（機械可読）
console.log("\nJSON:");
console.log(JSON.stringify(entries, null, 2));
