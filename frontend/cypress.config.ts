import { defineConfig } from 'cypress';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

// Set by sourcing the smoke.env that backend/scripts/qbit-regtest-harness.sh writes
function harnessEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set: start the regtest harness and source its smoke.env`);
  }
  return value;
}

export default defineConfig({
  videosFolder: 'cypress/videos',
  screenshotsFolder: 'cypress/screenshots',
  video: false,
  retries: {
    runMode: 1,
    openMode: 0,
  },
  chromeWebSecurity: false,
  defaultCommandTimeout: 15000,
  e2e: {
    setupNodeEvents(on: any, config: any) {
      on('task', {
        regtestSeed: () => JSON.parse(readFileSync(harnessEnv('QBIT_REGTEST_SEED'), 'utf8')),
        qbitCli: (args: string[]) => execFileSync(harnessEnv('QBIT_CLI'), [...harnessEnv('QBIT_CLI_ARGS').split(' '), ...args], { encoding: 'utf8' }).trim(),
        auxpowPayload: (template: string) => execFileSync('python3', ['-I', '../backend/scripts/qbit-regtest-auxpow.py'], { input: template, encoding: 'utf8' }).trim(),
      });
      return config;
    },
    baseUrl: 'http://localhost:4200',
    specPattern: 'cypress/e2e/**/*.{js,jsx,ts,tsx}',
  },
});
