// Client for the long-running Python worker (functions/worker.py).
// The worker loads the ML models once, so requests skip the multi-second
// Python + torch startup that spawning a process per request used to cost.
const { spawn } = require('child_process');
const readline = require('readline');

const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
const DEFAULT_TIMEOUT_MS = 4 * 60 * 1000;

let worker = null;
let ready = null;
let nextId = 1;
const pending = new Map();

function startWorker() {
  const proc = spawn(pythonCommand, ['functions/worker.py'], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  worker = proc;

  ready = new Promise((resolve, reject) => {
    const lines = readline.createInterface({ input: proc.stdout });
    lines.on('line', (line) => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        console.error('Python worker sent invalid output:', line.slice(0, 200));
        return;
      }
      if (message.ready) return resolve();

      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.ok) request.resolve(message.result);
      else request.reject(new Error(message.error));
    });

    proc.on('exit', (code, signal) => {
      console.error(`Python worker exited (code ${code}, signal ${signal})`);
      reject(new Error('Python worker exited before it was ready'));
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error('Python worker exited'));
      }
      pending.clear();
      // Restart lazily on the next task so a broken install doesn't crash-loop
      if (worker === proc) worker = null;
    });
  });
  ready.catch(() => {});
}

async function runPythonTask(task, args = {}, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!worker) startWorker();
  await ready;

  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Python task "${task}" timed out`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    worker.stdin.write(JSON.stringify({ id, task, args }) + '\n');
  });
}

module.exports = { startWorker, runPythonTask };
