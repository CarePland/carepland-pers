import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const now = new Date();
const buildDttm = new Intl.DateTimeFormat("en-US", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Los_Angeles",
}).format(now);

let buildNumber = "";

try {
  buildNumber = execSync("git rev-parse --short=8 HEAD", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {
  buildNumber = "";
}

writeFileSync(
  "app/build-info.ts",
  `export const generatedBuildDttm = ${JSON.stringify(buildDttm)};\n` +
    `export const generatedBuildNumber = ${JSON.stringify(buildNumber)};\n`
);
