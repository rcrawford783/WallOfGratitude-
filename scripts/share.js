// Starts the server and a Cloudflare quick tunnel so remote guests can reach it.
const { spawn } = require('child_process');

const server = require('../server');
const port = Number(process.env.PORT) || 3000;

const tunnel = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

let announced = false;
function watch(chunk) {
  const match = !announced && chunk.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (!match) return;
  announced = true;
  console.log('==============================================================');
  console.log('  Share this link with everyone (office and remote):');
  console.log(`    ${match[0]}`);
  console.log(`  Admin page:  ${match[0]}/admin`);
  console.log('  Keep this window open for the whole party.');
  console.log('==============================================================\n');
}
tunnel.stdout.on('data', watch);
tunnel.stderr.on('data', watch);

tunnel.on('error', (err) => {
  if (err.code === 'ENOENT') {
    console.error('cloudflared is not installed (or not on PATH).');
    console.error('Install it with:  winget install Cloudflare.cloudflared');
    console.error('then open a NEW terminal and run  npm run share  again.\n');
  } else {
    console.error('Could not start cloudflared:', err.message);
  }
  server.close();
  process.exit(1);
});

tunnel.on('exit', (code) => {
  console.error(`cloudflared stopped (exit code ${code}). The public link no longer works.`);
  server.close();
  process.exit(code || 1);
});

process.on('SIGINT', () => {
  tunnel.kill();
  process.exit(0);
});
