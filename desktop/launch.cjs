/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require("node:child_process");
const electron = require("electron");

const child = spawn(electron, ["desktop/main.cjs"], {
  stdio: "inherit",
  env: { ...process.env, ATLAS_IN_PROCESS_GPU: process.platform === "win32" ? "1" : process.env.ATLAS_IN_PROCESS_GPU },
});
child.on("exit", code => process.exit(code ?? 0));
