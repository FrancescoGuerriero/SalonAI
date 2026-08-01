const tag = process.argv[2];
const pattern = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

if (!tag) {
  console.error('A release tag is required. Example: v7.3.0');
  process.exit(1);
}

const match = pattern.exec(tag.trim());
if (!match) {
  console.error(`Invalid release tag: ${tag}`);
  console.error('Required format: vMAJOR.MINOR.PATCH with no leading zeroes.');
  process.exit(1);
}

const [, major, minor, patch] = match;
console.log(JSON.stringify({
  tag,
  version: `${major}.${minor}.${patch}`,
  major: Number(major),
  minor: Number(minor),
  patch: Number(patch),
}));
