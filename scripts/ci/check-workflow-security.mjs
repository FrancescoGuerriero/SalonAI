import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowDirectory = path.join(root, '.github', 'workflows');
const requiredWorkflows = ['ci.yml', 'codeql.yml', 'release.yml', 'deploy-production.yml'];
const failures = [];
const passes = [];

function check(condition, message) {
  if (condition) passes.push(message);
  else failures.push(message);
}

function hasStaleExitCodeCheckAfterPowerShellScript(content) {
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    if (!/&\s*\(Join-Path\b.*\.ps1"\)/.test(lines[index])) continue;

    let end = index;
    while (end < lines.length && lines[end].trimEnd().endsWith('`')) end += 1;

    let next = end + 1;
    while (next < lines.length && lines[next].trim() === '') next += 1;

    if (/^\s*if\s*\(\$LASTEXITCODE\b/.test(lines[next] ?? '')) return true;
  }

  return false;
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
check(/test-deployment-evidence\.mjs/.test(ci), 'CI tests deployment evidence validation');
check(/Validate PowerShell syntax/.test(ci), 'CI validates deployment PowerShell syntax');

const deployment = fs.readFileSync(path.join(workflowDirectory, 'deploy-production.yml'), 'utf8');
check(!/runs-on:\s*(?:\r?\n\s*-\s*)?self-hosted/.test(deployment), 'Production deployment does not require a persistent self-hosted runner');
check(/name:\s*Deploy production[\s\S]*?runs-on:\s*ubuntu-24\.04/.test(deployment), 'Production deployment uses a GitHub-hosted runner');
for (const secretName of [
  'PRODUCTION_HOST',
  'PRODUCTION_USER',
  'PRODUCTION_SSH_KEY',
  'PRODUCTION_KNOWN_HOSTS',
]) {
  check(deployment.includes(`secrets.${secretName}`), `Production deployment requires ${secretName}`);
}
check(/StrictHostKeyChecking=yes/.test(deployment), 'Production SSH requires strict host-key checking');
check(/UserKnownHostsFile=/.test(deployment), 'Production SSH uses the protected known-hosts file');
check(/BatchMode=yes/.test(deployment), 'Production SSH is non-interactive');
check(/IdentitiesOnly=yes/.test(deployment), 'Production SSH uses only the deployment identity');
check(!/StrictHostKeyChecking=no/.test(deployment), 'Production SSH never disables host-key checking');
check(!/UserKnownHostsFile=\/dev\/null/.test(deployment), 'Production SSH never discards known-host verification');
check(!/sshpass\b/.test(deployment), 'Production deployment does not use password-based SSH automation');
check(/sha256sum --check SHA256SUMS\.txt/.test(deployment), 'Production deployment verifies release evidence checksums');
check(/validate-deployment-evidence\.mjs/.test(deployment), 'Production deployment validates release and rollback evidence');
check(/ref:\s*\$\{\{ github\.sha \}\}/.test(deployment), 'Deployment controls are checked out from the dispatch commit');
check(/Invoke-RemoteProductionDeployment\.ps1/.test(deployment), 'Production deployment uses the guarded remote wrapper');
check(
  /rm -rf "\$payload_directory\/scripts\/deployment"[\s\S]*?cp -a[\s\S]*?"\$CONTROL_SOURCE_DIR\/scripts\/deployment"[\s\S]*?"\$payload_directory\/scripts\/deployment"/.test(deployment),
  'Production payload replaces tagged deployment scripts with the complete trusted control set',
);
check(/docker logout ghcr\.io/.test(deployment), 'Transient GHCR credentials are removed from production');
check(/operation-evidence\.tgz/.test(deployment), 'Remote deployment evidence is returned to GitHub Actions');

const remoteWrapper = fs.readFileSync(
  path.join(root, 'scripts/deployment/Invoke-RemoteProductionDeployment.ps1'),
  'utf8',
);
check(
  /TrustedDeploymentControlRoot[\s\S]*?Join-Path \$StagingRoot "scripts\/deployment"/.test(remoteWrapper),
  'Remote deployment resolves controls from the protected staging directory',
);
check(
  (remoteWrapper.match(/Join-Path \$TrustedDeploymentControlRoot "Deploy-Production\.ps1"/g) ?? []).length === 2,
  'Deployment and automatic restoration both execute trusted staged controls',
);
check(
  !/Join-Path \$DeployRoot "scripts\/deployment\/Deploy-Production\.ps1"/.test(remoteWrapper),
  'Remote deployment never executes release-tagged or rollback-snapshot deployment controls',
);
check(
  (remoteWrapper.match(/Install-TrustedDeploymentControls/g) ?? []).length >= 3,
  'Trusted deployment controls are installed for deployment and restoration',
);

const productionDeployScript = fs.readFileSync(
  path.join(root, 'scripts/deployment/Deploy-Production.ps1'),
  'utf8',
);
check(
  /function Invoke-ComposeDeployment[\s\S]*?MaximumAttempts = 2[\s\S]*?docker compose @ComposeArguments up -d --no-build/.test(productionDeployScript),
  'Production deployment retries one transient Docker Compose rollout failure',
);
check(
  /function Wait-CoreServicesHealthy[\s\S]*?TimeoutSeconds = 75[\s\S]*?salonai-backend/.test(productionDeployScript),
  'Production deployment uses a bounded health grace period that includes the backend',
);
check(
  /function Get-ContainerHealthSnapshot[\s\S]*?ready = \(\$State -eq "running" -and \$Health -eq "healthy"\)/.test(productionDeployScript),
  'Production health convergence still requires containers to be running and Docker-healthy',
);
check(
  /function Invoke-ComposeDeployment[\s\S]*?docker compose @ComposeArguments up -d --no-build[\s\S]*?Wait-CoreServicesHealthy -TimeoutSeconds \$HealthGraceSeconds/.test(productionDeployScript),
  'Production deployment waits for core health before its bounded Compose convergence retry',
);
check(
  /function Restart-EdgeProxy[\s\S]*?docker compose @ComposeArguments restart edge/.test(productionDeployScript),
  'Production deployment restarts edge so Nginx refreshes recreated upstream addresses',
);
check(
  /Invoke-ComposeDeployment -ComposeArguments \$ComposeArguments[\s\S]*?Restart-EdgeProxy -ComposeArguments \$ComposeArguments[\s\S]*?Test-ProductionSmoke\.ps1/.test(productionDeployScript),
  'Production deployment refreshes edge before external smoke tests',
);

for (const scriptPath of [
  'scripts/deployment/Deploy-Production.ps1',
  'scripts/deployment/Invoke-RemoteProductionDeployment.ps1',
  'scripts/deployment/Rollback-Production.ps1',
]) {
  const script = fs.readFileSync(path.join(root, scriptPath), 'utf8');
  check(
    !hasStaleExitCodeCheckAfterPowerShellScript(script),
    `${scriptPath} relies on terminating PowerShell errors instead of stale LASTEXITCODE state`,
  );
}

console.log(`Workflow security checks passed: ${passes.length}`);
for (const message of failures) console.error(`[FAIL] ${message}`);
if (failures.length > 0) process.exit(1);
console.log('[PASS] Workflow security policy passed.');
