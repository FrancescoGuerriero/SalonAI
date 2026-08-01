import fs from 'node:fs';
import path from 'node:path';

function getArgument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) {
    throw new Error(`Missing required argument ${name}`);
  }
  return process.argv[index + 1];
}

const evidence = {
  schemaVersion: 1,
  service: getArgument('--service'),
  image: getArgument('--image'),
  tag: getArgument('--tag'),
  digest: getArgument('--digest'),
  commit: getArgument('--commit'),
  workflowRunId: getArgument('--run-id'),
  generatedAt: new Date().toISOString(),
};

if (!/^sha256:[a-f0-9]{64}$/.test(evidence.digest)) {
  throw new Error(`Invalid SHA-256 image digest: ${evidence.digest}`);
}

const output = getArgument('--output');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
console.log(`Wrote immutable image evidence: ${output}`);
