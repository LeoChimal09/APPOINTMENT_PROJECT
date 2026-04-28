import { execSync } from "node:child_process";

const suspiciousPatterns = [
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /password/i,
  /DATABASE_URL/i,
  /OWNER_DASHBOARD_TOKEN/i,
  /-----BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /sk_(live|test)_[0-9a-zA-Z]{16,}/,
];

function getStagedFiles() {
  const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return output
    .split("\n")
    .map((filePath) => filePath.trim())
    .filter(Boolean);
}

function getStagedContent(filePath) {
  return execSync(`git show :${filePath}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function main() {
  const stagedFiles = getStagedFiles();
  const findings = [];

  for (const filePath of stagedFiles) {
    let content = "";

    try {
      content = getStagedContent(filePath);
    } catch {
      continue;
    }

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        findings.push({ filePath, pattern: pattern.toString() });
      }
    }
  }

  if (findings.length > 0) {
    console.error("Potential secret-like content found in staged files:");
    for (const finding of findings) {
      console.error(`- ${finding.filePath} matched ${finding.pattern}`);
    }
    process.exit(1);
  }

  console.log("No obvious secrets found in staged files.");
}

main();
