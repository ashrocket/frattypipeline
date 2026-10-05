// Compatibility entry point; uses the real simulation and current input policies.
import {main} from './gauntlet.mjs';
if(!process.argv.some(arg=>arg.startsWith('--seeds=')))process.argv.push('--seeds=30');
await main();
