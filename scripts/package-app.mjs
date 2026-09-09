import { readFile, readdir, lstat, realpath, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { validateAppManifest } from '../lib/platform/appManifest.js';

// Packages source only. Does not execute contributed code or publish externally.
const [directory, flag] = process.argv.slice(2);
try {
  if (!directory || (flag && flag !== '--pack')) throw new Error('Usage: npm run app:validate -- <directory> [--pack]');
  const root = await realpath(directory);
  const files = [];
  async function walk(relative = '') {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build'].includes(entry.name)) continue;
      const name = path.join(relative, entry.name);
      const stat = await lstat(path.join(root, name));
      if (stat.isSymbolicLink()) throw new Error(`Symlinks are not supported: ${name}`);
      if (stat.isDirectory()) await walk(name);
      else if (stat.isFile()) files.push(name);
    }
  }
  await walk();
  for (const required of ['manifest.json', 'index.js', 'README.md']) {
    if (!files.includes(required)) throw new Error(`Missing ${required}`);
  }
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  const errors = validateAppManifest(manifest);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Valid package: ${manifest.id} ${manifest.version} (${files.length} source files)`);
  if (flag === '--pack') {
    const zip = new JSZip();
    for (const name of files.sort()) zip.file(`${manifest.id}/${name.split(path.sep).join('/')}`, await readFile(path.join(root, name)));
    const outputDir = path.resolve('build/app-packages');
    await mkdir(outputDir, { recursive: true });
    const output = path.join(outputDir, `${manifest.id}-${manifest.version}.zip`);
    await writeFile(output, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }), { flag: 'wx' });
    console.log(`Created ${output}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
