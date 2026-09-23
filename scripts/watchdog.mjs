// The gate's watchdog. F10.
//
// A run of the suite is one `page.evaluate` in scripts/suite.mjs. That call
// takes no `timeout` option and `page.setDefaultTimeout` does not cover it,
// so before F10 a check that hung in the page - one awaiting a promise that
// never settles, or `h.nextFrame()` where frames never fire - wedged the
// runner with no output at all: the `finally` that closes Chrome never ran,
// and node plus a SwiftShader Chrome were left spinning. One of those was
// found alive four days after the build that started it, its renderer 1,975
// CPU-seconds in and its in-process server still listening, competing for
// the pinned cores with every run timed since. A routine cannot clear one -
// the sandbox refuses `taskkill` - so the gate has to not make them.
//
// Three parts, and they are separate from suite.mjs because that file is at
// the ~600 line split guidance:
//
//   withDeadline   race a run against its own heartbeat standing still, and
//                  throw - naming the check in flight - rather than wait
//                  forever. The page publishes the heartbeat from
//                  src/ui/autosuite.js (`beat()`): a monotonic sequence, the
//                  count done, the run's total, the id running. The deadline
//                  is against that standing still and never against
//                  wall-clock total, because a cold plant run is
//                  legitimately 850s and slow must not be called hung.
//   teardown       close the browser and the server once, bounded, so a
//                  close that itself hangs cannot reproduce the bug.
//   otherRunners   name any older suite.mjs still alive at startup, because
//                  its Chrome invalidates every timing in the report.
//
// And the signal handlers: SIGINT and SIGTERM tear the tree down, so
// stopping a backgrounded run stops it instead of orphaning it.

import { execFileSync } from 'node:child_process';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Other `suite.mjs` processes older than this one. Each owns a headless
 * Chrome competing for the same pinned cores, so every timing in a report
 * taken beside one is measured against it, and a report that does not say so
 * invites the wrong conclusion about what made a run slow.
 *
 * Best effort by design: a failure here costs a warning, not a run.
 *
 * @returns {{pid: number, started: string}[]}
 */
export function otherRunners() {
  if (process.platform !== 'win32') return [];
  const script = [
    '$ErrorActionPreference = "SilentlyContinue"',
    'Get-CimInstance Win32_Process -Filter "Name=\'node.exe\'" |',
    "  Where-Object { $_.CommandLine -like '*suite.mjs*' } |",
    '  ForEach-Object { "$($_.ProcessId)|$($_.CreationDate.ToString(\'s\'))" }',
  ].join('\n');
  try {
    const out = execFileSync('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'ignore'] });
    const mine = Date.now() - process.uptime() * 1000;
    const found = [];
    for (const line of String(out).split('\n')) {
      const [pid, started] = line.trim().split('|');
      const id = Number(pid);
      // A blank line parses as 0, which is finite; a pid is never 0.
      if (!Number.isFinite(id) || id <= 0 || id === process.pid) continue;
      // Older than this process only: a run started after this one is
      // somebody else's business, one started before it is a leak from a run
      // that never reached its teardown. No timestamp means it is reported.
      if (started && Date.parse(started) >= mine) continue;
      found.push({ pid: id, started: started || 'unknown' });
    }
    return found;
  } catch {
    return [];
  }
}

/**
 * The deadline, the teardown and the signal handlers, over one browser and
 * one server that the caller attaches as it creates them.
 *
 * Creating a guard registers process-wide signal handlers, so one run makes
 * one guard.
 *
 * @param {object} options
 * @param {number} options.stallMs how long the page's heartbeat may stand
 *   still before the run is called hung. 0 disables the deadline.
 * @param {number} [options.heartbeatMs] how often the heartbeat is read
 * @param {(line: string) => void} [options.warn] where notices go
 */
export function createGuard({ stallMs, heartbeatMs = 5000, warn = line => process.stderr.write(line) }) {
  let browser = null;
  let server = null;
  let tearingDown = false;

  /** The browser and the server to close, as they come into existence. */
  function attach(parts) {
    if (parts.browser) browser = parts.browser;
    if (parts.server) server = parts.server;
  }

  /**
   * Close both, once, and never hang doing it. The orphan this file was
   * written for held its port open because nothing ever got this far; a
   * close that itself hung would do the same, so it is bounded.
   */
  async function teardown() {
    if (tearingDown) return;
    tearingDown = true;
    try { if (browser) await Promise.race([browser.close(), sleep(15000)]); } catch { /* going away */ }
    try {
      if (server) {
        server.close();
        // Keep-alive sockets outlive close() and would hold the port.
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      }
    } catch { /* going away */ }
  }

  /**
   * The heartbeat src/ui/autosuite.js publishes, copied out of the page.
   * Raced against the poll interval, so a page whose main thread is busy
   * answers null and counts as a beat that has not moved - rather than
   * hanging this watcher the way it hung the run.
   *
   * @returns {Promise<object|null>}
   */
  function readBeat(page) {
    const ask = page.evaluate(() => {
      const s = window.BLACKLINE && window.BLACKLINE.debugState;
      const p = s && s.suiteProgress;
      return p ? { seq: p.seq, done: p.done, total: p.total, inFlight: p.inFlight, last: p.last, phase: p.phase } : null;
    }).catch(() => null);
    return Promise.race([ask, sleep(heartbeatMs).then(() => null)]);
  }

  /**
   * Race a run against its heartbeat standing still, and throw rather than
   * wait forever when it does. The throw reaches suite.mjs's catch, which
   * prints `suite: crashed: ...` and exits 2 - the runner-crashed code -
   * after the teardown above has closed the browser and the server.
   *
   * @param {object} page the Playwright page the run is driving
   * @param {Promise} work the run's own `page.evaluate`
   * @param {string} where map and run number, for the message
   * @returns {Promise} whatever `work` returned
   */
  async function withDeadline(page, work, where) {
    if (!stallMs) return work;
    let settled = false;
    const done = work.then(v => { settled = true; return v; }, e => { settled = true; throw e; });
    // The throw below leaves `work` pending until teardown rejects it.
    done.catch(() => {});

    const watch = (async () => {
      let seq = null;
      let movedAt = Date.now();
      let seen = null;
      while (!settled) {
        await sleep(heartbeatMs);
        if (settled) return null;
        const beat = await readBeat(page);
        if (settled) return null;
        if (beat && beat.seq !== seq) { seq = beat.seq; seen = beat; movedAt = Date.now(); continue; }
        const still = Date.now() - movedAt;
        if (still >= stallMs) return { still, beat: seen };
      }
      return null;
    })();

    const stall = await Promise.race([done.then(() => null, () => null), watch]);
    if (stall) {
      const b = stall.beat;
      const at = b
        ? `the check in flight was "${b.inFlight || b.last || '?'}" (${b.done}/${b.total}, phase ${b.phase})`
        : 'the page never published a heartbeat at all';
      throw new Error(`run timed out: the suite heartbeat stood still for ${Math.round(stall.still / 1000)}s`
        + ` on ${where}; ${at}. Raise --stall if the run was merely slow.`);
    }
    return done;
  }

  // Stopping a backgrounded run must stop the tree, not orphan it. SIGTERM
  // is never raised by `taskkill /F` on Windows, but it is by every other
  // way of ending this process; SIGBREAK is Ctrl+Break's.
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
    process.on(signal, () => {
      warn(`suite: ${signal}; closing the browser and the server\n`);
      teardown().finally(() => process.exit(2));
    });
  }

  return { attach, teardown, withDeadline };
}
