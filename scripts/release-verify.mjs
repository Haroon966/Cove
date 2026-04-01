import { spawn } from "node:child_process";

function run(command, args, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
    });
  });
}

async function main() {
  await run("npm", ["run", "build"]);
  await run("npx", [
    "vitest",
    "run",
    "src/e2e/parityCriticalScenarios.test.ts",
    "src/features/integration/majorFlows.test.ts",
    "src/features/integration/configPersistenceParity.test.ts",
  ]);
  await run("cargo", ["check"], `${process.cwd()}/src-tauri`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

