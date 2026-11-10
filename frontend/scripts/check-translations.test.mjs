// Tests for check-translations.mjs: node --test scripts/check-translations.test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { findStaleUnits, readMessage, readUnits, removeUnits, translationFiles } from './check-translations.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-translations.mjs');

function unit(id, source, target) {
  const lines = [`      <trans-unit id="${id}" datatype="html">`, `        <source>${source}</source>`];
  if (target !== undefined) {
    lines.push(`        <target state="translated">${target}</target>`);
  }
  lines.push(
    '        <context-group purpose="location">',
    '          <context context-type="sourcefile">src/app/app.component.html</context>',
    '        </context-group>',
    '      </trans-unit>',
  );
  return lines.join('\n');
}

function xliff(...units) {
  return [
    '<?xml version="1.0" encoding="UTF-8" ?>',
    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">',
    '  <file source-language="en-US" datatype="plaintext" original="ng2.template">',
    '    <body>',
    ...units,
    '    </body>',
    '  </file>',
    '</xliff>',
    '',
  ].join('\n');
}

function englishOf(content) {
  return new Map(readUnits(content, 'messages.xlf').map(({ id, source }) => [id, source]));
}

function staleIds(englishUnits, localeUnits) {
  return findStaleUnits(englishOf(xliff(...englishUnits)), readUnits(xliff(...localeUnits), 'messages.de.xlf'))
    .map(({ unit: { id } }) => id);
}

test('reads text and placeholders, whatever the attributes say', () => {
  assert.deepEqual(
    readMessage(' Fee rate:\n   <x id="INTERPOLATION" equiv-text="{{ fee }}"/> bits/vB ', 'm'),
    { text: 'Fee rate: {$INTERPOLATION} bits/vB', placeholders: ['INTERPOLATION'] },
  );
  // Transifex writes equiv-text first; a placeholder is still known by its id
  assert.deepEqual(
    readMessage('<x equiv-text="a &gt; b" id="PH"/>', 'm'),
    readMessage('<x id="PH" equiv-text="something else"/>', 'm'),
  );
  // An id inside another attribute's value isn't the placeholder's
  assert.deepEqual(readMessage('<x equiv-text="&lt;span id=\'a\'&gt;" id="PH"/>', 'm').placeholders, ['PH']);
  assert.equal(readMessage('&lt;b&gt; &amp; &#38; &#x26; &quot;&apos;', 'm').text, '<b> & & & "\'');
  assert.equal(readMessage('<g id="1">bold</g> text', 'm').text, 'bold text');
  assert.throws(() => readMessage('a <!-- note --> b', 'm'), /m: can't read/);
  assert.throws(() => readMessage('<x equiv-text="no id"/>', 'm'), /m: a placeholder has no id/);
});

test('reads every trans-unit, with or without a target', () => {
  const units = readUnits(xliff(unit('a', 'One', 'Eins'), unit('b', 'Two')), 'f.xlf');
  assert.deepEqual(units.map(({ id, source, target }) => [id, source.text, target?.text]), [['a', 'One', 'Eins'], ['b', 'Two', undefined]]);
  assert.throws(() => readUnits(xliff('<trans-unit datatype="html"><source>x</source></trans-unit>'), 'f.xlf'), /has no id/);
  assert.throws(() => readUnits(xliff('<trans-unit id="a"><target>x</target></trans-unit>'), 'f.xlf'), /"a" has no <source>/);
  assert.throws(() => readUnits(xliff('<trans-unit id="a"><source>x</source>', unit('b', 'Two')), 'f.xlf'), /read 1 of its 2 trans-units/);
  assert.throws(() => readUnits(xliff('<trans-unit id="a"><source>x</trans-unit>'), 'f.xlf'), /<source> has no closing tag/);
});

test('flags a unit whose English changed under the same id', () => {
  assert.deepEqual(staleIds([unit('fee', 'Fee in QBT')], [unit('fee', 'Fee in BTC', 'Gebühr in BTC')]), ['fee']);
  // Whitespace isn't a change: templates reflow
  assert.deepEqual(staleIds([unit('fee', 'Fee in\n  QBT')], [unit('fee', ' Fee in QBT ', 'Gebühr in QBT')]), []);
  // The English decides even without a translation, as the build shows that English
  assert.deepEqual(staleIds([unit('fee', 'Fee in QBT')], [unit('fee', 'Fee in BTC')]), ['fee']);
});

test('lets a translation leave out, repeat or reorder the placeholders', () => {
  const source = 'Block <x id="INTERPOLATION"/> of <x id="INTERPOLATION_1"/>';
  const english = [unit('n', source)];
  assert.deepEqual(staleIds(english, [unit('n', source, 'Block <x id="INTERPOLATION_1"/> von <x id="INTERPOLATION"/>')]), []);
  assert.deepEqual(staleIds(english, [unit('n', source, 'Block <x id="INTERPOLATION"/>')]), []);
  assert.deepEqual(staleIds(english, [unit('n', source, '<x id="INTERPOLATION"/> <x id="INTERPOLATION"/> <x id="INTERPOLATION_1"/>')]), []);
  // As messages.hi.xlf does, writing out the Liquid network without its suffix
  const liquid = 'See the most recent Liquid<x id="PH" equiv-text="seoDescriptionNetwork(this.stateService.network)"/> blocks.';
  assert.deepEqual(staleIds([unit('meta.description.liquid.blocks', liquid)], [unit('meta.description.liquid.blocks', liquid, 'सबसे हाल के लिक्विड ब्लॉकों को देखें।')]), []);
});

test('flags a translation with a placeholder messages.xlf\'s English doesn\'t have', () => {
  const source = 'Block <x id="INTERPOLATION"/> of <x id="INTERPOLATION_1"/>';
  const english = englishOf(xliff(unit('n', source)));
  const reasons = (target) => findStaleUnits(english, readUnits(xliff(unit('n', source, target)), 'messages.de.xlf')).map(({ reason }) => reason);
  assert.deepEqual(reasons('<x id="INTERPOLATION"/> <x id="INTERPOLATION_1"/> <x id="PH"/>'), [
    'its translation uses PH, which messages.xlf\'s English doesn\'t have (it has INTERPOLATION, INTERPOLATION_1)',
  ]);
  // A renamed placeholder is an unknown one
  assert.equal(reasons('Block <x id="INTERPOLATION"/> von <x id="INTERPOLATION_2"/>').length, 1);
  // The English's own placeholders count as its text
  assert.deepEqual(staleIds([unit('n', source)], [unit('n', 'Block <x id="PH"/> of <x id="INTERPOLATION_1"/>', 'Block <x id="PH"/>')]), ['n']);
});

test('ignores units messages.xlf no longer has, and flags a repeated id', () => {
  assert.deepEqual(staleIds([unit('kept', 'Kept')], [unit('gone', 'Gone', 'Weg'), unit('kept', 'Kept', 'Behalten')]), []);
  assert.deepEqual(staleIds([unit('kept', 'Kept')], [unit('kept', 'Kept', 'Behalten'), unit('kept', 'Kept', 'Doppelt')]), ['kept']);
  // An unused id is ignored before anything else, even when it repeats
  assert.deepEqual(staleIds([unit('kept', 'Kept')], [unit('gone', 'Gone', 'Weg'), unit('gone', 'Gone', 'Fort')]), []);
});

test('removes units with their lines and nothing else', () => {
  const content = xliff(unit('a', 'One', 'Eins'), unit('b', 'Two', 'Zwei'), unit('c', 'Three', 'Drei'));
  const units = readUnits(content, 'f.xlf');
  assert.equal(removeUnits(content, [units[0], units[2]]), xliff(unit('b', 'Two', 'Zwei')));
  const crlf = content.replace(/\n/g, '\r\n');
  assert.equal(removeUnits(crlf, [readUnits(crlf, 'f.xlf')[1]]), xliff(unit('a', 'One', 'Eins'), unit('c', 'Three', 'Drei')).replace(/\n/g, '\r\n'));
  // A unit that shares its line keeps the rest of the line
  const inline = '<body><trans-unit id="a"><source>One</source></trans-unit><trans-unit id="b"><source>Two</source></trans-unit></body>';
  assert.equal(removeUnits(inline, [readUnits(inline, 'f.xlf')[0]]), '<body><trans-unit id="b"><source>Two</source></trans-unit></body>');
});

test('checks the translation files angular.json builds', () => {
  assert.deepEqual(translationFiles({
    projects: {
      app: { i18n: { sourceLocale: 'en-US', locales: { de: { translation: 'src/locale/messages.de.xlf', baseHref: '/de/' }, fr: 'src/locale/messages.fr.xlf' } } },
      other: { i18n: { locales: { es: { translation: ['src/locale/messages.es.xlf', 'src/locale/messages.de.xlf'] } } } },
      noI18n: {},
    },
  }), ['src/locale/messages.de.xlf', 'src/locale/messages.es.xlf', 'src/locale/messages.fr.xlf']);
});

test('the command fails on a stale unit, and --fix removes it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'check-translations-'));
  try {
    mkdirSync(join(dir, 'scripts'));
    mkdirSync(join(dir, 'src/locale'), { recursive: true });
    copyFileSync(SCRIPT, join(dir, 'scripts/check-translations.mjs'));
    writeFileSync(join(dir, 'angular.json'), JSON.stringify({ projects: { app: { i18n: { locales: { de: { translation: 'src/locale/messages.de.xlf' } } } } } }));
    writeFileSync(join(dir, 'src/locale/messages.xlf'), xliff(unit('fee', 'Fee in QBT'), unit('ok', 'Fine')));
    writeFileSync(join(dir, 'src/locale/messages.de.xlf'), xliff(unit('fee', 'Fee in BTC', 'Gebühr in BTC'), unit('ok', 'Fine', 'Gut')));
    const run = (...args) => spawnSync(process.execPath, [join(dir, 'scripts/check-translations.mjs'), ...args], { cwd: dir, encoding: 'utf8' });

    const check = run();
    assert.equal(check.status, 1, check.stderr);
    assert.match(check.stdout, /src\/locale\/messages\.de\.xlf: "fee": its English is "Fee in BTC"; messages\.xlf has "Fee in QBT"/);
    assert.match(check.stdout, /1 stale unit in 1 translation file against/);

    const fix = run('--fix');
    assert.equal(fix.status, 0, fix.stderr);
    assert.equal(readFileSync(join(dir, 'src/locale/messages.de.xlf'), 'utf8'), xliff(unit('ok', 'Fine', 'Gut')));
    const recheck = run();
    assert.equal(recheck.status, 0, recheck.stderr);
    assert.match(recheck.stdout, /no stale units/);

    assert.equal(run('--check').status, 2);
    writeFileSync(join(dir, 'src/locale/messages.de.xlf'), xliff('<trans-unit id="broken"><source>x</trans-unit>'));
    const broken = run();
    assert.equal(broken.status, 2);
    assert.match(broken.stderr, /<source> has no closing tag/);

    // Nothing to check is an error, not a pass
    writeFileSync(join(dir, 'angular.json'), JSON.stringify({ projects: { app: {} } }));
    const nothing = run();
    assert.equal(nothing.status, 2);
    assert.match(nothing.stderr, /0 translation files in angular\.json/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
