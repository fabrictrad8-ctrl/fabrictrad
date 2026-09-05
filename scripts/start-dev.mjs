import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const forwarded = process.argv.slice(2);
let hostname = 'localhost';
let port = process.env.PORT || '3000';

for (let index = 0; index < forwarded.length; index += 1) {
  const argument = forwarded[index];

  if (
    (argument === '--host' || argument === '--hostname' || argument === '-H') &&
    forwarded[index + 1]
  ) {
    hostname = forwarded[index + 1];
    index += 1;
    continue;
  }

  if ((argument === '--port' || argument === '-p') && forwarded[index + 1]) {
    port = forwarded[index + 1];
    index += 1;
  }
}

const nextCli = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const child = spawn(process.execPath, [nextCli, 'dev', '--hostname', hostname, '--port', port], {
  env: process.env,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => child.kill(signal));
}

child.once('error', (error) => {
  console.error('Unable to start the FabricTrad development server.', error);
  process.exitCode = 1;
});

child.once('exit', (code) => {
  process.exitCode = code ?? 1;
});
