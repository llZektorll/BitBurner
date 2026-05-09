export const CONF = {
  prefix: "auto",
  worker: "/auto/worker.js",
  shareWorker: "/auto/share.js",
  reserveHomeRam: 0,
  minHackChance: 0.65,
  hackMoneyRatio: 0.08,
  weakenBuffer: 2,
  cycleMs: 4500,
  serverBudgetRatio: 0.45,
  hacknetBudgetRatio: 0.02,
  hacknetMinCash: 10000000,
  homeUpgradeBudgetRatio: 0.55,
  minServerRam: 8,
  minPendingAugsToInstall: 5,
  objectiveStateFile: "/auto/state-objectives.txt",
  endgameStateFile: "/auto/state-endgame.txt",
  bitnodeStateFile: "/auto/state-bitnode.txt",
  darknetStateFile: "/auto/state-darknet.txt",
  workLockFile: "/auto/state-worklock.txt",
  preferredTargets: [
    "n00dles",
    "foodnstuff",
    "sigma-cosmetics",
    "joesguns",
    "nectar-net",
    "hong-fang-tea",
    "harakiri-sushi",
    "iron-gym",
    "phantasy",
    "omega-net",
    "the-hub",
    "silver-helix",
    "neo-net",
    "zer0",
    "max-hardware",
    "johnson-ortho",
    "crush-fitness",
    "computek",
    "netlink",
    "catalyst",
    "rothman-uni",
    "summit-uni",
    "rho-construction",
    "millenium-fitness",
    "aevum-police",
    "snap-fitness",
    "lexo-corp",
    "global-pharm",
    "unitalife",
    "univ-energy",
    "nova-med",
    "zb-institute",
    "omnia",
    "4sigma",
    "blade",
    "b-and-a",
    "clarkinc",
    "ecorp",
    "megacorp",
    "kuai-gong",
    "fulcrumtech",
    "nwo",
  ],
};

export function fmt(ns, value) {
  if (ns.format?.number) return ns.format.number(value, 2);
  return Number(value).toLocaleString();
}

export function money(ns, value) {
  if (ns.format?.money) return ns.format.money(value, 2);
  if (ns.format?.number) return "$" + ns.format.number(value, 2);
  return "$" + fmt(ns, value);
}

export function scanAll(ns) {
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

export function portsAvailable(ns) {
  const programs = [
    "BruteSSH.exe",
    "FTPCrack.exe",
    "relaySMTP.exe",
    "HTTPWorm.exe",
    "SQLInject.exe",
  ];
  return programs.filter((program) => ns.fileExists(program, "home")).length;
}

export function tryRoot(ns, host) {
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
      // Bitburner 3.0 returns false for some failures; older versions may throw.
    }
  }
  try {
    ns.nuke(host);
  } catch {
    return false;
  }
  return ns.hasRootAccess(host);
}

export function rootedServers(ns) {
  return scanAll(ns).filter((host) => {
    try {
      return ns.hasRootAccess(host) && ns.getServerMaxRam(host) > 0;
    } catch {
      return false;
    }
  });
}

export function availableRam(ns, host, reserveHomeRam = CONF.reserveHomeRam) {
  const max = ns.getServerMaxRam(host);
  const used = ns.getServerUsedRam(host);
  const reserve = host === "home" ? reserveHomeRam : 0;
  return Math.max(0, max - used - reserve);
}

export function scoreTarget(ns, host) {
  const maxMoney = ns.getServerMaxMoney(host);
  if (maxMoney <= 0) return 0;
  const req = ns.getServerRequiredHackingLevel(host);
  if (req > ns.getHackingLevel()) return 0;
  const chance = ns.hackAnalyzeChance(host);
  if (chance < CONF.minHackChance) return 0;
  const securityPenalty = Math.max(1, ns.getServerSecurityLevel(host) - ns.getServerMinSecurityLevel(host));
  return (maxMoney * chance) / (Math.max(1, ns.getWeakenTime(host)) * securityPenalty);
}

export function bestTargets(ns, limit = 10) {
  return scanAll(ns)
    .filter((host) => {
      try {
        return ns.hasRootAccess(host) && ns.getServerMaxMoney(host) > 0;
      } catch {
        return false;
      }
    })
    .map((host) => ({ host, score: scoreTarget(ns, host) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.host);
}

export function threadsFor(ns, script, host, reserveHomeRam = CONF.reserveHomeRam) {
  const ram = ns.getScriptRam(script, host);
  if (!Number.isFinite(ram) || ram <= 0) return 0;
  return Math.floor(availableRam(ns, host, reserveHomeRam) / ram);
}

export async function deploy(ns, files, host) {
  if (host === "home") return true;
  try {
    return await ns.scp(files, host, "home");
  } catch {
    return false;
  }
}

export function readObjectives(ns) {
  try {
    if (!ns.fileExists(CONF.objectiveStateFile, "home")) return null;
    return JSON.parse(ns.read(CONF.objectiveStateFile));
  } catch {
    return null;
  }
}

export function readEndgame(ns) {
  try {
    if (!ns.fileExists(CONF.endgameStateFile, "home")) return null;
    return JSON.parse(ns.read(CONF.endgameStateFile));
  } catch {
    return null;
  }
}

export function readBitnode(ns) {
  try {
    if (!ns.fileExists(CONF.bitnodeStateFile, "home")) return null;
    return JSON.parse(ns.read(CONF.bitnodeStateFile));
  } catch {
    return null;
  }
}

export function acquireWorkLock(ns, owner, priority, ttl = 60000) {
  const now = Date.now();
  const current = readWorkLock(ns);
  if (current && current.expires > now && current.priority >= priority && current.owner !== owner) {
    return false;
  }
  const lock = { owner, priority, expires: now + ttl, updated: now };
  try {
    ns.write(CONF.workLockFile, JSON.stringify(lock), "w");
    return true;
  } catch {
    return false;
  }
}

export function releaseWorkLock(ns, owner) {
  const current = readWorkLock(ns);
  if (!current || current.owner !== owner) return;
  try {
    ns.write(CONF.workLockFile, "", "w");
  } catch {
    // Ignore lock cleanup failures.
  }
}

export function readWorkLock(ns) {
  try {
    if (!ns.fileExists(CONF.workLockFile, "home")) return null;
    const raw = ns.read(CONF.workLockFile);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function purchasedServers(ns) {
  try {
    if (ns.cloud?.getServerNames) return ns.cloud.getServerNames();
  } catch {
    // Fall through for older APIs.
  }
  try {
    return ns.getPurchasedServers();
  } catch {
    return [];
  }
}

export function purchasedServerLimit(ns) {
  try {
    if (ns.cloud?.getServerLimit) return ns.cloud.getServerLimit();
  } catch {
    // Fall through for older APIs.
  }
  try {
    return ns.getPurchasedServerLimit();
  } catch {
    return 0;
  }
}

export function purchasedServerMaxRam(ns) {
  try {
    if (ns.cloud?.getRamLimit) return ns.cloud.getRamLimit();
  } catch {
    // Fall through for older APIs.
  }
  try {
    return ns.getPurchasedServerMaxRam();
  } catch {
    return 0;
  }
}

export function purchasedServerCost(ns, ram) {
  try {
    if (ns.cloud?.getServerCost) return ns.cloud.getServerCost(ram);
  } catch {
    // Fall through for older APIs.
  }
  try {
    return ns.getPurchasedServerCost(ram);
  } catch {
    return Infinity;
  }
}

export function purchaseServer(ns, hostname, ram) {
  try {
    if (ns.cloud?.purchaseServer) return ns.cloud.purchaseServer(hostname, ram);
  } catch {
    // Fall through for older APIs.
  }
  try {
    return ns.purchaseServer(hostname, ram);
  } catch {
    return "";
  }
}

export function deleteServer(ns, hostname) {
  try {
    if (ns.cloud?.deleteServer) return ns.cloud.deleteServer(hostname);
  } catch {
    // Fall through for older APIs.
  }
  try {
    return ns.deleteServer(hostname);
  } catch {
    return false;
  }
}

export function upgradeServer(ns, hostname, ram) {
  if (ns.cloud?.upgradeServer) return ns.cloud.upgradeServer(hostname, ram);
  return false;
}
