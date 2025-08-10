$passes = 0
$fails = 0

for ($i = 1; $i -le 10; $i++) {
  Write-Host ("--- 実行 #$i ---")
  deno test -A tests/api/werewolf-victory-scenario.test.ts
  if ($LASTEXITCODE -ne 0) {
    $fails++
  } else {
    $passes++
  }
}

Write-Host ("Summary: 成功=$passes 失敗=$fails")
if ($fails -gt 0) { exit 1 }
