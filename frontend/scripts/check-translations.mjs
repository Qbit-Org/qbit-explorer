#!/usr/bin/env node
/**
 * Check the translation files against the English source.
 *
 * src/locale/messages.xlf holds the English text of every message. Each
 * translation file that angular.json builds keeps, next to a translation, the
 * English text it was translated from. A unit fails the check when that English
 * text differs from messages.xlf's for the same id, or when its translation
 * uses a placeholder that messages.xlf's English doesn't have, which Angular's
 * build rejects. A translation may leave a placeholder out or repeat it, as
 * Angular allows. Messages with a custom @@id keep their id when their English
 * changes, so without this check the translation of the old English keeps
 * showing. Units whose id messages.xlf doesn't have are ignored, as the build
 * ignores them.
 *
 * Remove a failing unit from its translation file: the build then shows the
 * English text until someone translates it again.
 *
 *   node scripts/check-translations.mjs        # list failing units, exit 1 if any
 *   node scripts/check-translations.mjs --fix  # remove failing units
 */

import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_FILE = 'src/locale/messages.xlf';

const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: '\'' };
const ATTRIBUTE = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const ATTRIBUTES = String.raw`(?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*\s*`;
const TRANS_UNIT = new RegExp(String.raw`<trans-unit(${ATTRIBUTES})>([\s\S]*?)</trans-unit>`, 'g');
// An element of an XLIFF 1.2 message: a placeholder, or an inline element whose text counts
const MESSAGE_TAG = new RegExp(String.raw`<(/?)([\w:.-]+)(${ATTRIBUTES})(/?)>`, 'g');

function decodeEntities(text) {
  return text.replace(/&(?:#x([0-9a-fA-F]+)|#([0-9]+)|(lt|gt|amp|quot|apos));/g, (_, hex, dec, name) => {
    if (name) {
      return ENTITIES[name];
    }
    return String.fromCodePoint(parseInt(hex ?? dec, hex ? 16 : 10));
  });
}

// Attributes are read in order, so text inside another attribute's value never counts
function attribute(attributes, name) {
  for (const [, key, doubleQuoted, singleQuoted] of attributes.matchAll(ATTRIBUTE)) {
    if (key === name) {
      return decodeEntities(doubleQuoted ?? singleQuoted);
    }
  }
  return undefined;
}

// The child element NAME of a unit, or undefined. Throws if it is there but can't be read.
function childElement(body, name, where) {
  const start = new RegExp(String.raw`<${name}(${ATTRIBUTES})(/?)>`).exec(body);
  if (!start) {
    if (new RegExp(String.raw`<${name}[\s/>]`).test(body)) {
      throw new Error(`${where}: can't read its <${name}> element`);
    }
    return undefined;
  }
  if (start[2]) {
    return '';
  }
  const end = body.indexOf(`</${name}>`, start.index + start[0].length);
  if (end < 0) {
    throw new Error(`${where}: <${name}> has no closing tag`);
  }
  return body.slice(start.index + start[0].length, end);
}

/**
 * Reduce an XLIFF 1.2 message to what a translation must keep: its text with
 * whitespace runs collapsed, and `{$NAME}` for each `<x id="NAME"/>`
 * placeholder. Attributes such as equiv-text and the order of attributes don't
 * count, and inline elements such as <g> count only by their text.
 */
export function readMessage(xml, where) {
  let text = '';
  const placeholders = [];
  let last = 0;
  const addText = (segment) => {
    // Comments, CDATA and the like: not in Angular's or Transifex's XLIFF
    if (segment.includes('<')) {
      throw new Error(`${where}: can't read ${JSON.stringify(segment)}`);
    }
    text += decodeEntities(segment);
  };
  for (const match of xml.matchAll(MESSAGE_TAG)) {
    const [tag, closing, name, attributes] = match;
    addText(xml.slice(last, match.index));
    last = match.index + tag.length;
    if (name !== 'x' || closing) {
      continue;
    }
    const id = attribute(attributes, 'id');
    if (id === undefined) {
      throw new Error(`${where}: a placeholder has no id`);
    }
    placeholders.push(id);
    text += `{$${id}}`;
  }
  addText(xml.slice(last));
  return { text: text.replace(/\s+/g, ' ').trim(), placeholders };
}

/**
 * Read the trans-units of an XLIFF 1.2 file, in file order. Each unit has its
 * id, its source and target messages (the target is undefined when the unit has
 * none), and where its text starts and ends in the file.
 */
export function readUnits(content, file) {
  const units = [];
  for (const match of content.matchAll(TRANS_UNIT)) {
    const id = attribute(match[1], 'id');
    const where = `${file}: trans-unit ${id === undefined ? `at offset ${match.index}` : JSON.stringify(id)}`;
    if (id === undefined) {
      throw new Error(`${where} has no id`);
    }
    const source = childElement(match[2], 'source', where);
    if (source === undefined) {
      throw new Error(`${where} has no <source>`);
    }
    const target = childElement(match[2], 'target', where);
    units.push({
      id,
      source: readMessage(source, `${where} <source>`),
      target: target === undefined ? undefined : readMessage(target, `${where} <target>`),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  const opened = content.match(/<trans-unit[\s>]/g)?.length ?? 0;
  if (opened !== units.length) {
    throw new Error(`${file}: read ${units.length} of its ${opened} trans-units`);
  }
  return units;
}

function count(n, noun) {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function listPlaceholders(placeholders) {
  return placeholders.length ? [...new Set(placeholders)].sort().join(', ') : 'none';
}

/**
 * The units of a translation file that don't match the English source. `english`
 * maps each id in messages.xlf to its source message. A unit whose id isn't in
 * messages.xlf is ignored, as the build ignores it.
 */
export function findStaleUnits(english, units) {
  const stale = [];
  const seen = new Set();
  for (const unit of units) {
    const source = english.get(unit.id);
    if (!source) {
      continue;
    }
    if (seen.has(unit.id)) {
      stale.push({ unit, reason: 'it appears twice in the file' });
      continue;
    }
    seen.add(unit.id);
    // Angular substitutes a translation's placeholders by name, so only a name
    // the English lacks breaks it. Fewer or repeated placeholders are fine.
    const unknown = unit.target?.placeholders.filter((name) => !source.placeholders.includes(name)) ?? [];
    if (unit.source.text !== source.text) {
      stale.push({ unit, reason: `its English is ${JSON.stringify(unit.source.text)}; messages.xlf has ${JSON.stringify(source.text)}` });
    } else if (unknown.length) {
      stale.push({ unit, reason: `its translation uses ${listPlaceholders(unknown)}, which messages.xlf's English doesn't have (it has ${listPlaceholders(source.placeholders)})` });
    }
  }
  return stale;
}

/** Remove units from a file's content, with the lines they take up. */
export function removeUnits(content, units) {
  let result = content;
  for (const unit of [...units].sort((a, b) => b.start - a.start)) {
    const lineStart = result.lastIndexOf('\n', unit.start - 1) + 1;
    const before = result.slice(lineStart, unit.start);
    const newline = result.indexOf('\n', unit.end);
    const after = result.slice(unit.end, newline < 0 ? result.length : newline);
    // Remove whole lines when the unit has its lines to itself
    if (/^[ \t]*$/.test(before) && /^[ \t\r]*$/.test(after)) {
      result = result.slice(0, lineStart) + result.slice(newline < 0 ? result.length : newline + 1);
    } else {
      result = result.slice(0, unit.start) + result.slice(unit.end);
    }
  }
  return result;
}

// The translation files angular.json builds, relative to the frontend directory
export function translationFiles(angularJson) {
  const files = new Set();
  for (const project of Object.values(angularJson.projects ?? {})) {
    for (const locale of Object.values(project.i18n?.locales ?? {})) {
      const translation = typeof locale === 'string' ? locale : locale.translation;
      for (const file of [translation].flat()) {
        if (file) {
          files.add(file);
        }
      }
    }
  }
  return [...files].sort();
}

function main(args) {
  const fix = args.includes('--fix');
  const unknown = args.filter((arg) => arg !== '--fix');
  if (unknown.length) {
    console.error(`unknown argument ${unknown[0]}\nusage: node scripts/check-translations.mjs [--fix]`);
    return 2;
  }
  const english = new Map();
  for (const unit of readUnits(readFileSync(join(FRONTEND_DIR, SOURCE_FILE), 'utf8'), SOURCE_FILE)) {
    english.set(unit.id, unit.source);
  }
  const files = translationFiles(JSON.parse(readFileSync(join(FRONTEND_DIR, 'angular.json'), 'utf8')));
  // An empty list would pass the check without checking anything
  if (!english.size || !files.length) {
    throw new Error(`found ${count(english.size, 'message')} in ${SOURCE_FILE} and ${count(files.length, 'translation file')} in angular.json`);
  }
  let total = 0;
  for (const file of files) {
    const path = join(FRONTEND_DIR, file);
    const content = readFileSync(path, 'utf8');
    const stale = findStaleUnits(english, readUnits(content, file));
    for (const { unit, reason } of stale) {
      console.log(`${file}: ${JSON.stringify(unit.id)}: ${reason}`);
    }
    total += stale.length;
    if (fix && stale.length) {
      writeFileSync(path, removeUnits(content, stale.map(({ unit }) => unit)));
    }
  }
  const checked = `${count(files.length, 'translation file')} against ${SOURCE_FILE} (${count(english.size, 'message')})`;
  if (!total) {
    console.log(`Checked ${checked}: no stale units.`);
    return 0;
  }
  if (fix) {
    console.log(`Removed ${count(total, 'stale unit')} from ${checked}. Their English text shows until they are translated again.`);
    return 0;
  }
  console.log(`\n${count(total, 'stale unit')} in ${checked}.`);
  console.log(`Remove them, and the build shows their English text: run \`node ${relative(process.cwd(), fileURLToPath(import.meta.url))} --fix\`.`);
  return 1;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`check-translations: ${error.message}`);
    process.exitCode = 2;
  }
}
