#!/usr/bin/env node
/**
 * Sanity-check draw.js without spoiling it.
 *
 * You are in this draw yourself, so this script deliberately never prints
 * who got whom. It only proves the structural properties you care about:
 * everyone is covered, nobody drew themselves, it is one single gift chain,
 * and nobody's key can open anybody else's present.
 *
 *   node verify.mjs
 */

import { readFileSync } from 'node:fs';

// draw.js is a browser file that assigns to `window`; give it one.
const src = readFileSync(new URL('./draw.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
new Function('window', src)(sandbox.window);
const DRAW = sandbox.window.SANTA_DRAW;

if (!DRAW) {
  console.error('draw.js did not define a draw. Run `node generate.mjs` first.');
  process.exit(1);
}

const normalize = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

const fromB64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

async function personId(name) {
  const data = new TextEncoder().encode(`${DRAW.pepper}:${normalize(name)}`);
  const h = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(h).toString('hex').slice(0, 32);
}

async function open(asName, entry) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`${DRAW.pepper}:${normalize(asName)}`),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(entry.s), iterations: DRAW.iter, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(entry.n) },
    key,
    fromB64(entry.c),
  );
  return new TextDecoder().decode(plain);
}

const roster = DRAW.roster;
const checks = [];
const ok = (label, pass, detail = '') => checks.push({ label, pass, detail });

// --- everyone has exactly one present, and it opens with their own name ---
const chain = new Map();
let allOpened = true;
for (const name of roster) {
  const entry = DRAW.gifts[await personId(name)];
  if (!entry) { allOpened = false; break; }
  try {
    chain.set(name, await open(name, entry));
  } catch {
    allOpened = false;
    break;
  }
}
ok('Every person has a present that opens with their own name', allOpened);
ok('No extra or orphaned entries in the file',
   Object.keys(DRAW.gifts).length === roster.length,
   `${Object.keys(DRAW.gifts).length} entries / ${roster.length} people`);

if (allOpened) {
  const giftees = [...chain.values()];

  ok('Every giftee is someone in the group', giftees.every((g) => roster.includes(g)));
  ok('Nobody drew themselves', [...chain].every(([giver, giftee]) => giver !== giftee));
  ok('Everybody is receiving exactly one gift', new Set(giftees).size === roster.length);

  // Walk the chain: a single cycle visits all N before coming home.
  let hops = 0;
  let at = roster[0];
  do { at = chain.get(at); hops++; } while (at !== roster[0] && hops <= roster.length);
  ok('It is one single gift chain (no closed-off pairs)', hops === roster.length,
     `chain length ${hops} of ${roster.length}`);

  // --- key isolation: your name must not open anyone else's present ---
  let leaks = 0;
  for (const giver of roster) {
    for (const other of roster) {
      if (giver === other) continue;
      const entry = DRAW.gifts[await personId(other)];
      try { await open(giver, entry); leaks++; } catch { /* expected */ }
    }
  }
  ok('Nobody can open another person\'s present with their own name', leaks === 0,
     leaks ? `${leaks} leak(s)!` : '');
}

// ------------------------------------------------------------------ report
console.log(`\n  Draw of ${roster.length}, made ${new Date(DRAW.drawnAt).toLocaleString()}\n`);
for (const c of checks) {
  console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.label}${c.detail ? `  (${c.detail})` : ''}`);
}

const failed = checks.filter((c) => !c.pass).length;
console.log(
  failed
    ? `\n  ${failed} check(s) failed. Re-run \`node generate.mjs\`.\n`
    : '\n  All good. The result is still a secret, including from you.\n',
);
process.exit(failed ? 1 : 0);
