import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { readAppPackage } from '../lib/platform/appPackages.js';

const [directory = 'templates/installable-app', output = 'public/apps/activity-planner.zip'] = process.argv.slice(2);
const zip = new JSZip();
for (const file of ['manifest.json', 'index.html']) zip.file(file, await readFile(path.join(directory, file)));
const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
await readAppPackage(bytes, ['immunization']);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, bytes);
console.log(`Built installable app: ${output}`);
