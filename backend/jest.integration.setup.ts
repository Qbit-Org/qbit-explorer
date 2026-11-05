// Setup that runs BEFORE setupFiles
// This ensures MEMPOOL_CONFIG_FILE is set before any modules are loaded
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

// Set the config file path if not already set
if (!process.env.MEMPOOL_CONFIG_FILE) {
  process.env.MEMPOOL_CONFIG_FILE = path.join(__dirname, 'mempool-config.test.json');
}

// Helper to get docker compose command (v1 or v2)
function getDockerComposeCmd(): string {
  try {
    execSync('docker compose version', { stdio: 'pipe' });
    return 'docker compose';
  } catch {
    try {
      execSync('docker-compose version', { stdio: 'pipe' });
      return 'docker-compose';
    } catch {
      throw new Error('Neither "docker compose" nor "docker-compose" is available');
    }
  }
}

// docker-compose.test.yml publishes the database on host port
// MEMPOOL_TEST_DB_HOST_PORT, or 33306 like mempool-config.test.json when it is
// unset. CI sets it to 0 so Docker picks a free port. When the config file names
// another port, point MEMPOOL_CONFIG_FILE at a copy that uses the published one:
// Jest runs the tests and globalTeardown after this, with this process's
// environment.
function usePublishedDatabasePort(dockerComposeCmd: string, composeFile: string): void {
  const published = execSync(`${dockerComposeCmd} -f "${composeFile}" port db-test 3306`, {
    cwd: __dirname,
    encoding: 'utf8'
  }).trim();
  const port = Number(published.slice(published.lastIndexOf(':') + 1));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`"docker compose port db-test 3306" printed "${published}", not a host port`);
  }

  const configFile = process.env.MEMPOOL_CONFIG_FILE as string;
  const testConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  if (testConfig.DATABASE?.PORT === port) {
    return;
  }
  testConfig.DATABASE = { ...testConfig.DATABASE, PORT: port };
  const portConfigFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mempool-integration-')), path.basename(configFile));
  fs.writeFileSync(portConfigFile, JSON.stringify(testConfig, null, 2));
  process.env.MEMPOOL_CONFIG_FILE = portConfigFile;
  console.log(`Test database is on host port ${port}; MEMPOOL_CONFIG_FILE=${portConfigFile}`);
}

// Start the Docker test database container
module.exports = async () => {
  // Skip if SKIP_DB_SETUP is set (e.g., when test-with-db.sh manages the database)
  if (process.env.SKIP_DB_SETUP) {
    console.log('Skipping database setup (managed externally)');
    return;
  }

  console.log('Starting test database container...');
  try {
    const composeFile = path.join(__dirname, 'docker-compose.test.yml');
    const dockerComposeCmd = getDockerComposeCmd();

    // Start the container
    execSync(`${dockerComposeCmd} -f "${composeFile}" up -d`, {
      stdio: 'inherit',
      cwd: __dirname
    });

    // Wait for database to be ready
    console.log('Waiting for database to be ready...');
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      try {
        execSync(`${dockerComposeCmd} -f "${composeFile}" exec -T db-test mysqladmin ping -h localhost -u mempool_test -pmempool_test --silent`, {
          cwd: __dirname,
          stdio: 'pipe'
        });
        console.log('Database is ready!');
        break;
      } catch (e) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error('Database did not start in time');
        }
        // Wait 1 second before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (process.env.MEMPOOL_TEST_DB_HOST_PORT) {
      usePublishedDatabasePort(dockerComposeCmd, composeFile);
    }
  } catch (error) {
    console.error('Failed to start test database:', error instanceof Error ? error.message : error);
    throw error;
  }
};

