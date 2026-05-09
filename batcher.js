import { CONF, bestTargets, deploy, money, rootedServers, scanAll, tryRoot } from "./lib.js";

const HGW = "/auto/hgw.js";
const FILES = [HGW];
const SPACING = 250;
const MIN_RAM = 512;

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui?.openTail?.();

  while (true) {
    for (const host of scanAll(ns)) tryRoot(ns, host);
    const state = readState(ns);
    const target = chooseBatchTarget(ns);
    if (!target || ns.getServerMaxRam("home") < MIN_RAM) {
      render(ns, "waiting", target, null, 0, state);
      await ns.sleep(10000);
      continue;
    }

    const prep = await prepTarget(ns, target);
    if (!prep.ready) {
      render(ns, prep.action, target, null, prep.threads, state);
      await ns.sleep(1000);
      continue;
    }

    const plan = batchPlan(ns, target);
    if (!plan) {
      render(ns, "no viable plan", target, null, 0, state);
      await ns.sleep(5000);
      continue;
    }

    const launched = await launchBatch(ns, target, plan);
    render(ns, launched ? "batch launched" : "not enough RAM", target, plan, launched ? plan.totalThreads : 0, state);
    await ns.sleep(Math.max(SPACING * 4, plan.cycle));
  }
}

function chooseBatchTarget(ns) {
  return bestTargets(ns, 20)
    .filter((host) => ns.getServerMaxMoney(host) > 1000000)
    .sort((a, b) => batchScore(ns, b).score - batchScore(ns, a).score)[0] ?? bestTargets(ns, 1)[0];
}

function batchScore(ns, host) {
  if (hasFormulas(ns)) return formulasScore(ns, host);
  const maxMoney = ns.getServerMaxMoney(host);
  const chance = ns.hackAnalyzeChance(host);
  const time = Math.max(1, ns.getWeakenTime(host));
  return { score: (maxMoney * chance) / time, chance, time };
}

function formulasScore(ns, host) {
  const server = minSecMaxMoneyServer(ns, host);
  const player = ns.getPlayer();
  const chance = ns.formulas.hacking.hackChance(server, player);
  const time = Math.max(1, ns.formulas.hacking.weakenTime(server, player));
  const percent = ns.formulas.hacking.hackPercent(server, player);
  const maxMoney = server.moneyMax ?? 0;
  if (chance < CONF.minHackChance || percent <= 0) return { score: 0, chance, time };
  return { score: (maxMoney * chance * percent) / time, chance, time };
}

function minSecMaxMoneyServer(ns, host) {
  const server = ns.getServer(host);
  server.hackDifficulty = server.minDifficulty;
  server.moneyAvailable = server.moneyMax;
  return server;
}

async function prepTarget(ns, target) {
  const minSec = ns.getServerMinSecurityLevel(target);
  const sec = ns.getServerSecurityLevel(target);
  const maxMoney = ns.getServerMaxMoney(target);
  const cash = ns.getServerMoneyAvailable(target);

  if (sec > minSec + 2) {
    const threads = Math.ceil((sec - minSec) / ns.weakenAnalyze(1));
    await launchSimple(ns, "weaken", target, threads);
    return { ready: false, action: "prepping weaken", threads };
  }

  if (maxMoney > 0 && cash < maxMoney * 0.95) {
    const factor = Math.max(1.01, maxMoney / Math.max(1, cash));
    const threads = Math.ceil(ns.growthAnalyze(target, factor));
    await launchSimple(ns, "grow", target, threads);
    return { ready: false, action: "prepping grow", threads };
  }

  return { ready: true, action: "ready", threads: 0 };
}

function batchPlan(ns, target) {
  const maxMoney = ns.getServerMaxMoney(target);
  const available = totalAvailableThreads(ns);
  const hackPercent = chooseHackFraction(ns, target, available);
  const hackPerThread = Math.max(0.000001, hackPercentPerThread(ns, target));
  const hackThreads = Math.max(1, Math.floor(hackPercent / hackPerThread));
  const actualHackFraction = Math.min(0.9, hackThreads * hackPerThread);
  const growFactor = 1 / Math.max(0.01, 1 - actualHackFraction);
  const growThreads = Math.max(1, Math.ceil(ns.growthAnalyze(target, growFactor)));
  const hackWeaken = Math.ceil((ns.hackAnalyzeSecurity(hackThreads, target) + 0.001) / ns.weakenAnalyze(1));
  const growWeaken = Math.ceil((ns.growthAnalyzeSecurity(growThreads, target) + 0.001) / ns.weakenAnalyze(1));
  const weakenTime = ns.getWeakenTime(target);
  const growTime = ns.getGrowTime(target);
  const hackTime = ns.getHackTime(target);

  return {
    maxMoney,
    hackThreads,
    growThreads,
    hackWeaken,
    growWeaken,
    totalThreads: hackThreads + growThreads + hackWeaken + growWeaken,
    cycle: weakenTime + SPACING * 4,
    actions: [
      { mode: "hack", threads: hackThreads, delay: Math.max(0, weakenTime - hackTime - SPACING * 3) },
      { mode: "weaken", threads: hackWeaken, delay: 0 },
      { mode: "grow", threads: growThreads, delay: Math.max(0, weakenTime - growTime - SPACING) },
      { mode: "weaken", threads: growWeaken, delay: SPACING * 2 },
    ],
  };
}

function chooseHackFraction(ns, target, availableThreads) {
  const candidates = [0.03, 0.05, 0.08, 0.1, 0.15, 0.2, 0.25, 0.3];
  let best = { fraction: Math.max(0.02, CONF.hackMoneyRatio), score: 0 };
  for (const fraction of candidates) {
    const plan = estimatePlan(ns, target, fraction);
    if (!plan || plan.totalThreads > availableThreads) continue;
    const score = plan.expectedMoney / Math.max(1, plan.cycle) / Math.max(1, plan.totalThreads);
    if (score > best.score) best = { fraction, score };
  }
  return best.fraction;
}

function estimatePlan(ns, target, fraction) {
  const hackPerThread = Math.max(0.000001, hackPercentPerThread(ns, target));
  const hackThreads = Math.max(1, Math.floor(fraction / hackPerThread));
  const actualHackFraction = Math.min(0.9, hackThreads * hackPerThread);
  const growFactor = 1 / Math.max(0.01, 1 - actualHackFraction);
  const growThreads = Math.max(1, Math.ceil(growThreadsFor(ns, target, growFactor)));
  const hackWeaken = Math.ceil((ns.hackAnalyzeSecurity(hackThreads, target) + 0.001) / ns.weakenAnalyze(1));
  const growWeaken = Math.ceil((ns.growthAnalyzeSecurity(growThreads, target) + 0.001) / ns.weakenAnalyze(1));
  const cycle = weakenTime(ns, target) + SPACING * 4;
  return {
    totalThreads: hackThreads + growThreads + hackWeaken + growWeaken,
    expectedMoney: ns.getServerMaxMoney(target) * actualHackFraction * hackChance(ns, target),
    cycle,
  };
}

function hackPercentPerThread(ns, target) {
  if (!hasFormulas(ns)) return ns.hackAnalyze(target);
  return ns.formulas.hacking.hackPercent(minSecMaxMoneyServer(ns, target), ns.getPlayer());
}

function hackChance(ns, target) {
  if (!hasFormulas(ns)) return ns.hackAnalyzeChance(target);
  return ns.formulas.hacking.hackChance(minSecMaxMoneyServer(ns, target), ns.getPlayer());
}

function growThreadsFor(ns, target, growFactor) {
  if (!hasFormulas(ns)) return ns.growthAnalyze(target, growFactor);
  const server = minSecMaxMoneyServer(ns, target);
  server.moneyAvailable = Math.max(1, (server.moneyMax ?? ns.getServerMaxMoney(target)) / growFactor);
  return ns.formulas.hacking.growThreads(server, ns.getPlayer(), server.moneyMax ?? ns.getServerMaxMoney(target), 1);
}

function weakenTime(ns, target) {
  if (!hasFormulas(ns)) return ns.getWeakenTime(target);
  return ns.formulas.hacking.weakenTime(minSecMaxMoneyServer(ns, target), ns.getPlayer());
}

function totalAvailableThreads(ns) {
  const ram = ns.getScriptRam(HGW, "home");
  return workerHosts(ns).reduce((sum, host) => sum + Math.floor(freeRam(ns, host) / ram), 0);
}

function hasFormulas(ns) {
  return ns.fileExists("Formulas.exe", "home") && Boolean(ns.formulas?.hacking);
}

async function launchBatch(ns, target, plan) {
  const hosts = workerHosts(ns);
  for (const host of hosts) await deploy(ns, FILES, host);
  if (availableThreads(ns, hosts) < plan.totalThreads) return false;
  for (const action of plan.actions) {
    if (!(await launchAcross(ns, hosts, action.mode, target, action.threads, action.delay))) return false;
  }
  return true;
}

async function launchSimple(ns, mode, target, threads) {
  const hosts = workerHosts(ns);
  for (const host of hosts) await deploy(ns, FILES, host);
  await launchAcross(ns, hosts, mode, target, threads, 0);
}

async function launchAcross(ns, hosts, mode, target, threads, delay) {
  let remaining = threads;
  const ram = ns.getScriptRam(HGW, "home");
  for (const host of hosts) {
    const free = freeRam(ns, host);
    const count = Math.min(remaining, Math.floor(free / ram));
    if (count <= 0) continue;
    const pid = ns.exec(HGW, host, count, mode, target, delay);
    if (pid !== 0) remaining -= count;
    if (remaining <= 0) return true;
  }
  return false;
}

function workerHosts(ns) {
  return rootedServers(ns)
    .filter((host) => host !== "home" || ns.getServerMaxRam("home") >= MIN_RAM)
    .sort((a, b) => ns.getServerMaxRam(b) - ns.getServerMaxRam(a));
}

function availableThreads(ns, hosts) {
  const ram = ns.getScriptRam(HGW, "home");
  return hosts.reduce((sum, host) => sum + Math.floor(freeRam(ns, host) / ram), 0);
}

function freeRam(ns, host) {
  const reserve = host === "home" ? Math.max(32, CONF.reserveHomeRam) : 0;
  return Math.max(0, ns.getServerMaxRam(host) - ns.getServerUsedRam(host) - reserve);
}

function readState(ns) {
  try {
    if (!ns.fileExists("/auto/state-objectives.txt", "home")) return null;
    return JSON.parse(ns.read("/auto/state-objectives.txt"));
  } catch {
    return null;
  }
}

function render(ns, action, target, plan, threads, state) {
  ns.clearLog();
  ns.print("AUTO BATCHER");
  ns.print(`phase: ${state?.phase ?? "none"}`);
  ns.print(`action: ${action}`);
  ns.print(`target: ${target ?? "none"}`);
  ns.print(`threads: ${threads}`);
  if (target) {
    ns.print(`money: ${money(ns, ns.getServerMoneyAvailable(target))} / ${money(ns, ns.getServerMaxMoney(target))}`);
    ns.print(`security: ${ns.getServerSecurityLevel(target).toFixed(2)} / ${ns.getServerMinSecurityLevel(target).toFixed(2)}`);
  }
  if (plan) {
    ns.print(`hack/grow/weaken: ${plan.hackThreads}/${plan.growThreads}/${plan.hackWeaken + plan.growWeaken}`);
    ns.print(`expected cycle: ${(plan.cycle / 1000).toFixed(1)}s`);
  }
}
