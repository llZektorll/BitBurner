import {
  CONF,
  bestTargets,
  deploy,
  money,
  readObjectives,
  rootedServers,
  scanAll,
  threadsFor,
  tryRoot,
} from "./lib.js";

const FILES = ["/auto/worker.js"];

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui?.openTail?.();

  while (true) {
    for (const host of scanAll(ns)) tryRoot(ns, host);
    const objectives = readObjectives(ns);
    const shareRatio = activeShareRatio(objectives);
    if (shareRatio === 0) cleanupShareWorkers(ns);

    const targets = bestTargets(ns, 12);
    if (targets.length === 0) {
      ns.print("No profitable rooted target yet. Falling back to n00dles.");
      targets.push("n00dles");
      tryRoot(ns, "n00dles");
    }

    const hosts = rootedServers(ns).sort((a, b) => ns.getServerMaxRam(b) - ns.getServerMaxRam(a));
    let launches = 0;
    let totalThreads = 0;

    for (const host of hosts) {
      await deploy(ns, FILES, host);
      const maxThreads = workerThreads(ns, host, shareRatio);
      if (maxThreads <= 0) continue;

      const target = chooseTarget(ns, targets);
      const workerProcs = ns.ps(host).filter((p) => p.filename === CONF.worker);
      const stale = workerProcs.filter((p) => p.args[0] !== target || String(p.args[1]) !== "smart");
      for (const proc of stale) ns.kill(proc.pid);

      const running = ns.ps(host).some(
        (p) => p.filename === CONF.worker && p.args[0] === target && String(p.args[1]) === "smart",
      );
      if (running) continue;

      const pid = ns.exec(CONF.worker, host, maxThreads, target, "smart");
      if (pid !== 0) {
        launches++;
        totalThreads += maxThreads;
      }
    }

    const top = targets[0];
    ns.print(
      `targets=${targets.slice(0, 4).join(", ")} top=${top} max=${money(
        ns,
        ns.getServerMaxMoney(top),
      )} shareReserve=${(shareRatio * 100).toFixed(0)}% launches=${launches} threads=${totalThreads}`,
    );
    await ns.sleep(CONF.cycleMs);
  }
}

function cleanupShareWorkers(ns) {
  for (const host of rootedServers(ns)) {
    for (const proc of ns.ps(host)) {
      if (proc.filename === CONF.shareWorker) ns.kill(proc.pid);
    }
  }
}

function activeShareRatio(objectives) {
  if (!objectives || !objectives.goals?.share) return 0;
  if (objectives.phase === "install") return 0.9;
  if (objectives.pendingAugs > 0) return 0.35;
  if (objectives.phase === "scale") return 0.25;
  return 0.15;
}

function workerThreads(ns, host, shareRatio) {
  const ram = ns.getScriptRam(CONF.worker, host);
  if (!Number.isFinite(ram) || ram <= 0) return 0;
  const reserveHome = host === "home" ? CONF.reserveHomeRam : 0;
  const shareReserve = ns.getServerMaxRam(host) * shareRatio;
  const free = Math.max(0, ns.getServerMaxRam(host) - ns.getServerUsedRam(host) - reserveHome - shareReserve);
  return Math.floor(free / ram);
}

function chooseTarget(ns, targets) {
  for (const target of targets) {
    const minSec = ns.getServerMinSecurityLevel(target);
    const sec = ns.getServerSecurityLevel(target);
    const maxMoney = ns.getServerMaxMoney(target);
    const available = ns.getServerMoneyAvailable(target);
    if (sec <= minSec + CONF.weakenBuffer && available >= maxMoney * 0.6) return target;
  }
  return targets[0];
}
