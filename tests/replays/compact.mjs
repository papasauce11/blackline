// BLACKLINE - tests/replays/compact.mjs
//
// The probe prints a replay as indented JSON; the shipped file is compact,
// one event a line, so a re-recording diffs as the events that changed (H13).
//
//   npm run probe -- --map plant tests/replays/record.js > out.json
//   node tests/replays/compact.mjs out.json tests/replays/plant.json
//
// Not reached from package.json, so it is no runner's and reads no flags.

import fs from 'node:fs';
const [, , input, output] = process.argv;
const replay = JSON.parse(fs.readFileSync(input, 'utf8'));
const { events, ...head } = replay;
const lines = Object.entries(head).filter(([k]) => k !== 'end').map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
const body = [
  '{',
  ...lines,
  '  "events": [',
  events.map((e) => `    ${JSON.stringify(e)}`).join(',\n'),
  '  ],',
  `  "end": ${JSON.stringify(replay.end)}`,
  '}',
  '',
].join('\n');
JSON.parse(body);
fs.writeFileSync(output, body);
console.log(`${output}: ${replay.steps} steps, ${events.length} events, ${body.length} bytes`);
