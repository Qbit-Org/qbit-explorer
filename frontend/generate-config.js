var fs = require('fs');
const { spawnSync } = require('child_process');

const CONFIG_FILE_NAME = 'mempool-frontend-config.json';
const GENERATED_CONFIG_FILE_NAME = 'src/resources/config.js';
const GENERATED_TEMPLATE_CONFIG_FILE_NAME = 'src/resources/config.template.js';
const GENERATED_CUSTOMIZATION_FILE_NAME = 'src/resources/customize.js';

let settings = [];
let configContent = {};
let gitCommitHash = '';
let packetJsonVersion = '';
let customConfig;
let customConfigContent;

try {
  const rawConfig = fs.readFileSync(CONFIG_FILE_NAME);
  configContent = JSON.parse(rawConfig);
  console.log(`${CONFIG_FILE_NAME} file found, using provided config`);
} catch (e) {
  if (e.code !== 'ENOENT') {
    throw new Error(e);
  } else {
    console.log(`${CONFIG_FILE_NAME} file not found, using default config`);
  }
}

if (configContent && configContent.CUSTOMIZATION) {
  try {
    customConfig = readConfig(configContent.CUSTOMIZATION);
    customConfigContent = JSON.parse(customConfig);
  } catch {
    console.log(`failed to load customization config from ${configContent.CUSTOMIZATION}`);
  }
}

const baseModuleName = configContent.BASE_MODULE || 'mempool';
const customBuildName = (customConfigContent && customConfigContent.enterprise) ? ('.' + customConfigContent.enterprise) : '';
const indexFilePath = 'src/index.' + baseModuleName + customBuildName + '.html';

try {
  fs.copyFileSync(indexFilePath, 'src/index.html');
  console.log('Copied ' + indexFilePath + ' to src/index.html');
} catch (e) {
  console.log('Error copying the index file');
  throw new Error(e);
}

// Inject theme manifest if it exists (created by generate-themes.js)
const THEME_MANIFEST_FILE = 'theme-manifest.json';
try {
  const themeManifest = fs.readFileSync(THEME_MANIFEST_FILE, 'utf-8');
  const themeFiles = JSON.parse(themeManifest);
  let indexHtml = fs.readFileSync('src/index.html', 'utf-8');
  const script = `  <script>window.__env=window.__env||{};window.__env.THEME_FILES=${JSON.stringify(themeFiles)};</script>`;
  indexHtml = indexHtml.replace('</head>', `${script}\n</head>`);
  fs.writeFileSync('src/index.html', indexHtml);
  console.log('Injected theme manifest into src/index.html:', themeFiles);
} catch (e) {
  if (e.code !== 'ENOENT') {
    console.log('Warning: Could not inject theme manifest:', e.message);
  }
}

// Re-inject the pre-boot skeleton's contract-bound values from the vendored
// design contract so the index can never drift from nav.json/tokens.json (the
// committed span text and the var() fallbacks in the skeleton CSS only cover
// this step failing)
try {
  let indexHtml = fs.readFileSync('src/index.html', 'utf-8');
  let indexDirty = false;

  const qbitNav = JSON.parse(fs.readFileSync('src/resources/qbit-design/nav.json', 'utf-8'));
  const bannerText = qbitNav && qbitNav.banner && qbitNav.banner.text;
  if (typeof bannerText === 'string' && bannerText.length > 0) {
    const escaped = bannerText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // replacement callback: contract text is arbitrary, so $-tokens in it
    // must land literally instead of being interpreted by String.replace
    const replaced = indexHtml.replace(
      /(<span class="qbit-preboot-banner-text">)[^<]*(<\/span>)/,
      (match, open, close) => open + escaped + close
    );
    if (replaced !== indexHtml) {
      indexHtml = replaced;
      indexDirty = true;
      console.log('Injected qbit-design banner text into the pre-boot skeleton');
    }
  }

  const tokens = JSON.parse(fs.readFileSync('src/resources/qbit-design/tokens.json', 'utf-8'));
  // the contract's own validation is schema-only, so accept any CSS color
  // syntax the real chrome would apply (hex, rgb(), color(), named …) and
  // refuse only characters that could escape the declaration or the style
  // element; same policy for font stacks
  const isCssValue = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[{};<>]/.test(v);
  const isColor = (v) => isCssValue(v, 64);
  const isPx = (v) => typeof v === 'number' && isFinite(v) && v > 0;
  const isFont = (v) => isCssValue(v, 256);
  const decls = [];
  if (isColor(tokens?.color?.paper)) { decls.push(`--pb-paper:${tokens.color.paper}`); }
  if (isColor(tokens?.color?.accent)) { decls.push(`--pb-accent:${tokens.color.accent}`); }
  if (isColor(tokens?.color?.line)) { decls.push(`--pb-line:${tokens.color.line}`); }
  if (isPx(tokens?.header?.bannerHeightPx)) { decls.push(`--pb-banner-h:${tokens.header.bannerHeightPx}px`); }
  if (isPx(tokens?.header?.heightPx)) { decls.push(`--pb-bar-h:${tokens.header.heightPx}px`); }
  if (isPx(tokens?.header?.maxWidthPx)) { decls.push(`--pb-maxw:${tokens.header.maxWidthPx}px`); }
  if (isFont(tokens?.font?.mono)) { decls.push(`--pb-mono:${tokens.font.mono}`); }
  if (decls.length > 0) {
    const style = `  <style id="qbit-preboot-tokens">:root{${decls.join(';')}}</style>`;
    indexHtml = indexHtml.replace('</head>', `${style}\n</head>`);
    indexDirty = true;
    console.log('Injected qbit-design tokens into the pre-boot skeleton:', decls.length, 'values');
  }

  // media queries cannot read custom properties, so the skeleton's annotated
  // breakpoint is rewritten in place from the contract
  if (isPx(tokens?.header?.mobileBreakpointPx)) {
    const rewritten = indexHtml.replace(
      /@media \(max-width: \d+px\) \/\* header\.mobileBreakpointPx \*\//g,
      `@media (max-width: ${tokens.header.mobileBreakpointPx}px) /* header.mobileBreakpointPx */`
    );
    if (rewritten !== indexHtml) {
      indexHtml = rewritten;
      indexDirty = true;
      console.log('Injected qbit-design mobile breakpoint into the pre-boot skeleton');
    }
  }

  if (indexDirty) {
    fs.writeFileSync('src/index.html', indexHtml);
  }
} catch (e) {
  console.log('Warning: Could not inject pre-boot contract values:', e.message);
}

try {
  const packageJson = fs.readFileSync('package.json');
  packetJsonVersion = JSON.parse(packageJson).version;
  console.log(`mempool version ${packetJsonVersion}`);
} catch (e) {
  throw new Error(e);
}

for (const setting in configContent) {
  settings.push({
    key: setting,
    value: configContent[setting]
  });
}

if (process.env.DOCKER_COMMIT_HASH) {
  gitCommitHash = process.env.DOCKER_COMMIT_HASH;
} else {
  try {
    const gitRevParse = spawnSync('git', ['rev-parse', '--short', 'HEAD']);
    if (!gitRevParse.error) {
      const output = gitRevParse.stdout.toString('utf-8').replace(/[\n\r\s]+$/, '');
      gitCommitHash = output ? output : '?';
      console.log(`mempool revision ${gitCommitHash}`);
    } else if (gitRevParse.error.code === 'ENOENT') {
      console.log('git not found, cannot parse git hash');
      gitCommitHash = '?';
    }
  } catch (e) {
    console.log('Could not load git commit info: ' + e.message);
    gitCommitHash = '?';
  }
}

const newConfig = `(function (window) {
  window.__env = window.__env || {};${settings.reduce((str, obj) => `${str}
    window.__env.${obj.key} = ${typeof obj.value === 'string' ? `'${obj.value}'` : obj.value};`, '')}
    window.__env.GIT_COMMIT_HASH = '${gitCommitHash}';
    window.__env.PACKAGE_JSON_VERSION = '${packetJsonVersion}';
  }((typeof global !== 'undefined') ? global : this));`;

const newConfigTemplate = `(function (window) {
  window.__env = window.__env || {};${settings.reduce((str, obj) => `${str}
    window.__env.${obj.key} = ${typeof obj.value === 'string' ? `'\${__${obj.key}__}'` : `\${__${obj.key}__}`};`, '')}
    window.__env.GIT_COMMIT_HASH = '${gitCommitHash}';
    window.__env.PACKAGE_JSON_VERSION = '${packetJsonVersion}';
  }(this));`;

function readConfig(path) {
  try {
    const currentConfig = fs.readFileSync(path).toString().trim();
    return currentConfig;
  } catch {
    return false;
  }
}

function writeConfig(path, config) {
  try {
    fs.writeFileSync(path, config, 'utf8');
  } catch (e) {
    throw new Error(e);
  }
}

function writeConfigTemplate(path, config) {
  try {
    fs.writeFileSync(path, config, 'utf8');
  } catch (e) {
    throw new Error(e);
  }
}

writeConfigTemplate(GENERATED_TEMPLATE_CONFIG_FILE_NAME, newConfigTemplate);

const currentConfig = readConfig(GENERATED_CONFIG_FILE_NAME);

let customConfigJs = '';
if (customConfig) {
  console.log(`Customizing frontend using ${configContent.CUSTOMIZATION}`);
  customConfigJs = `(function (window) {
    window.__env = window.__env || {};
    window.__env.customize = ${customConfig};
    }((typeof global !== 'undefined') ? global : this));
  `;
}
writeConfig(GENERATED_CUSTOMIZATION_FILE_NAME, customConfigJs);

if (currentConfig && currentConfig === newConfig) {
  console.log(`No configuration updates, skipping ${GENERATED_CONFIG_FILE_NAME} file update`);
} else if (!currentConfig) {
  console.log(`${GENERATED_CONFIG_FILE_NAME} file not found, creating new config file`);
  console.log('CONFIG: ', newConfig);
  writeConfig(GENERATED_CONFIG_FILE_NAME, newConfig);
  console.log(`${GENERATED_CONFIG_FILE_NAME} file saved`);
} else {
  console.log(`Configuration changes detected, updating ${GENERATED_CONFIG_FILE_NAME} file`);
  console.log('OLD CONFIG: ', currentConfig);
  console.log('NEW CONFIG: ', newConfig);
  writeConfig(GENERATED_CONFIG_FILE_NAME, newConfig);
  console.log(`${GENERATED_CONFIG_FILE_NAME} file updated`);
}
