const SHARE_SCRIPT = "/auto/share.js";
const WORKER_SCRIPT = "/auto/worker.js";
const STATE_FILE = "/auto/state-objectives.txt";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  while (true) {
    const state = readState(ns);
    const active = shouldShare(state);
    const ratio = active ? shareRatio(state) : 0;
    const result = await applyShare(ns, ratio);
    render(ns, state, active, ratio, result);
    await ns.sleep(15000);
  }
}

async function applyShare(ns, ratio) {
  let hosts = 0;
  let threads = 0;
  let stopped = 0;

  for (const host of workerHosts(ns)) {
    await ns.scp(SHARE_SCRIPT, host, "home");
    const maxRam = ns.getServerMaxRam(host);
    if (maxRam <= 0) continue;

    const shareRam = ns.getScriptRam(SHARE_SCRIPT, host);
    const targetThreads = Math.floor((maxRam * ratio) / shareRam);
    const current = ns.ps(host).filter((p) => p.filename === SHARE_SCRIPT);
    const currentThreads = current.reduce((sum, p) => sum + p.threads, 0);

    if (targetThreads === 0) {
      for (const proc of current) {
        ns.kill(proc.pid);
        stopped++;
      }
      continue;
    }

    if (currentThreads > targetThreads) {
      for (const proc of current) {
        ns.kill(proc.pid);
        stopped++;
      }
    }

    if (currentThreads < targetThreads) {
      const needed = targetThreads - currentThreads;
      ensureFreeRam(ns, host, needed * shareRam);
      const possible = Math.floor(freeRam(ns, host) / shareRam);
      const count = Math.min(needed, possible);
      if (count > 0) ns.exec(SHARE_SCRIPT, host, count);
    }

    const running = ns.ps(host).filter((p) => p.filename === SHARE_SCRIPT);
    const hostThreads = running.reduce((sum, p) => sum + p.threads, 0);
    if (hostThreads > 0) {
      hosts++;
      threads += hostThreads;
    }
  }

  return { hosts, threads, stopped };
}

function ensureFreeRam(ns, host, neededRam) {
  let free = freeRam(ns, host);
  if (free >= neededRam) return;
  const workers = ns.ps(host).filter((p) => p.filename === WORKER_SCRIPT);
  for (const proc of workers) {
    ns.kill(proc.pid);
    free = freeRam(ns, host);
    if (free >= neededRam) return;
  }
}

function freeRam(ns, host) {
  return ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
}

function shouldShare(state) {
  if (!state) return false;
  return Boolean(state.goals?.share || state.pendingAugs > 0);
}

function shareRatio(state) {
  if (!state) return 0;
  if (state.phase === "install") return 0.9;
  if (state.pendingAugs > 0) return 0.35;
  if (state.phase === "scale") return 0.25;
  return 0.15;
}

function workerHosts(ns) {
  return scanAll(ns)
    .filter((host) => ns.hasRootAccess(host) && ns.getServerMaxRam(host) > 0)
    .sort((a, b) => ns.getServerMaxRam(b) - ns.getServerMaxRam(a));
}

function readState(ns) {
  try {
    if (!ns.fileExists(STATE_FILE, "home")) return null;
    return JSON.parse(ns.read(STATE_FILE));
  } catch {
    return null;
  }
}

function scanAll(ns) {
  const seen = new Set(["home"]);
  const queue = ["home"];
  for (let i = 0; i < queue.length; i++) {
    for (const next of ns.scan(queue[i])) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return [...seen];
}

function render(ns, state, active, ratio, result) {
  ns.clearLog();
  ns.print("AUTO SHARE");
  ns.print(`active: ${active}`);
  ns.print(`phase: ${state?.phase ?? "none"}`);
  ns.print(`pending augmentations: ${state?.pendingAugs ?? 0}`);
  ns.print(`target RAM ratio: ${(ratio * 100).toFixed(0)}%`);
  ns.print(`share hosts: ${result.hosts}`);
  ns.print(`share threads: ${result.threads}`);
  ns.print(`stopped processes: ${result.stopped}`);
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Share");
    ns.ui?.resizeTail?.(520, 320);
  } catch {
    // Sharing still works without the tail API.
  }
}
