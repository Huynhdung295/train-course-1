'use strict';

const express = require('express');
const { WebSocketServer } = require('ws');
const { spawn, exec } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ═══════════════════════════════════════
// CONFIG – MFE App Registry
// ═══════════════════════════════════════
const ROOT = path.resolve(__dirname, '..');
const IS_WIN = process.platform === 'win32';
const PNPM = IS_WIN ? 'pnpm.cmd' : 'pnpm';

const MFE_APPS = [
  { id: 'shell',     name: 'Shell (Host)',       port: 3000, filter: '@nexus/shell',     color: '#3b82f6', icon: '🏠', cmd: 'dev', dir: 'apps/shell'    },
  { id: 'auth',      name: 'MFE-Auth',           port: 3001, filter: '@nexus/mfe-auth',  color: '#8b5cf6', icon: '🔐', cmd: 'dev', dir: 'apps/mfe-auth'  },
  { id: 'pos',       name: 'MFE-POS',            port: 3002, filter: '@nexus/mfe-pos',   color: '#10b981', icon: '🏪', cmd: 'dev', dir: 'apps/mfe-pos'   },
  { id: 'erp',       name: 'MFE-ERP',            port: 3003, filter: '@nexus/mfe-erp',   color: '#f59e0b', icon: '📊', cmd: 'dev', dir: 'apps/mfe-erp'   },
  { id: 'catalog',   name: 'MFE-Catalog',        port: 3004, filter: '@nexus/mfe-catalog',color:'#06b6d4', icon: '📦', cmd: 'dev', dir: 'apps/mfe-catalog'},
  { id: 'users',     name: 'MFE-Users',          port: 3005, filter: '@nexus/mfe-users', color: '#ec4899', icon: '👥', cmd: 'dev', dir: 'apps/mfe-users'  },
  { id: 'marketing', name: 'MFE-Marketing',      port: 3006, filter: '@nexus/mfe-marketing',color:'#f97316',icon:'🌐',cmd: 'dev', dir: 'apps/mfe-marketing'},
];

const SHARED_PKGS = [
  { id: 'types',      name: '@nexus/types',      filter: '@nexus/types' },
  { id: 'utils',      name: '@nexus/utils',      filter: '@nexus/utils' },
  { id: 'api-client', name: '@nexus/api-client', filter: '@nexus/api-client' },
  { id: 'auth-pkg',   name: '@nexus/auth',       filter: '@nexus/auth' },
  { id: 'ui',         name: '@nexus/ui',         filter: '@nexus/ui' },
];

// ═══════════════════════════════════════
// State Management
// ═══════════════════════════════════════
const processes = {}; // { appId: { proc, status, logs[] } }
const taskLogs  = {}; // { taskId: logs[] }

MFE_APPS.forEach(app => {
  processes[app.id] = { proc: null, status: 'stopped', logs: [], pid: null };
});

// ═══════════════════════════════════════
// Express + WS Server
// ═══════════════════════════════════════
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set();
wss.on('connection', (ws) => {
  clients.add(ws);
  // Send current state immediately
  ws.send(JSON.stringify({ type: 'init', state: getState() }));
  ws.on('close', () => clients.delete(ws));
});

function broadcast(msg) {
  const data = JSON.stringify(msg);
  clients.forEach(ws => { try { ws.send(data); } catch {} });
}

function pushLog(appId, line) {
  if (!processes[appId]) return;
  const entry = { t: Date.now(), line };
  processes[appId].logs.push(entry);
  if (processes[appId].logs.length > 500) processes[appId].logs.shift();
  broadcast({ type: 'log', appId, ...entry });
}

function setStatus(appId, status, pid = null) {
  if (!processes[appId]) return;
  processes[appId].status = status;
  processes[appId].pid    = pid;
  broadcast({ type: 'status', appId, status, pid });
}

function getState() {
  const st = {};
  MFE_APPS.forEach(a => {
    st[a.id] = { status: processes[a.id].status, pid: processes[a.id].pid };
  });
  return st;
}

// ═══════════════════════════════════════
// Process Helpers
// ═══════════════════════════════════════
function spawnApp(app, scriptCmd = 'dev') {
  if (processes[app.id].proc) return;

  setStatus(app.id, 'starting');
  pushLog(app.id, `▶ Starting ${app.name} (${app.filter}) ...`);

  const memLimit = app.id === 'shell' || app.id === 'mfe-erp' ? '--max-old-space-size=768' : '--max-old-space-size=384';
  const nodeOpts = `${process.env.NODE_OPTIONS || ''} ${memLimit}`.trim();

  const proc = spawn(PNPM, ['--filter', app.filter, scriptCmd], {
    cwd: ROOT,
    shell: IS_WIN,
    env: { ...process.env, NODE_OPTIONS: nodeOpts, FORCE_COLOR: '1' },
  });

  processes[app.id].proc = proc;

  proc.stdout.on('data', d => pushLog(app.id, d.toString().trimEnd()));
  proc.stderr.on('data', d => pushLog(app.id, d.toString().trimEnd()));

  proc.on('spawn', () => {
    setStatus(app.id, 'running', proc.pid);
    pushLog(app.id, `✅ ${app.name} started (PID ${proc.pid}) → http://localhost:${app.port}`);
  });

  proc.on('close', (code) => {
    processes[app.id].proc = null;
    setStatus(app.id, code === 0 ? 'stopped' : 'error');
    pushLog(app.id, `⏹ ${app.name} exited (code ${code})`);
  });

  proc.on('error', (err) => {
    processes[app.id].proc = null;
    setStatus(app.id, 'error');
    pushLog(app.id, `❌ Error: ${err.message}`);
  });
}

function killApp(app) {
  const { proc } = processes[app.id];
  if (!proc) return;
  setStatus(app.id, 'stopping');
  pushLog(app.id, `⏹ Stopping ${app.name}...`);
  if (IS_WIN) {
    exec(`taskkill /PID ${proc.pid} /T /F`, () => {});
  } else {
    proc.kill('SIGTERM');
  }
  processes[app.id].proc = null;
}

// Generic task runner (install, build, clean, etc.)
function runTask(taskId, label, cmd, args, cwd = ROOT) {
  taskLogs[taskId] = [];
  broadcast({ type: 'task_start', taskId, label });

  const proc = spawn(cmd, args, { cwd, shell: IS_WIN, env: { ...process.env, FORCE_COLOR: '1' } });

  proc.stdout.on('data', d => {
    const line = d.toString().trimEnd();
    taskLogs[taskId].push(line);
    broadcast({ type: 'task_log', taskId, line });
  });
  proc.stderr.on('data', d => {
    const line = d.toString().trimEnd();
    taskLogs[taskId].push(line);
    broadcast({ type: 'task_log', taskId, line });
  });
  proc.on('close', code => broadcast({ type: 'task_done', taskId, code }));
  proc.on('error', err => broadcast({ type: 'task_done', taskId, code: 1, error: err.message }));
}

// Port checker
function checkPort(port, cb) {
  const net = require('net');
  const s = net.createConnection({ port, host: '127.0.0.1' });
  s.on('connect', () => { s.destroy(); cb(true); });
  s.on('error', () => cb(false));
}

// ═══════════════════════════════════════
// REST API Routes
// ═══════════════════════════════════════

// App control
app.post('/api/app/:id/start', (req, res) => {
  const appDef = MFE_APPS.find(a => a.id === req.params.id);
  if (!appDef) return res.status(404).json({ error: 'App not found' });
  spawnApp(appDef);
  res.json({ ok: true });
});

app.post('/api/app/:id/stop', (req, res) => {
  const appDef = MFE_APPS.find(a => a.id === req.params.id);
  if (!appDef) return res.status(404).json({ error: 'App not found' });
  killApp(appDef);
  res.json({ ok: true });
});

app.post('/api/app/:id/restart', (req, res) => {
  const appDef = MFE_APPS.find(a => a.id === req.params.id);
  if (!appDef) return res.status(404).json({ error: 'App not found' });
  killApp(appDef);
  setTimeout(() => spawnApp(appDef), 1200);
  res.json({ ok: true });
});

app.get('/api/app/:id/logs', (req, res) => {
  const id = req.params.id;
  res.json(processes[id]?.logs ?? []);
});

// Start / Stop ALL
app.post('/api/all/start', (req, res) => {
  MFE_APPS.forEach(a => { if (!processes[a.id].proc) spawnApp(a); });
  res.json({ ok: true });
});

app.post('/api/all/stop', (req, res) => {
  MFE_APPS.forEach(a => killApp(a));
  res.json({ ok: true });
});

// Start Workspaces Preset (RAM Saver)
app.post('/api/preset/:preset', (req, res) => {
  const { preset } = req.params;
  const PRESETS = {
    pos: ['shell', 'mfe-auth', 'mfe-pos'],
    erp: ['shell', 'mfe-auth', 'mfe-erp', 'mfe-catalog', 'mfe-users'],
    marketing: ['mfe-marketing'],
    core: ['shell', 'mfe-auth'],
  };
  const targetIds = PRESETS[preset];
  if (!targetIds) return res.status(400).json({ error: 'Unknown preset' });

  MFE_APPS.forEach(a => {
    if (!targetIds.includes(a.id)) killApp(a);
  });
  MFE_APPS.forEach(a => {
    if (targetIds.includes(a.id)) spawnApp(a);
  });
  res.json({ ok: true, activeApps: targetIds });
});

// Shared packages build
app.post('/api/packages/build', (req, res) => {
  const taskId = `build-packages-${Date.now()}`;
  runTask(taskId, '⚙️ Build Shared Packages', PNPM, ['--filter', './packages/*', 'build']);
  res.json({ taskId });
});

// Install
app.post('/api/install', (req, res) => {
  const taskId = `install-${Date.now()}`;
  runTask(taskId, '📦 pnpm install', PNPM, ['install']);
  res.json({ taskId });
});

// Build specific app
app.post('/api/app/:id/build', (req, res) => {
  const appDef = MFE_APPS.find(a => a.id === req.params.id);
  if (!appDef) return res.status(404).json({ error: 'App not found' });
  const taskId = `build-${appDef.id}-${Date.now()}`;
  runTask(taskId, `🔨 Build ${appDef.name}`, PNPM, ['--filter', appDef.filter, 'build']);
  res.json({ taskId });
});

// Type-check all
app.post('/api/typecheck', (req, res) => {
  const taskId = `typecheck-${Date.now()}`;
  runTask(taskId, '🔎 Type-Check All', PNPM, ['turbo', 'run', 'type-check']);
  res.json({ taskId });
});

// Lint all
app.post('/api/lint', (req, res) => {
  const taskId = `lint-${Date.now()}`;
  runTask(taskId, '✨ ESLint All', PNPM, ['turbo', 'run', 'lint']);
  res.json({ taskId });
});

// Clean (remove dist/.next/.output/.turbo)
app.post('/api/clean', (req, res) => {
  const taskId = `clean-${Date.now()}`;
  const cmd = IS_WIN
    ? 'cmd'
    : 'bash';
  const args = IS_WIN
    ? ['/c', 'for /d /r . %d in (dist,.next,.output,.turbo,.nuxt) do @if exist "%d" rd /s /q "%d"']
    : ['-c', 'find . -type d \\( -name dist -o -name .next -o -name .output -o -name .turbo -o -name .nuxt \\) -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null; echo Done'];
  runTask(taskId, '🧹 Clean All Build Artifacts', cmd, args);
  res.json({ taskId });
});

// Git sync (pull)
app.post('/api/git/pull', (req, res) => {
  const taskId = `git-pull-${Date.now()}`;
  runTask(taskId, '🔄 git pull', IS_WIN ? 'git.exe' : 'git', ['pull', '--rebase']);
  res.json({ taskId });
});

// Git status
app.get('/api/git/status', (req, res) => {
  exec('git log --oneline -5 && git status --short', { cwd: ROOT }, (err, stdout) => {
    res.json({ output: stdout });
  });
});

// Port scan
app.get('/api/ports', async (req, res) => {
  const results = {};
  let remaining = MFE_APPS.length;
  MFE_APPS.forEach(a => {
    checkPort(a.port, (open) => {
      results[a.id] = open;
      if (--remaining === 0) res.json(results);
    });
  });
});

// System info
app.get('/api/system', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    platform: os.platform(),
    nodeVersion: process.version,
    totalMem: os.totalmem(),
    freeMem: os.freemem(),
    cpus: os.cpus().length,
    loadAvg: IS_WIN ? [] : os.loadavg(),
    uptime: Math.round(process.uptime()),
  });
});

// Task logs retrieval
app.get('/api/task/:id/logs', (req, res) => {
  res.json(taskLogs[req.params.id] ?? []);
});

// Apps registry (metadata for UI)
app.get('/api/apps', (req, res) => {
  res.json(MFE_APPS);
});

// ═══════════════════════════════════════
// Environment Management API
// ═══════════════════════════════════════
const ENV_MODES = ['local', 'development', 'staging', 'production'];

function getActiveEnv() {
  try {
    const rootEnvPath = path.join(ROOT, '.env');
    if (!fs.existsSync(rootEnvPath)) return 'local';
    const content = fs.readFileSync(rootEnvPath, 'utf8');
    const match = content.match(/NEXUS_ENV=(\w+)/);
    return match ? match[1] : 'local';
  } catch {
    return 'local';
  }
}

function syncEnvToApps(envContent) {
  const appDirs = [
    'apps/shell',
    'apps/mfe-auth',
    'apps/mfe-pos',
    'apps/mfe-erp',
    'apps/mfe-catalog',
    'apps/mfe-users',
    'apps/mfe-marketing'
  ];
  appDirs.forEach(sub => {
    const p = path.join(ROOT, sub, '.env');
    try {
      fs.writeFileSync(p, envContent, 'utf8');
    } catch (e) {}
  });
}

app.get('/api/env', (req, res) => {
  const active = getActiveEnv();
  const envs = {};
  ENV_MODES.forEach(mode => {
    const p = path.join(ROOT, mode === 'local' ? '.env.local' : `.env.${mode}`);
    envs[mode] = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  });
  const currentRoot = fs.existsSync(path.join(ROOT, '.env')) ? fs.readFileSync(path.join(ROOT, '.env'), 'utf8') : '';
  res.json({ active, envs, currentRoot, modes: ENV_MODES });
});

app.post('/api/env/switch', (req, res) => {
  const { mode } = req.body;
  if (!ENV_MODES.includes(mode)) return res.status(400).json({ error: 'Invalid mode' });
  const src = path.join(ROOT, mode === 'local' ? '.env.local' : `.env.${mode}`);
  if (!fs.existsSync(src)) return res.status(404).json({ error: `File for ${mode} not found` });
  const content = fs.readFileSync(src, 'utf8');
  fs.writeFileSync(path.join(ROOT, '.env'), content, 'utf8');
  syncEnvToApps(content);
  broadcast({ type: 'env_change', active: mode });
  res.json({ ok: true, active: mode });
});

app.post('/api/env/save', (req, res) => {
  const { mode, content } = req.body;
  if (!ENV_MODES.includes(mode)) return res.status(400).json({ error: 'Invalid mode' });
  const target = path.join(ROOT, mode === 'local' ? '.env.local' : `.env.${mode}`);
  fs.writeFileSync(target, content, 'utf8');
  const active = getActiveEnv();
  if (active === mode) {
    fs.writeFileSync(path.join(ROOT, '.env'), content, 'utf8');
    syncEnvToApps(content);
  }
  res.json({ ok: true });
});

app.post('/api/env/sync', (req, res) => {
  const p = path.join(ROOT, '.env');
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, 'utf8');
    syncEnvToApps(content);
  }
  res.json({ ok: true });
});

// App-specific ENV endpoints
const APP_PATHS = {
  shell: 'apps/shell',
  'mfe-auth': 'apps/mfe-auth',
  'mfe-pos': 'apps/mfe-pos',
  'mfe-erp': 'apps/mfe-erp',
  'mfe-catalog': 'apps/mfe-catalog',
  'mfe-users': 'apps/mfe-users',
  'mfe-marketing': 'apps/mfe-marketing',
};

app.get('/api/env/app/:id', (req, res) => {
  const dir = APP_PATHS[req.params.id];
  if (!dir) return res.status(404).json({ error: 'App not found' });
  const p = path.join(ROOT, dir, '.env');
  const content = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  const rootContent = fs.existsSync(path.join(ROOT, '.env')) ? fs.readFileSync(path.join(ROOT, '.env'), 'utf8') : '';
  const isSynced = content.trim() === rootContent.trim();
  res.json({ appId: req.params.id, content, isSynced, path: `${dir}/.env` });
});

app.post('/api/env/app/:id', (req, res) => {
  const dir = APP_PATHS[req.params.id];
  if (!dir) return res.status(404).json({ error: 'App not found' });
  const { content } = req.body;
  const p = path.join(ROOT, dir, '.env');
  fs.writeFileSync(p, content, 'utf8');
  res.json({ ok: true, appId: req.params.id });
});

app.get('/api/env/apps/status', (req, res) => {
  const rootContent = fs.existsSync(path.join(ROOT, '.env')) ? fs.readFileSync(path.join(ROOT, '.env'), 'utf8') : '';
  const status = {};
  Object.keys(APP_PATHS).forEach(id => {
    const p = path.join(ROOT, APP_PATHS[id], '.env');
    const exists = fs.existsSync(p);
    const content = exists ? fs.readFileSync(p, 'utf8') : '';
    status[id] = {
      exists,
      isSynced: exists && content.trim() === rootContent.trim(),
      path: `${APP_PATHS[id]}/.env`
    };
  });
  res.json(status);
});

// ═══════════════════════════════════════
// Start Server
// ═══════════════════════════════════════
const PORT = 9000;
server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   🚀  Nexus DevKit Dashboard             ║`);
  console.log(`║   http://localhost:${PORT}                  ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);

  // Auto-open browser
  try {
    const openPkg = require('open');
    openPkg(`http://localhost:${PORT}`).catch(() => {});
  } catch {}
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[DevKit] Shutting down all processes...');
  MFE_APPS.forEach(a => killApp(a));
  setTimeout(() => process.exit(0), 1500);
});
