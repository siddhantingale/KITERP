// Copies Excalidraw's fonts/assets into public/ so the whiteboard works offline
// (otherwise Excalidraw downloads them from the unpkg CDN). Runs after "npm install".
import fs from 'node:fs';
import path from 'node:path';

const pkg = path.resolve('node_modules/@excalidraw/excalidraw/dist');
let copied = 0;
for (const dir of ['excalidraw-assets', 'excalidraw-assets-dev']) { // production + dev-mode builds
  const src = path.join(pkg, dir);
  const dest = path.resolve('public', dir);
  if (!fs.existsSync(src)) continue;
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  copied++;
}
console.log(copied
  ? '✓ Excalidraw assets copied to public/'
  : 'Excalidraw assets not found; the whiteboard will load them from the internet.');
