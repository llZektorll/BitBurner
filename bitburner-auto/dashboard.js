const FILES = {
  objectives: "/auto/state-objectives.txt",
  endgame: "/auto/state-endgame.txt",
  bitnode: "/auto/state-bitnode.txt",
  worklock: "/auto/state-worklock.txt",
  darknet: "/auto/state-darknet.txt",
};

const MODULES = [
  "/auto/early.js",
  "/auto/manager.js",
  "/auto/batcher.js",
  "/auto/servers.js",
  "/auto/hacknet.js",
  "/auto/singularity.js",
  "/auto/backdoor.js",
  "/auto/share-manager.js",
  "/auto/crime.js",
  "/auto/training.js",
  "/auto/stocks.js",
  "/auto/gang.js",
  "/auto/sleeves.js",
  "/auto/bladeburner.js",
  "/auto/corp.js",
  "/auto/stanek.js",
  "/auto/go.js",
  "/auto/darknet.js",
];

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  while (true) {
    render(ns, snapshot(ns));
    await ns.sleep(3000);
  }
}

function snapshot(ns) {
  const objectives = readJson(ns, FILES.objectives);
  const endgame = readJson(ns, FILES.endgame);
  const bitnode = readJson(ns, FILES.bitnode);
  const worklock = readJson(ns, FILES.worklock);
  const darknet = readJson(ns, FILES.darknet);
  const homeRam = ns.getServerMaxRam("home");
  const usedRam = ns.getServerUsedRam("home");
  const scripts = runningModules(ns);
  const root = rootProgress(ns);
  return {
    objectives,
    endgame,
    bitnode,
    worklock,
    darknet,
    player: ns.getPlayer(),
    cash: ns.getServerMoneyAvailable("home"),
    homeRam,
    usedRam,
    scripts,
    root,
  };
}

function render(ns, s) {
  ns.clearLog();
  ns.print("AUTO DASHBOARD");
  ns.print(`cash: ${money(ns, s.cash)}   hack: ${skill(s.player, "hacking")}   home RAM: ${fmt(ns, s.usedRam)}/${fmt(ns, s.homeRam)}GB`);
  ns.print(`root: ${s.root.rooted}/${s.root.total}   ports: ${s.root.ports}/5`);
  ns.print("");
  ns.print(`phase: ${s.objectives?.phase ?? "none"}`);
  ns.print(`priority: ${s.objectives?.priority ?? "none"}`);
  ns.print(`bitnode: ${s.bitnode?.bitNode ?? "?"} main=${s.bitnode?.strategy?.main ?? "unknown"}`);
  ns.print(`endgame: ${s.endgame?.mode ?? "none"} - ${s.endgame?.next ?? "none"}`);
  ns.print(`reset: ${s.endgame?.resetDecision?.action ?? "hold"} - ${s.endgame?.resetDecision?.reason ?? "none"}`);
  ns.print(`work lock: ${s.worklock?.owner ?? "none"}${s.worklock?.priority ? " p" + s.worklock.priority : ""}`);
  ns.print(`darknet: ${s.darknet?.status ?? "none"} connected=${s.darknet?.connected?.length ?? 0}`);
  ns.print("");
  ns.print(
    `budgets: servers ${pct(s.objectives?.budgets?.servers)} home ${pct(s.objectives?.budgets?.home)} hacknet ${pct(
      s.objectives?.budgets?.hacknet,
    )}`,
  );
  ns.print(
    `goals: batch ${yn(s.objectives?.goals?.batch)} share ${yn(s.objectives?.goals?.share)} install ${yn(
      s.objectives?.goals?.installAugs,
    )} train ${yn(s.objectives?.goals?.training)} crime ${yn(s.objectives?.goals?.crime)}`,
  );
  ns.print(
    `advanced: stocks ${yn(s.objectives?.goals?.stocks)} gang ${yn(s.objectives?.goals?.gang)} sleeves ${yn(
      s.objectives?.goals?.sleeves,
    )} blade ${yn(s.objectives?.goals?.bladeburner)} corp ${yn(s.objectives?.goals?.corp)}`,
  );
  ns.print("");
  ns.print(`augs: owned ${s.endgame?.ownedAugCount ?? "?"}, pending ${s.endgame?.pendingAugCount ?? s.objectives?.pendingAugs ?? "?"}`);
  ns.print(`target faction: ${s.endgame?.targetFaction ?? "none"}`);
  ns.print(`target aug: ${s.endgame?.targetAug?.name ?? "none"}`);
  ns.print("");
  ns.print("running modules:");
  for (const line of moduleLines(s.scripts)) ns.print(`  ${line}`);
}

function rootProgress(ns) {
  const hosts = scanAll(ns).filter((host) => host !== "home");
  return {
    total: hosts.length,
    rooted: hosts.filter((host) => ns.hasRootAccess(host)).length,
    ports: ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"].filter((p) =>
      ns.fileExists(p, "home"),
    ).length,
  };
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

function runningModules(ns) {
  const ps = ns.ps("home");
  const out = {};
  for (const script of MODULES) {
    const proc = ps.find((p) => p.filename === script);
    out[script] = proc ? { pid: proc.pid, threads: proc.threads } : null;
  }
  return out;
}

function moduleLines(scripts) {
  return MODULES.map((script) => {
    const proc = scripts[script];
    const name = script.replace("/auto/", "").replace(".js", "");
    return proc ? `${name}: on pid=${proc.pid}` : `${name}: off`;
  });
}

function readJson(ns, file) {
  try {
    if (!ns.fileExists(file, "home")) return null;
    const raw = ns.read(file);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function money(ns, value) {
  if (ns.format?.money) return ns.format.money(value, 2);
  if (ns.format?.number) return "$" + ns.format.number(value, 2);
  return "$" + Number(value).toLocaleString();
}

function fmt(ns, value) {
  if (ns.format?.number) return ns.format.number(value, 1);
  return Number(value).toFixed(1);
}

function pct(value) {
  return `${((value ?? 0) * 100).toFixed(0)}%`;
}

function yn(value) {
  return value ? "Y" : "n";
}

function skill(player, name) {
  return player.skills?.[name] ?? player[name] ?? 0;
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Dashboard");
    ns.ui?.resizeTail?.(760, 620);
  } catch {
    // Dashboard still works via manual tail.
  }
}
