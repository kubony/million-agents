#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Parse arguments
const args = process.argv.slice(2);
const portArg = args.find(arg => arg.startsWith('--port=') || arg.startsWith('-p='));
const defaultPort = portArg ? parseInt(portArg.split('=')[1], 10) : 3001;
const noBrowser = args.includes('--no-browser');

async function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

async function openBrowser(url) {
  const platform = process.platform;
  let command;
  let args = [];

  if (platform === 'darwin') {
    command = 'open';
    args = [url];
  } else if (platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
}

async function main() {
  console.log('\n🚀 makecc - Claude Code Workflow Builder\n');

  // 사용자가 실행한 프로젝트 경로 저장
  const userProjectPath = process.cwd();
  console.log(`📁 Project: ${userProjectPath}`);

  const port = await findAvailablePort(defaultPort);

  // Set environment variables
  process.env.PORT = port.toString();
  process.env.NODE_ENV = 'production';

  const url = `http://localhost:${port}`;

  // Start the server using tsx
  const serverPath = join(rootDir, 'server', 'index.ts');

  // tsx 실행 파일 찾기 - npx 환경에서도 작동하도록
  const serverProcess = spawn('npx', ['tsx', serverPath], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: port.toString(),
      NODE_ENV: 'production',
      MAKECC_PROJECT_PATH: userProjectPath,  // 사용자 프로젝트 경로 전달
    },
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  let serverStarted = false;

  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output);

    if (!serverStarted && output.includes('Server running')) {
      serverStarted = true;
      console.log(`\n✅ Server running at ${url}`);
      console.log('   Press Ctrl+C to stop\n');

      if (!noBrowser) {
        openBrowser(url);
      }
    }
  });

  serverProcess.stderr.on('data', (data) => {
    process.stderr.write(data.toString());
  });

  serverProcess.on('error', (error) => {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  });

  serverProcess.on('exit', (code) => {
    process.exit(code || 0);
  });

  // Handle process termination
  process.on('SIGINT', () => {
    serverProcess.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    serverProcess.kill('SIGTERM');
  });
}

main().catch(console.error);
