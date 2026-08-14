const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const versionFile = path.join(__dirname, '..', 'version.json');
const versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));

function getGitCommitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getGitDate() {
  try {
    return execSync('git log -1 --format=%cI', { encoding: 'utf8' }).trim();
  } catch {
    return new Date().toISOString();
  }
}

const args = process.argv.slice(2);
const isRelease = args.includes('--release');
const isPatch = args.includes('--patch');
const isMinor = args.includes('--minor');
const isMajor = args.includes('--major');

if (isRelease || isPatch || isMinor || isMajor) {
  const [major, minor, patch] = versionData.version.split('.').map(Number);

  if (isMajor) {
    versionData.version = `${major + 1}.0.0`;
  } else if (isMinor) {
    versionData.version = `${major}.${minor + 1}.0`;
  } else if (isPatch || isRelease) {
    versionData.version = `${major}.${minor}.${patch + 1}`;
  }
}

versionData.build += 1;
versionData.buildId = `${versionData.version}-${versionData.build}`;
versionData.commitSha = getGitCommitSha();
versionData.buildDate = getGitDate();

fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));

console.log(`Version: ${versionData.version}`);
console.log(`Build: ${versionData.build}`);
console.log(`Build ID: ${versionData.buildId}`);
console.log(`Commit: ${versionData.commitSha}`);
console.log(`Date: ${versionData.buildDate}`);