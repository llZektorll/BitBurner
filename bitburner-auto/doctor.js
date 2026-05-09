const REQUIRED = [
  "/auto/controller.js",
  "/auto/lib.js",
  "/auto/dashboard.js",
  "/auto/objectives.js",
  "/auto/bitnode.js",
  "/auto/endgame.js",
  "/auto/early.js",
  "/auto/worker.js",
  "/auto/hgw.js",
  "/auto/batcher.js",
  "/auto/manager.js",
  "/auto/root.js",
  "/auto/servers.js",
  "/auto/hacknet.js",
  "/auto/singularity.js",
  "/auto/backdoor.js",
  "/auto/share.js",
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
  "/auto/contracts.js",
];

const STATES = [
  "/auto/state-objectives.txt",
  "/auto/state-endgame.txt",
  "/auto/state-bitnode.txt",
  "/auto/state-worklock.txt",
  "/auto/state-darknet.txt",
  "/auto/state-stocks.txt",
];

const REMOVED_PATTERNS = ["n" + "Format", "format" + "Number"];

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  const fix = ns.args.includes("--fix");
  if (fix) await repair(ns);

  const report = audit(ns);
  render(ns, report);
  for (const line of report.summary) ns.tprint(line);
  if (!fix) ns.tprint("doctor: run with --fix to kill stale share/worker processes and restart controller if needed.");
}

function audit(ns) {
  const summary = [];
  const missing = REQUIRED.filter((file) => !ns.fileExists(file, "home"));
  const present = REQUIRED.length - missing.length;
  const ram = REQUIRED.filter((file) => ns.fileExists(file, "home")).map((file) => ({
    file,
    ram: safe(() => ns.getScriptRam(file, "home"), 0),
    running: ns.isRunning(file, "home"),
  }));
  const states = STATES.map((file) => stateStatus(ns, file));
  const removed = removedApiScan(ns);
  const stale = staleProcesses(ns);
  const capabilities = capabilityStatus(ns);
  const root = rootProgress(ns);
  const controller = ns.isRunning("/auto/controller.js", "home");

  summary.push(`doctor: files ${present}/${REQUIRED.length}, controller ${controller ? "running" : "stopped"}, root ${root.rooted}/${root.total}`);
  if (missing.length) summary.push(`doctor: missing ${missing.length} file(s), first: ${missing[0]}`);
  if (removed.length) summary.push(`doctor: removed API pattern(s) found: ${removed.length}`);
  if (stale.length) summary.push(`doctor: stale/stray automation processes: ${stale.length}`);
  if (!missing.length && !removed.length) summary.push("doctor: install looks coherent.");

  return { summary, missing, ram, states, removed, stale, capabilities, controller, root };
}

function stateStatus(ns, file) {
  if (!ns.fileExists(file, "home")) return { file, status: "missing" };
  const raw = ns.read(file);
  if (!raw) return { file, status: "empty" };
  try {
    JSON.parse(raw);
    return { file, status: "valid" };
  } catch {
    return { file, status: "invalid JSON" };
  }
}

function removedApiScan(ns) {
  const hits = [];
  for (const file of REQUIRED) {
    if (!ns.fileExists(file, "home")) continue;
    if (file === "/auto/doctor.js") continue;
    const text = ns.read(file);
    for (const pattern of REMOVED_PATTERNS) {
      if (text.includes(pattern)) hits.push({ file, pattern });
    }
  }
  return hits;
}

function staleProcesses(ns) {
  const stale = [];
  for (const host of scanAll(ns)) {
    for (const proc of ns.ps(host)) {
      if (!String(proc.filename).startsWith("/auto/") && !String(proc.filename).startsWith("auto/")) continue;
      if (proc.filename === "/auto/share.js" && !ns.isRunning("/auto/share-manager.js", "home")) {
        stale.push({ host, pid: proc.pid, file: proc.filename, reason: "share running without share-manager" });
      }
      if (proc.filename === "/auto/worker.js" && ns.isRunning("/auto/batcher.js", "home")) {
        stale.push({ host, pid: proc.pid, file: proc.filename, reason: "worker running while batcher is active" });
      }
    }
  }
  return stale;
}

async function repair(ns) {
  let killed = 0;
  for (const proc of staleProcesses(ns)) {
    if (ns.kill(proc.pid)) killed++;
  }

  const controller = "/auto/controller.js";
  if (ns.fileExists(controller, "home") && !ns.isRunning(controller, "home")) {
    const pid = ns.run(controller, 1);
    ns.tprint(pid ? `doctor --fix: restarted controller pid=${pid}.` : "doctor --fix: controller restart failed, probably RAM.");
  }
  ns.tprint(`doctor --fix: killed ${killed} stale process(es).`);
  await ns.sleep(250);
}

function capabilityStatus(ns) {
  return {
    formulas: ns.fileExists("Formulas.exe", "home"),
    darkscape: ns.fileExists("DarkscapeNavigator.exe", "home"),
    tor: ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"].filter((p) =>
      ns.fileExists(p, "home"),
    ).length,
    singularity: Boolean(ns.singularity),
    stock: Boolean(ns.stock),
    gang: Boolean(ns.gang),
    sleeve: Boolean(ns.sleeve),
    bladeburner: Boolean(ns.bladeburner),
    corporation: Boolean(ns.corporation),
    stanek: Boolean(ns.stanek),
    go: Boolean(ns.go),
    dnet: Boolean(ns.dnet),
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

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function render(ns, report) {
  ns.clearLog();
  ns.print("AUTO DOCTOR");
  for (const line of report.summary) ns.print(line);
  ns.print("");
  ns.print("capabilities:");
  for (const [key, value] of Object.entries(report.capabilities)) ns.print(`  ${key}: ${value}`);
  ns.print(`root: ${report.root.rooted}/${report.root.total}, ports ${report.root.ports}/5`);
  ns.print("");
  ns.print("state files:");
  for (const state of report.states) ns.print(`  ${state.file}: ${state.status}`);
  ns.print("");
  ns.print("largest scripts:");
  for (const item of report.ram.sort((a, b) => b.ram - a.ram).slice(0, 12)) {
    ns.print(`  ${item.file}: ${item.ram.toFixed(2)}GB ${item.running ? "running" : ""}`);
  }
  if (report.missing.length) {
    ns.print("");
    ns.print("missing:");
    for (const file of report.missing.slice(0, 20)) ns.print(`  ${file}`);
  }
  if (report.removed.length) {
    ns.print("");
    ns.print("removed API hits:");
    for (const hit of report.removed.slice(0, 20)) ns.print(`  ${hit.file}: ${hit.pattern}`);
  }
  if (report.stale.length) {
    ns.print("");
    ns.print("stale processes:");
    for (const proc of report.stale.slice(0, 20)) ns.print(`  ${proc.host} ${proc.pid} ${proc.file}: ${proc.reason}`);
  }
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

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Doctor");
    ns.ui?.resizeTail?.(720, 620);
  } catch {
    // Doctor also prints summary to terminal.
  }
}
