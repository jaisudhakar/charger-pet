// `npm start`: runs the app from source with Electron.
// On Linux, Electron's sandbox needs either unprivileged user namespaces (blocked by
// AppArmor on Ubuntu 23.10+) or a root-owned setuid chrome-sandbox, which npm can't
// install. When neither is available, run without the sandbox; the app only loads its
// own local files. (Installed builds don't need this.)
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electron = require('electron'); // path to the Electron binary
const args = ['.', ...process.argv.slice(2)];

if (process.platform === 'linux' && !args.includes('--no-sandbox')) {
  let setuidOk = false;
  try {
    const st = statSync(join(dirname(electron), 'chrome-sandbox'));
    setuidOk = st.uid === 0 && (st.mode & 0o4000) !== 0;
  } catch {}
  if (!setuidOk) {
    console.log('Linux: starting without the Chromium sandbox (chrome-sandbox is not setuid root).');
    args.push('--no-sandbox');
  }
  if (process.env.XDG_CURRENT_DESKTOP?.includes('GNOME')) {
    console.log('Tip: on Ubuntu/GNOME use the desktop extension instead: bash scripts/install-ubuntu.sh');
  }
}

const child = spawn(electron, args, { stdio: 'inherit' });
child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0));
