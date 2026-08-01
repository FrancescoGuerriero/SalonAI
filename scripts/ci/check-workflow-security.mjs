import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowDirectory = path.join(root, '.github', 'workflows');
const requiredWorkflows = ['ci.yml', 'codeql.yml', 'release.yml'];
const failures = [];
const passes = [];

function check(condition, message) {
  if (condition) passes.push(message);
  else failures.push(message);
}

for (const fileName of requiredWorkflows) {
  const filePath = path.join(workflowDirectory, fileName);
  check(fs.existsSync(filePath), `Workflow exists: ${fileName}`);
  if (!fs.existsSync(filePath)) continue;

  const content = fs.readFileSync(filePath, 'utf8');
  check(!/pull_request_target\s*:/.test(content), `${fileName} does not use pull_request_target`);
  check(!/uses:\s*[^\s]+@(main|master|latest)\b/.test(content), `${fileName} has no floating main/master/latest action reference`);
  check(!/persist-credentials:\s*true\b/.test(content), `${fileName} does not persist checkout credentials`);

  const uses = [...content.matchAll(/uses:\s*([^\s#]+)/g)].map((match) => match[1]);
  for (const reference of uses) {
    check(reference.includes('@'), `${fileName} action reference is versioned: ${reference}`);
  }
}

const release = fs.readFileSync(path.join(workflowDirectory, 'release.yml'), 'utf8');
check(/id-token:\s*write/.test(release), 'Release workflow can mint OIDC identity tokens');
check(/attestations:\s*write/.test(release), 'Release workflow can store attestations');
check(/packages:\s*write/.test(release), 'Release workflow can publish GHCR images');
check(/actions\/attest@v4/.test(release), 'Release workflow creates GitHub attestations');
check(/sbom-path:/.test(release), 'Release workflow creates SBOM attestations');
check(/docker\/build-push-action@v7\.2\.0/.test(release), 'Release workflow uses the approved Docker build action');
check(/aquasecurity\/trivy-action@v0\.36\.0/.test(release), 'Release workflow uses the approved Trivy action');
check(/gh release (create|upload)/.test(release), 'Release workflow publishes GitHub release evidence');

const ci = fs.readFileSync(path.join(workflowDirectory, 'ci.yml'), 'utf8');
check(/npm --prefix backend run validate|npm run validate/.test(ci), 'CI validates the backend');
check(/npm run build/.test(ci), 'CI builds the frontend');
check(/python -m pytest/.test(ci), 'CI runs AI-service tests when present');
check(/dependency-review-action@v4\.8\.3/.test(ci), 'CI runs dependency review');
check(/config\/security\/trivyignore\.yaml/.test(ci), 'CI uses the controlled Phase 7.12 Trivy exceptions');

console.log(`Workflow security checks passed: ${passes.length}`);
for (const message of failures) console.error(`[FAIL] ${message}`);
if (failures.length > 0) process.exit(1);
console.log('[PASS] Workflow security policy passed.');
