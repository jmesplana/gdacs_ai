import JSZip from 'jszip';
import { openDB } from 'idb';
import { validateAppManifest } from './appManifest.js';

const MAX_BYTES = 5 * 1024 * 1024;
let database;
function db() {
  if (!database) database = openDB('aidstack_app_packages', 1, {
    upgrade(value) {
      value.createObjectStore('packages', { keyPath: ['workspaceId', 'manifest.id'] }).createIndex('workspace', 'workspaceId');
    }
  });
  return database;
}

async function boundedText(entry, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const stream = entry.internalStream('uint8array');
    stream.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { stream.pause(); reject(new Error('Unpacked app exceeds the size limit.')); }
      else chunks.push(chunk);
    });
    stream.on('error', reject);
    stream.on('end', () => {
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      resolve(new TextDecoder().decode(bytes));
    });
    stream.resume();
  });
}

export async function readAppPackage(bytes, reservedIds = []) {
  if (bytes.byteLength > MAX_BYTES) throw new Error('App ZIP must be at most 5 MB.');
  const zip = await JSZip.loadAsync(bytes);
  const files = Object.values(zip.files).filter((file) => !file.dir);
  if (files.length !== 2 || files.some((file) => !['manifest.json', 'index.html'].includes(file.name) || (file.unsafeOriginalName && file.unsafeOriginalName !== file.name))) {
    throw new Error('Use a built app ZIP containing only manifest.json and a self-contained index.html at its root.');
  }
  const manifest = JSON.parse(await boundedText(zip.file('manifest.json'), 16384));
  const errors = validateAppManifest(manifest);
  if (manifest?.runtime !== 'iframe-v1') errors.push('runtime must be iframe-v1.');
  if (reservedIds.includes(manifest?.id)) errors.push('This ID belongs to a built-in app.');
  if (errors.length) throw new Error(errors.join(' '));
  const html = await boundedText(zip.file('index.html'), MAX_BYTES);
  if (!html.trim()) throw new Error('index.html is empty.');
  return { manifest, html };
}

export async function listAppPackages(workspaceId) {
  return (await db()).getAllFromIndex('packages', 'workspace', workspaceId);
}

export async function installAppPackage(workspaceId, pkg) {
  const record = { workspaceId, manifest: pkg.manifest, html: pkg.html, enabled: true };
  await (await db()).put('packages', record);
  return record;
}

export async function setPackageEnabled(workspaceId, id, enabled) {
  const database = await db();
  const tx = database.transaction('packages', 'readwrite');
  const record = await tx.store.get([workspaceId, id]);
  if (!record) throw new Error('App package no longer exists.');
  await tx.store.put({ ...record, enabled });
  await tx.done;
}
