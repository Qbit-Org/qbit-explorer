#!/usr/bin/env node
/**
 * Sync the vendored qbit.org design contract.
 *
 * The explorer header/footer render from vendored copies of the qbit.org
 * design contract in src/resources/qbit-design/. Those files are machine
 * managed: they are rewritten by this script and must never be hand-edited.
 *
 *   node scripts/sync-qbit-design.mjs          # rewrite vendored files
 *   node scripts/sync-qbit-design.mjs --check  # CI drift gate, exits 1 on drift
 *
 * The /design/ contract is not published on qbit.org yet (a parallel
 * workstream adds it), so while BOTH /design/ endpoints answer HTTP 404 they
 * are skipped with a warning instead of failing. Once any part of the
 * /design/ contract is published, a 404 on a contract asset is a regression
 * (deleted or renamed upstream) and fails loudly. The logo is published on
 * qbit.org today, so a 404 for it always fails. Every other failure
 * (network error, non-404 status, schema mismatch) is fatal too, so drift
 * can never be masked silently.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = process.env.QBIT_DESIGN_ORIGIN ?? 'https://qbit.org';
const VENDOR_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'resources', 'qbit-design');
const FETCH_TIMEOUT_MS = 15_000;

const isString = (value) => typeof value === 'string' && value.length > 0;
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

function validateTokens(bytes) {
  const tokens = JSON.parse(new TextDecoder().decode(bytes));
  if (tokens.version !== 1) {
    throw new Error(`unsupported tokens.json version: ${tokens.version}`);
  }
  for (const key of ['paper', 'surface', 'ink', 'muted', 'line', 'accent', 'accentHover', 'link']) {
    if (!isString(tokens.color?.[key])) {
      throw new Error(`tokens.json is missing color.${key}`);
    }
  }
  for (const key of ['sans', 'mono', 'display']) {
    if (!isString(tokens.font?.[key])) {
      throw new Error(`tokens.json is missing font.${key}`);
    }
  }
  for (const key of ['heightPx', 'bannerHeightPx', 'mobileBreakpointPx', 'maxWidthPx']) {
    if (!isFiniteNumber(tokens.header?.[key])) {
      throw new Error(`tokens.json is missing header.${key}`);
    }
  }
}

function validateNav(bytes) {
  const nav = JSON.parse(new TextDecoder().decode(bytes));
  if (nav.version !== 1) {
    throw new Error(`unsupported nav.json version: ${nav.version}`);
  }
  if (!isString(nav.banner?.text) || !isString(nav.banner?.href)) {
    throw new Error('nav.json is missing banner.text/banner.href');
  }
  if (!Array.isArray(nav.links) || nav.links.length === 0) {
    throw new Error('nav.json links must be a non-empty array');
  }
  const isLink = (link) => isString(link?.label) && isString(link?.href)
    && typeof link?.external === 'boolean' && (link.icon === undefined || isString(link.icon));
  for (const link of nav.links) {
    if (!isLink(link)) {
      throw new Error(`nav.json link entry is malformed: ${JSON.stringify(link)}`);
    }
  }
  // `items` is additive within version 1: the header's structure, plain
  // links plus labelled groups. Optional, but well-formed when present.
  if (nav.items !== undefined) {
    if (!Array.isArray(nav.items) || nav.items.length === 0) {
      throw new Error('nav.json items must be a non-empty array when present');
    }
    // Any item carrying `links` is a group, as the explorer's mapping (and
    // qbit.org) discriminate, so a non-array `links` is malformed.
    for (const item of nav.items) {
      const ok = item?.links !== undefined
        ? Array.isArray(item.links) && isString(item.label) && item.links.length > 0 && item.links.every(isLink)
        : isLink(item);
      if (!ok) {
        throw new Error(`nav.json item entry is malformed: ${JSON.stringify(item)}`);
      }
    }
  }
  // Validation is schema-only: the published contract is the source of truth
  // for content (which entries exist, including the explorer's own), so the
  // vendor gate must never refuse an editorial change.
  for (const key of ['github', 'x', 'discord']) {
    if (!isString(nav.social?.[key])) {
      throw new Error(`nav.json is missing social.${key}`);
    }
  }
}

function validateSvg(bytes) {
  const svg = new TextDecoder().decode(bytes).trimStart();
  if (!(svg.startsWith('<svg') || svg.startsWith('<?xml')) || !svg.includes('</svg>')) {
    throw new Error('logo-full.svg does not look like an SVG document');
  }
}

// designContract entries live under /design/ and may 404 together until the
// contract ships; alwaysPublished entries exist on qbit.org today, so a 404
// for them is never a pre-publication state.
const FILES = [
  { name: 'tokens.json', url: `${ORIGIN}/design/tokens.json`, validate: validateTokens, designContract: true },
  { name: 'nav.json', url: `${ORIGIN}/design/nav.json`, validate: validateNav, designContract: true },
  { name: 'logo-full.svg', url: `${ORIGIN}/logo-full.svg`, validate: validateSvg, alwaysPublished: true },
];

async function fetchPublished(file) {
  const response = await fetch(file.url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'user-agent': 'qbit-explorer sync-qbit-design' },
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`${file.url} answered HTTP ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  file.validate(bytes);
  return bytes;
}

async function readVendored(name) {
  try {
    return await readFile(join(VENDOR_DIR, name));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function main() {
  const checkMode = process.argv.includes('--check');
  const drifted = [];
  const skipped = [];

  const results = [];
  for (const file of FILES) {
    results.push({ file, published: await fetchPublished(file) });
  }

  // a 404 is only a pre-publication state while the whole /design/ contract
  // is absent; once any part of it is published, a missing asset is a
  // regression that must fail (before rewriting anything) rather than
  // silently retain a stale vendored copy
  const designPublished = results.some(({ file, published }) => file.designContract && published !== null);
  for (const { file, published } of results) {
    if (published === null && (file.alwaysPublished || designPublished)) {
      throw new Error(`${file.url} answered HTTP 404 but is expected to be published — `
        + 'restore the asset upstream or update this script if the contract moved');
    }
  }

  for (const { file, published } of results) {
    if (published === null) {
      skipped.push(file.name);
      console.warn(`[skip] ${file.url} answered HTTP 404 — design contract not published yet`);
      continue;
    }

    const vendored = await readVendored(file.name);
    const inSync = vendored !== null && Buffer.from(published).equals(vendored);
    if (inSync) {
      console.log(`[ok] ${file.name} matches ${file.url}`);
      continue;
    }

    if (checkMode) {
      drifted.push(file.name);
      console.error(`[drift] ${file.name} differs from ${file.url}`);
    } else {
      await writeFile(join(VENDOR_DIR, file.name), published);
      console.log(`[write] ${file.name} rewritten from ${file.url}`);
    }
  }

  if (skipped.length === FILES.length) {
    console.warn('[skip] nothing published yet — vendored design contract left untouched');
  }
  if (checkMode && drifted.length > 0) {
    console.error(`Vendored qbit design contract has drifted: ${drifted.join(', ')}.`);
    console.error('Run `node frontend/scripts/sync-qbit-design.mjs` and commit the result.');
    process.exit(1);
  }

  await verifyScssMirrors();
}

// media queries cannot read CSS custom properties, so the header and footer
// SCSS mirror the tokens.header constants; fail loudly whenever the vendored
// tokens and those mirrors disagree, e.g. right after a sync picked up new
// header values
async function verifyScssMirrors() {
  const appDir = join(VENDOR_DIR, '..', '..', 'app');
  const headerScss = join(appDir, 'components', 'master-page', 'master-page.component.scss');
  const footerScss = join(appDir, 'shared', 'components', 'global-footer', 'global-footer.component.scss');
  const tokens = JSON.parse(await readFile(join(VENDOR_DIR, 'tokens.json'), 'utf8'));
  const mirrors = [
    { scssPath: headerScss, variable: '$mobile-breakpoint', tokenKey: 'mobileBreakpointPx' },
    { scssPath: headerScss, variable: '$header-height', tokenKey: 'heightPx' },
    { scssPath: headerScss, variable: '$banner-height', tokenKey: 'bannerHeightPx' },
    { scssPath: headerScss, variable: '$header-max-width', tokenKey: 'maxWidthPx' },
    { scssPath: footerScss, variable: '$mobile-breakpoint', tokenKey: 'mobileBreakpointPx' },
  ];
  const stale = [];
  for (const { scssPath, variable, tokenKey } of mirrors) {
    const scss = await readFile(scssPath, 'utf8');
    const match = scss.match(new RegExp(`\\${variable}:\\s*(\\d+)px`));
    if (!match || Number(match[1]) !== tokens.header[tokenKey]) {
      stale.push(`${scssPath}: ${variable} (${match ? match[1] + 'px' : 'missing'}) != tokens.header.${tokenKey} (${tokens.header[tokenKey]}px)`);
    }
  }
  if (stale.length > 0) {
    console.error('Header/footer SCSS mirrors are out of sync with the vendored tokens.json:');
    for (const line of stale) {
      console.error(`  ${line}`);
    }
    console.error('Update those files to match and commit the result.');
    process.exit(1);
  }
  console.log('[ok] header/footer SCSS mirrors match vendored tokens.json');
}

main().catch((error) => {
  console.error(`sync-qbit-design failed: ${error.message}`);
  process.exit(1);
});
