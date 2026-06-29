import { spawnSync } from "node:child_process";
import { join } from "node:path";

const testFiles = [
  "tests/rentalSheetParser.test.ts",
  "tests/jun29CleanParser.test.ts",
];
const runner = process.execPath;
const jitiCli = join("node_modules", "jiti", "lib", "jiti-cli.mjs");

for (const testFile of testFiles) {
  const result = spawnSync(runner, [jitiCli, testFile], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
