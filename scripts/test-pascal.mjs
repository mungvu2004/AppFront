// `bun test` cho bốn gói vendor Pascal. Test của vendor là `bun:test`, không phải vitest,
// nên `pnpm verify` KHÔNG gọi script này (vendor nằm ngoài cổng — xem `vendor/pascal/NGUON.md`);
// chạy riêng: `pnpm test:pascal`. Mã thoát là mã thoát xấu nhất của bốn lượt.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const packages = ['core', 'viewer', 'nodes', 'editor']
const root = fileURLToPath(new URL('../vendor/pascal/packages/', import.meta.url))
let failed = 0

for (const name of packages) {
  console.log(`\n=== bun test ${name} ===`)
  const run = spawnSync('bun', ['test'], {
    cwd: root + name,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (run.status !== 0) {
    failed += 1
    console.log(`=== ${name}: FAILED (exit ${run.status}) ===`)
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${packages.length} gói vendor có bài hỏng.`)
  process.exit(1)
}
console.log('\nBốn gói vendor xanh.')
