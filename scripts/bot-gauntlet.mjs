// Reviewer entry point: 100 seeds per policy with the same gates.
import { main } from './gauntlet.mjs';
if (!process.argv.some((arg) => arg.startsWith('--seeds='))) process.argv.push('--seeds=100');
await main();
