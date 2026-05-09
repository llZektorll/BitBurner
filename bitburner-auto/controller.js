const EARLY = "/auto/early.js";
const PRIORITY_DAEMONS = ["/auto/root.js", "/auto/servers.js", "/auto/go.js"];
const DAEMONS = [
  "/auto/dashboard.js",
  "/auto/objectives.js",
  "/auto/bitnode.js",
  "/auto/endgame.js",
  "/auto/root.js",
  "/auto/servers.js",
  "/auto/go.js",
  "/auto/batcher.js",
  "/auto/manager.js",
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
  "/auto/darknet.js",
];

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  ns.tprint("auto-controller: starting automation pack.");
  while (true) {
    const homeRam = ns.getServerMaxRam("home");
    const state = readState(ns);
    if (homeRam < 32) {
      startIfPossible(ns, "/auto/objectives.js");
      startIfPossible(ns, "/auto/root.js");
      startIfPossible(ns, EARLY);
      stopScripts(ns, DAEMONS.filter((script) => !["/auto/dashboard.js", "/auto/objectives.js", "/auto/root.js"].includes(script)));
      ns.print("bootstrap: home RAM under 32GB, running tiny early-game loop only.");
    } else {
      if (ns.isRunning(EARLY, "home")) ns.scriptKill(EARLY, "home");
      for (const script of orderedDaemons()) {
        if (shouldRun(ns, script, homeRam, state)) startIfPossible(ns, script);
        else stopScript(ns, script);
      }
    }

    ns.print(
      `status: hack=${ns.getHackingLevel()} cash=${money(ns, ns.getServerMoneyAvailable("home"))} homeRam=${homeRam}GB`,
    );
    await ns.sleep(20000);
  }
}

function orderedDaemons() {
  return [...PRIORITY_DAEMONS, ...DAEMONS.filter((script) => !PRIORITY_DAEMONS.includes(script))];
}

function shouldRun(ns, script, homeRam, state) {
  if (script === "/auto/dashboard.js") return true;
  if (script === "/auto/objectives.js") return true;
  if (script === "/auto/bitnode.js") return homeRam >= 32;
  if (script === "/auto/endgame.js") return homeRam >= 64;
  if (script === "/auto/root.js") return true;
  if (script === "/auto/batcher.js") return homeRam >= 32 && Boolean(state?.goals?.batch);
  if (script === "/auto/manager.js") return !Boolean(state?.goals?.batch);
  if (script === "/auto/contracts.js") return false;

  if (script === "/auto/servers.js") {
    const budget = state?.budgets?.servers ?? 0.2;
    return budget > 0 && homeRam >= 32;
  }

  if (script === "/auto/hacknet.js") {
    const budget = state?.budgets?.hacknet ?? 0;
    return budget > 0 && ns.getServerMoneyAvailable("home") >= 10000000;
  }

  if (script === "/auto/singularity.js") {
    return homeRam >= 128;
  }

  if (script === "/auto/backdoor.js") {
    return homeRam >= 128;
  }

  if (script === "/auto/share-manager.js") {
    return homeRam >= 128 && Boolean(state?.goals?.share || state?.pendingAugs > 0);
  }

  if (script === "/auto/crime.js") {
    return homeRam >= 128 && Boolean(state?.goals?.crime);
  }

  if (script === "/auto/training.js") {
    return homeRam >= 128 && Boolean(state?.goals?.training);
  }

  if (script === "/auto/stocks.js") return homeRam >= 128 && Boolean(state?.goals?.stocks);
  if (script === "/auto/gang.js") return homeRam >= 256 && Boolean(state?.goals?.gang);
  if (script === "/auto/sleeves.js") return homeRam >= 256 && Boolean(state?.goals?.sleeves);
  if (script === "/auto/bladeburner.js") return homeRam >= 256 && Boolean(state?.goals?.bladeburner);
  if (script === "/auto/corp.js") return homeRam >= 512 && Boolean(state?.goals?.corp);
  if (script === "/auto/stanek.js") return homeRam >= 256 && Boolean(state?.goals?.stanek);
  if (script === "/auto/go.js") return homeRam >= 256 && Boolean(ns.go);
  if (script === "/auto/darknet.js") return homeRam >= 256 && Boolean(state?.goals?.darknet);

  return true;
}

function startIfPossible(ns, script) {
  if (!ns.fileExists(script, "home")) {
    ns.print(`Missing ${script}; upload the full /auto pack.`);
    return;
  }
  if (!ns.isRunning(script, "home")) {
    const ram = ns.getScriptRam(script, "home");
    const free = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
    if (ram > free) {
      ns.print(`Waiting on RAM for ${script}: needs ${ram}GB, free ${free}GB.`);
      return;
    }
    const pid = ns.run(script, 1);
    ns.print(pid ? `Started ${script} pid=${pid}.` : `Could not start ${script}.`);
  }
}

function stopScripts(ns, scripts) {
  for (const script of scripts) stopScript(ns, script);
}

function stopScript(ns, script) {
  if (ns.isRunning(script, "home")) {
    ns.scriptKill(script, "home");
    ns.print(`Stopped ${script}; not useful in current phase.`);
  }
  if (script === "/auto/share-manager.js") cleanupScriptEverywhere(ns, "/auto/share.js");
}

function readState(ns) {
  try {
    if (!ns.fileExists("/auto/state-objectives.txt", "home")) return null;
    return JSON.parse(ns.read("/auto/state-objectives.txt"));
  } catch {
    return null;
  }
}

function cleanupScriptEverywhere(ns, script) {
  const seen = new Set(["home"]);
  const queue = ["home"];
  for (let i = 0; i < queue.length; i++) {
    const host = queue[i];
    for (const proc of ns.ps(host)) {
      if (proc.filename === script) ns.kill(proc.pid);
    }
    for (const next of ns.scan(host)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
}

function money(ns, value) {
  if (ns.format?.money) return ns.format.money(value, 2);
  if (ns.format?.number) return "$" + ns.format.number(value, 2);
  return "$" + Number(value).toLocaleString();
}
