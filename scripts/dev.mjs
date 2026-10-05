import { spawn } from 'node:child_process';
const env = { ...process.env, QUEUE_PORT: process.env.QUEUE_PORT || '8797' };
const children = [spawn(process.execPath, ['server/dev.mjs'], { stdio: 'inherit', env }), spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit', env })];
let closing = false;
function close(code = 0) { if (closing) return; closing = true; for (const child of children) child.kill('SIGTERM'); process.exitCode = code; }
for (const child of children) child.on('exit', code => close(code ?? 0));
process.on('SIGINT', () => close()); process.on('SIGTERM', () => close());
