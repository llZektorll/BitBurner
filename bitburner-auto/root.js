/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  while (true) {
    const result = rootPass(ns);
    render(ns, result);
    await ns.sleep(result.rooted > 0 ? 1000 : 5000);
  }
}

function rootPass(ns) {
  const ports = portsAvailable(ns);
  const all = scanAll(ns).filter((host) => host !== "home");
  let rooted = 0;
  let owned = 0;
  let eligible = 0;
  const blocked = [];

  for (const host of all.sort((a, b) => ns.getServerNumPortsRequired(a) - ns.getServerNumPortsRequired(b))) {
    if (ns.hasRootAccess(host)) {
      owned++;
      continue;
    }
    const needed = ns.getServerNumPortsRequired(host);
    if (needed > ports) {
      blocked.push(`${host}(${needed})`);
      continue;
    }
    eligible++;
    if (tryRoot(ns, host)) {
      rooted++;
      owned++;
    }
  }

  return { ports, total: all.length, owned, rooted, eligible, blocked };
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

function portsAvailable(ns) {
  return [
    "BruteSSH.exe",
    "FTPCrack.exe",
    "relaySMTP.exe",
    "HTTPWorm.exe",
    "SQLInject.exe",
  ].filter((program) => ns.fileExists(program, "home")).length;
}

function tryRoot(ns, host) {
  if (host === "home" || ns.hasRootAccess(host)) return true;
  const openers = [
    ["BruteSSH.exe", ns.brutessh],
    ["FTPCrack.exe", ns.ftpcrack],
    ["relaySMTP.exe", ns.relaysmtp],
    ["HTTPWorm.exe", ns.httpworm],
    ["SQLInject.exe", ns.sqlinject],
  ];
  for (const [program, fn] of openers) {
    if (!ns.fileExists(program, "home")) continue;
    try {
      fn(host);
    } catch {
      // Program is unavailable or host cannot be opened yet.
    }
  }
  try {
    ns.nuke(host);
  } catch {
    return false;
  }
  return ns.hasRootAccess(host);
}

function render(ns, result) {
  ns.clearLog();
  ns.print("AUTO ROOT");
  ns.print(`ports available: ${result.ports}/5`);
  ns.print(`rooted: ${result.owned}/${result.total}`);
  ns.print(`rooted this pass: ${result.rooted}`);
  ns.print(`eligible this pass: ${result.eligible}`);
  ns.print(`blocked: ${result.blocked.slice(0, 12).join(", ") || "none"}`);
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Root");
    ns.ui?.resizeTail?.(540, 320);
  } catch {
    // Rooting still works without a tail window.
  }
}
