import {readFile} from 'node:fs/promises';
import {audit} from './audit.js';

try {
  if (process.argv.length !== 3) throw new Error('Usage: node src/cli.js <events.json>');
  const bytes = await readFile(process.argv[2]);
  if (bytes.length > 2_000_000) throw new Error('Input exceeds 2 MB');
  const result = audit(JSON.parse(bytes.toString('utf8')));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === 'pass' ? 0 : 2;
} catch (error) {
  console.error(JSON.stringify({error: error.message}));
  process.exitCode = 1;
}
