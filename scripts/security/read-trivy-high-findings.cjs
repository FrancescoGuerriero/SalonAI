
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const reportPath = process.argv[2];
if (!reportPath) {
  console.error('Usage: node read-trivy-high-findings.cjs <trivy-report.json>');
  process.exit(2);
}

let document;
try {
  document = JSON.parse(fs.readFileSync(path.resolve(reportPath), 'utf8'));
} catch (error) {
  console.error(`Unable to read Trivy report: ${error.message}`);
  process.exit(1);
}

const findings = [];
for (const result of Array.isArray(document.Results) ? document.Results : []) {
  for (const vulnerability of Array.isArray(result.Vulnerabilities) ? result.Vulnerabilities : []) {
    const severity = String(vulnerability.Severity || '').toUpperCase();
    if (severity !== 'HIGH' && severity !== 'CRITICAL') continue;
    findings.push({
      id: String(vulnerability.VulnerabilityID || ''),
      severity,
      packageName: String(vulnerability.PkgName || vulnerability.PackageName || ''),
      installedVersion: String(vulnerability.InstalledVersion || ''),
      fixedVersion: String(vulnerability.FixedVersion || ''),
      purl: String(vulnerability.PkgIdentifier?.PURL || vulnerability.PkgIdentifier?.purl || vulnerability.PURL || ''),
      target: String(result.Target || ''),
      class: String(result.Class || ''),
      type: String(result.Type || '')
    });
  }
}

findings.sort((a, b) => [a.packageName,a.installedVersion,a.id].join('|').localeCompare([b.packageName,b.installedVersion,b.id].join('|')));
process.stdout.write(JSON.stringify(findings));
