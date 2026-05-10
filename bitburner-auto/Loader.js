import { CONFIG, scriptFile } from "./config.js";

const STATE_FILE = "/auto/state-objectives.txt";
const SPECIAL_ORDER = ["go", "objectives", "root", "servers", "batcher", "singularity", "dashboard"];

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);
  ns.tprint("Loader: starting BitBurner automation pack.");
  let lastShareDesired = null;

  while (true) {
    const state = readState(ns);
    const decisions = decideScripts(ns, state);
    lastShareDesired = applyDecisions(ns, decisions, lastShareDesired);
    render(ns, decisions, state);
    await ns.sleep(CONFIG.refreshMs);
  }
}

function decideScripts(ns, state) {
  const homeRam = ns.getServerMaxRam("home");
  const ordered = orderedScriptEntries();
  const decisions = [];

  for (const [name, spec] of ordered) {
    const reason = shouldRunScript(ns, name, spec, state, homeRam);
    decisions.push({
      name,
      file: spec.file,
      enabled: spec.enabled,
      shouldRun: reason.ok,
      reason: reason.reason,
      running: ns.isRunning(spec.file, "home"),
      ram: safe(() => ns.getScriptRam(spec.file, "home"), 0),
    });
  }

  return decisions;
}

function orderedScriptEntries() {
  const entries = Object.entries(CONFIG.scripts);
  const order = new Map(SPECIAL_ORDER.map((name, index) => [name, index]));
  return entries.sort(([a], [b]) => (order.get(a) ?? 100) - (order.get(b) ?? 100) || a.localeCompare(b));
}

function shouldRunScript(ns, name, spec, state, homeRam) {
  if (!spec.enabled) return { ok: false, reason: "disabled in config" };
  if (!ns.fileExists(spec.file, "home")) return { ok: false, reason: "missing file" };
  if (homeRam < (spec.minHomeRam ?? 0)) return { ok: false, reason: `needs ${spec.minHomeRam}GB home` };
  if (!capabilityAvailable(ns, spec.requires)) return { ok: false, reason: `locked API: ${spec.requires}` };

  if (name === "go") return shouldRunGo(ns, state);
  if (name === "early") return { ok: homeRam < CONFIG.thresholds.batchHomeRam, reason: homeRam < CONFIG.thresholds.batchHomeRam ? "bootstrap" : "batcher active" };
  if (name === "manager") return { ok: !Boolean(state?.goals?.batch), reason: state?.goals?.batch ? "batcher preferred" : "fallback manager" };
  if (name === "batcher") return { ok: Boolean(state?.goals?.batch), reason: state?.goals?.batch ? "money engine" : "goal disabled" };
  if (name === "servers") return { ok: (state?.budgets?.servers ?? 0) > 0, reason: `server budget ${pct(state?.budgets?.servers)}` };
  if (name === "hacknet") {
    const budget = state?.budgets?.hacknet ?? 0;
    const cash = ns.getServerMoneyAvailable("home");
    return { ok: budget > 0 && cash >= CONFIG.thresholds.hacknetMinCash, reason: `hacknet budget ${pct(budget)}` };
  }
  if (name === "share") return { ok: Boolean(state?.goals?.share || state?.pendingAugs > 0), reason: "rep/aug phase" };
  if (name === "crime") return { ok: Boolean(state?.goals?.crime), reason: "crime goal" };
  if (name === "training") return { ok: Boolean(state?.goals?.training), reason: "training goal" };
  if (name === "stocks") return { ok: Boolean(state?.goals?.stocks), reason: "stocks goal" };
  if (name === "gang") return { ok: Boolean(state?.goals?.gang), reason: "gang goal" };
  if (name === "sleeves") return { ok: Boolean(state?.goals?.sleeves), reason: "sleeves goal" };
  if (name === "bladeburner") return { ok: Boolean(state?.goals?.bladeburner), reason: "bladeburner goal" };
  if (name === "corp") return { ok: Boolean(state?.goals?.corp), reason: "corp goal" };
  if (name === "stanek") return { ok: Boolean(state?.goals?.stanek), reason: "stanek goal" };
  if (name === "darknet") return { ok: Boolean(state?.goals?.darknet), reason: "darknet goal" };

  return { ok: true, reason: "configured" };
}

function shouldRunGo(ns, state) {
  if (!ns.go) return { ok: false, reason: "IPvGO locked" };
  if (!CONFIG.scripts.go.enabled) return { ok: false, reason: "disabled in config" };
  const cash = ns.getServerMoneyAvailable("home");
  const ok = Boolean(state?.goals?.go) && cash >= CONFIG.thresholds.goCash;
  return { ok, reason: ok ? "go goal and cash ready" : "speedrun: money engine first" };
}

function capabilityAvailable(ns, name) {
  if (!name) return true;
  return Boolean(ns[name]);
}

function applyDecisions(ns, decisions, lastShareDesired) {
  for (const decision of decisions) {
    if (decision.shouldRun) startIfPossible(ns, decision.file);
    else stopScript(ns, decision.file);
    decision.running = ns.isRunning(decision.file, "home");
  }
  const shareDesired = decisions.some((d) => d.name === "share" && d.shouldRun);
  if (lastShareDesired !== false && !shareDesired) cleanupScriptEverywhere(ns, "/auto/share.js");
  return shareDesired;
}

function startIfPossible(ns, script) {
  if (!ns.fileExists(script, "home") || ns.isRunning(script, "home")) return;
  const ram = ns.getScriptRam(script, "home");
  const free = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
  if (ram > free) return;
  ns.run(script, 1);
}

function stopScript(ns, script) {
  if (ns.isRunning(script, "home")) ns.scriptKill(script, "home");
}

function cleanupScriptEverywhere(ns, script) {
  for (const host of scanAll(ns)) {
    for (const proc of ns.ps(host)) {
      if (proc.filename === script) ns.kill(proc.pid);
    }
  }
}

function render(ns, decisions, state) {
  ns.clearLog();
  const running = decisions.filter((d) => d.running).length;
  const desired = decisions.filter((d) => d.shouldRun).length;
  const homeRam = ns.getServerMaxRam("home");
  const usedRam = ns.getServerUsedRam("home");

  ns.print("AUTO LOADER");
  ns.print(`mode: ${CONFIG.mode}`);
  ns.print(`cash: ${money(ns, ns.getServerMoneyAvailable("home"))} hack: ${ns.getHackingLevel()} home: ${fmt(ns, usedRam)}/${fmt(ns, homeRam)}GB`);
  ns.print(`phase: ${state?.phase ?? "unknown"} | priority: ${state?.priority ?? "waiting for objectives"}`);
  ns.print(`running/desired/configured: ${running}/${desired}/${decisions.length}`);
  ns.print(`budgets: servers ${pct(state?.budgets?.servers)} home ${pct(state?.budgets?.home)} hacknet ${pct(state?.budgets?.hacknet)}`);
  ns.print("");
  ns.print("scripts:");
  for (const d of decisions) {
    const status = d.running ? "RUN" : d.shouldRun ? "WAIT" : "OFF";
    ns.print(`${status.padEnd(4)} ${d.name.padEnd(12)} ${d.file.padEnd(24)} ${d.reason}`);
  }
  ns.print("");
  ns.print(`config: edit /auto/config.js | legacy controller calls Loader | go checked first: ${scriptFile("go")}`);
}

function readState(ns) {
  try {
    if (!ns.fileExists(STATE_FILE, "home")) return null;
    const raw = ns.read(STATE_FILE);
    return raw ? JSON.parse(raw) : null;
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

function openWindow(ns) {
  if (!CONFIG.loaderTail.enabled) return;
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Loader");
    ns.ui?.resizeTail?.(CONFIG.loaderTail.width, CONFIG.loaderTail.height);
  } catch {
    // Loader still works without the tail API.
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

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
