import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const options = { stdio: "inherit", env: { ...process.env, WRANGLER_WRITE_LOGS: "false", WRANGLER_LOG_PATH: ".wrangler/logs" } };
for (const [module, args] of [["wrangler/bin/wrangler.js", ["types", "worker-configuration.d.ts", "-c", "wrangler.types.jsonc", "--include-env", "false"]], ["typescript/bin/tsc", ["--noEmit"]]]) {
  const result = spawnSync(process.execPath, [require.resolve(module), ...args], options);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
