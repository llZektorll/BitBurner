/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const ports = portsAvailable(ns);
  let rooted = 0;
  let skipped = 0;

  for (const host of scanAll(ns)) {
    if (host === "home") continue;
    if (ns.hasRootAccess(host)) continue;
    if (ns.getServerNumPortsRequired(host) > ports) {
      skipped++;
      continue;
    }
    if (tryRoot(ns, host)) rooted++;
  }

  ns.tprint(`auto-root: rooted ${rooted}, skipped ${skipped} needing more port programs.`);
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
