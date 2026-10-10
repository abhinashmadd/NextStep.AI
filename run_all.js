const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const VENV_PYTHON = 'C:\\Users\\absma\\.venvs\\NextStep\\Scripts\\python.exe';

function findModelDir() {
  const candidates = [
    path.join(__dirname, 'NextStep model'),
    path.join(__dirname, '..', 'NextStep model'),
    path.resolve('NextStep model'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.existsSync(path.join(c, 'main.py'))) {
      return c;
    }
  }
  return path.join(__dirname, 'NextStep model');
}

function findFrontendDir() {
  const candidates = [
    path.join(__dirname, 'NextStep Front+ backened'),
    __dirname,
    path.resolve('NextStep Front+ backened'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.existsSync(path.join(c, 'server.js'))) {
      return c;
    }
  }
  return __dirname;
}

function getPythonPath() {
  if (fs.existsSync(VENV_PYTHON)) {
    return VENV_PYTHON;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

function checkHttpReady(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve) => {
    function ping() {
      const req = http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
          resolve(true);
        } else {
          retry();
        }
      });
      req.on('error', () => retry());
      req.setTimeout(1500, () => {
        req.destroy();
        retry();
      });
    }

    function retry() {
      if (Date.now() - start > timeoutMs) {
        resolve(false);
      } else {
        setTimeout(ping, 500);
      }
    }

    ping();
  });
}

async function main() {
  console.log('\n=============================================================');
  console.log('   🚀 Launching NextStep Full-Stack Platform (AI + Web)     ');
  console.log('=============================================================\n');

  const modelDir = findModelDir();
  const frontendDir = findFrontendDir();
  const pythonPath = getPythonPath();

  console.log(`[1/3] Python AI Engine Directory : ${modelDir}`);
  console.log(`      Using Python Runtime       : ${pythonPath}`);
  console.log(`[2/3] Web & API Gateway Directory: ${frontendDir}`);

  // 1. Spawn Python AI Engine
  console.log('\n[AI ENGINE] Starting FastAPI / NVIDIA NIM service on port 8000...');
  const aiProcess = spawn(
    pythonPath,
    ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'],
    { cwd: modelDir, stdio: ['inherit', 'pipe', 'pipe'], shell: false }
  );

  aiProcess.stdout.on('data', (d) => {
    process.stdout.write(`[AI 8000] ${d}`);
  });
  aiProcess.stderr.on('data', (d) => {
    process.stderr.write(`[AI 8000] ${d}`);
  });

  aiProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[AI ENGINE] Process exited unexpectedly with code ${code}`);
    }
  });

  // 2. Wait for AI Engine
  process.stdout.write('[AI ENGINE] Waiting for http://127.0.0.1:8000/api/ai/health...');
  const aiReady = await checkHttpReady('http://127.0.0.1:8000/api/ai/health', 15000);
  if (aiReady) {
    console.log(' READY! ✓');
  } else {
    console.log(' (will continue starting web server, AI starting in background)');
  }

  // 3. Spawn Node.js Web Gateway
  console.log('[WEB SERVER] Starting Node.js frontend & proxy server on port 3000...');
  const nodeProcess = spawn(
    process.execPath,
    ['server.js'],
    { cwd: frontendDir, stdio: ['inherit', 'pipe', 'pipe'], shell: false }
  );

  nodeProcess.stdout.on('data', (d) => {
    process.stdout.write(`[WEB 3000] ${d}`);
  });
  nodeProcess.stderr.on('data', (d) => {
    process.stderr.write(`[WEB 3000] ${d}`);
  });

  nodeProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[WEB SERVER] Process exited with code ${code}`);
    }
  });

  // 4. Wait for Web Server
  const webReady = await checkHttpReady('http://127.0.0.1:3000/', 10000);
  if (webReady) {
    console.log('\n=============================================================');
    console.log('  🎉 NextStep Platform is LIVE & FULLY CONNECTED!           ');
    console.log('-------------------------------------------------------------');
    console.log('  🌐 Web Application   : http://127.0.0.1:3000              ');
    console.log('  🧠 Python AI Service  : http://127.0.0.1:8000              ');
    console.log('  📚 AI API Docs (OpenAPI): http://127.0.0.1:8000/docs        ');
    console.log('  🔍 Proxied AI Health  : http://127.0.0.1:3000/api/ai/health');
    console.log('=============================================================\n');
  }

  // Clean shutdown handler
  function shutdown() {
    console.log('\nShutting down NextStep services gracefully...');
    try { aiProcess.kill(); } catch {}
    try { nodeProcess.kill(); } catch {}
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start NextStep platform:', err);
  process.exit(1);
});
