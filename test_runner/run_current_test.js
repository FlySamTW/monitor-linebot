const { spawnSync } = require("child_process");
const path = require("path");

const testScript = process.argv[2];
const extraArgs = process.argv.slice(3);

if (!testScript) {
  console.error("Usage: node run_current_test.js <verify_script.js> [args...]");
  process.exit(1);
}

if (path.isAbsolute(testScript) || testScript.includes("..")) {
  console.error("Refusing to run a test outside test_runner.");
  process.exit(1);
}

const guardPath = path.join(__dirname, "ensure_formal_version_current.js");
const testPath = path.join(__dirname, testScript);

const guard = spawnSync(process.execPath, [guardPath], {
  cwd: __dirname,
  stdio: "inherit",
});

if (guard.status !== 0) {
  process.exit(guard.status || 1);
}

const test = spawnSync(process.execPath, [testPath, ...extraArgs], {
  cwd: __dirname,
  stdio: "inherit",
});

process.exit(test.status || 0);
