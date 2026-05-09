/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);
  const worker = "/auto/worker.js";

  while (true) {
    for (const host of scanAll(ns)) tryRoot(ns, host);
    const target = chooseTarget(ns);
    const minSec = ns.getServerMinSecurityLevel(target);
    const sec = ns.getServerSecurityLevel(target);
    const maxMoney = ns.getServerMaxMoney(target);
    const cash = ns.getServerMoneyAvailable(target);
    const rooted = rootedServers(ns).filter((host) => host !== "home").join(", ");
    const deployed = await deployWorkers(ns, rootedServers(ns), worker, target);

    ns.clearLog();
    ns.print("AUTO EARLY BOOTSTRAP");
    ns.print(`hacking level: ${ns.getHackingLevel()}`);
    ns.print(`home money: ${money(ns, ns.getServerMoneyAvailable("home"))}`);
    ns.print(`rooted: ${rooted || "none yet"}`);
    ns.print(`worker hosts: ${deployed.hosts || "none yet"}`);
    ns.print(`worker threads: ${deployed.threads}`);
    ns.print(`target: ${target}`);
    ns.print(`target money: ${money(ns, cash)} / ${money(ns, maxMoney)}`);
    ns.print(`target security: ${sec.toFixed(2)} / ${minSec.toFixed(2)}`);

    if (sec > minSec + 3) {
      ns.print("action: weaken");
      await ns.weaken(target);
    } else if (maxMoney > 0 && cash < maxMoney * 0.75) {
      ns.print("action: grow");
      await ns.grow(target);
    } else {
      ns.print("action: hack");
      await ns.hack(target);
    }
  }
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Early Bootstrap");
    ns.ui?.resizeTail?.(520, 360);
  } catch {
    // The script still works if the UI API is unavailable.
  }
}

function chooseTarget(ns) {
  let best = "n00dles";
  let bestScore = 0;
  for (const host of scanAll(ns)) {
    if (!ns.hasRootAccess(host)) continue;
    if (ns.getServerRequiredHackingLevel(host) > ns.getHackingLevel()) continue;
    const maxMoney = ns.getServerMaxMoney(host);
    if (maxMoney <= 0) continue;
    const score = (maxMoney * ns.hackAnalyzeChance(host)) / Math.max(1, ns.getWeakenTime(host));
    if (score > bestScore) {
      best = host;
      bestScore = score;
    }
  }
  return best;
}

async function deployWorkers(ns, hosts, worker, target) {
  let threads = 0;
  const usedHosts = [];
  for (const host of hosts) {
    if (!ns.hasRootAccess(host)) continue;
    if (ns.getServerMaxRam(host) <= 0) continue;
    try {
      await ns.scp(worker, host, "home");
    } catch {
      continue;
    }

    const stale = ns.ps(host).filter((p) => p.filename === worker && p.args[0] !== target);
    for (const proc of stale) ns.kill(proc.pid);

    const already = ns.ps(host).some((p) => p.filename === worker && p.args[0] === target);
    if (!already) {
      const ram = ns.getScriptRam(worker, host);
      const free = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
      const count = Math.floor(free / ram);
      if (count > 0) ns.exec(worker, host, count, target, "smart");
    }

    const running = ns.ps(host).filter((p) => p.filename === worker && p.args[0] === target);
    const hostThreads = running.reduce((sum, proc) => sum + proc.threads, 0);
    if (hostThreads > 0) {
      threads += hostThreads;
      usedHosts.push(host);
    }
  }
  return { hosts: usedHosts.join(", "), threads };
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

function rootedServers(ns) {
  return scanAll(ns).filter((host) => {
    try {
      return ns.hasRootAccess(host) && ns.getServerMaxRam(host) > 0;
    } catch {
      return false;
    }
  });
}

function tryRoot(ns, host) {
  if (host === "home" || ns.hasRootAccess(host)) return true;
  try {
    ns.nuke(host);
  } catch {
    return false;
  }
  return ns.hasRootAccess(host);
}

function money(ns, value) {
  if (ns.format?.money) return ns.format.money(value, 2);
  if (ns.format?.number) return "$" + ns.format.number(value, 2);
  return "$" + Number(value).toLocaleString();
}
