import { CONFIG } from "./config.js";

const STATE_FILE = "/auto/state-objectives.txt";
const ENDGAME_FILE = "/auto/state-endgame.txt";
const BITNODE_FILE = "/auto/state-bitnode.txt";
const WORKLOCK_FILE = "/auto/state-worklock.txt";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  while (true) {
    const state = buildState(ns);
    await ns.write(STATE_FILE, JSON.stringify(state), "w");
    render(ns, state);
    await ns.sleep(10000);
  }
}

function buildState(ns) {
  const cash = ns.getServerMoneyAvailable("home");
  const homeRam = ns.getServerMaxRam("home");
  const hack = ns.getHackingLevel();
  const ports = portsAvailable(ns);
  const portPrograms = missingPortPrograms(ns);
  const rooted = countRooted(ns);
  const pendingAugs = pendingAugmentations(ns);
  const hasFormulas = ns.fileExists("Formulas.exe", "home");
  const hasDarknet = ns.fileExists("DarkscapeNavigator.exe", "home");
  const combat = minCombatSkill(ns);
  const endgame = readEndgame(ns);
  const bitnode = readBitnode(ns);
  const strategy = bitnode?.strategy;
  const workLock = readWorkLock(ns);

  let phase = "bootstrap";
  let priority = "Build first cash and hacking XP";
  let serverSpend = 0.1;
  let hacknetSpend = 0;
  let homeSpend = 0.65;
  let shouldBuyPrograms = false;
  let shouldInstallAugs = false;
  let shouldShare = false;
  let shouldCrime = false;
  let shouldStocks = false;
  let shouldGang = false;
  let shouldSleeves = false;
  let shouldBladeburner = false;
  let shouldCorp = false;
  let shouldStanek = false;
  let shouldGo = false;
  let shouldDarknet = false;
  let shouldBatch = false;

  if (homeRam < 32) {
    phase = "bootstrap";
    priority = "Speedrun: rush 32GB home RAM and starter hacking income";
    serverSpend = 0;
    hacknetSpend = 0;
    homeSpend = CONFIG.budgets.bootstrapHome;
    shouldCrime = false;
  } else if (ports < 5 && cash >= 200000) {
    phase = "programs";
    priority = `Speedrun: buy port programs and unlock better targets (${ports}/5 owned)`;
    shouldBuyPrograms = true;
    serverSpend = CONFIG.budgets.programsServers;
    hacknetSpend = 0;
    homeSpend = CONFIG.budgets.programsHome;
    shouldBatch = true;
  } else if (homeRam < 128) {
    phase = "home-ram";
    priority = "Speedrun: batch hacking while rushing home RAM and server fleet";
    serverSpend = CONFIG.budgets.earlyServers;
    hacknetSpend = 0;
    homeSpend = CONFIG.budgets.earlyHome;
    shouldCrime = false;
    shouldBatch = true;
  } else if (pendingAugs >= 5) {
    phase = "install";
    priority = `Install ${pendingAugs} queued augmentations`;
    shouldInstallAugs = true;
    shouldShare = true;
    serverSpend = 0.05;
    hacknetSpend = 0;
    homeSpend = 0;
  } else if (!hasFormulas && cash >= 1000000000) {
    phase = "formulas";
    priority = "Speedrun: buy Formulas.exe for stronger batch target decisions";
    shouldBuyPrograms = true;
    serverSpend = 0.25;
    hacknetSpend = 0;
    homeSpend = 0.25;
  } else if (!hasDarknet && cash >= 1000000000) {
    phase = "darknet";
    priority = "Buy DarkscapeNavigator.exe when available";
    shouldBuyPrograms = true;
    shouldDarknet = true;
    serverSpend = 0.25;
    hacknetSpend = 0.01;
    homeSpend = 0.35;
  } else if (cash < 1000000000) {
    phase = "fleet";
    priority = "Speedrun: expand fleet aggressively and keep batch RAM saturated";
    serverSpend = CONFIG.budgets.fleetServers;
    hacknetSpend = 0;
    homeSpend = CONFIG.budgets.fleetHome;
    shouldCrime = false;
    shouldBatch = true;
  } else {
    phase = "scale";
    priority = "Speedrun: scale hacking income before side systems";
    shouldBuyPrograms = true;
    shouldShare = pendingAugs > 0;
    shouldCrime = combat < 100;
    shouldStocks = cash > CONFIG.thresholds.stocksCash;
    shouldGang = cash > CONFIG.thresholds.sideSystemCash;
    shouldSleeves = cash > CONFIG.thresholds.sideSystemCash;
    shouldBladeburner = cash > CONFIG.thresholds.sideSystemCash;
    shouldCorp = cash > CONFIG.thresholds.corpCash;
    shouldStanek = cash > 5000000000;
    shouldGo = cash > CONFIG.thresholds.goCash;
    shouldDarknet = hasDarknet;
    shouldBatch = true;
    serverSpend = CONFIG.budgets.scaleServers;
    hacknetSpend = CONFIG.budgets.hacknetDefault;
    homeSpend = CONFIG.budgets.scaleHome;
  }

  if (endgame) {
    if (endgame.mode === "faction-unlocks") {
      phase = "faction-unlocks";
      priority = endgame.next;
      shouldBuyPrograms = true;
      serverSpend = 0.35;
      homeSpend = 0.35;
      hacknetSpend = 0;
    } else if (endgame.mode === "faction-rep" || endgame.mode === "red-pill") {
      phase = endgame.mode;
      priority = endgame.next;
      shouldShare = true;
      shouldBuyPrograms = true;
      serverSpend = 0.2;
      homeSpend = 0.2;
      hacknetSpend = 0;
    } else if (endgame.mode === "money") {
      phase = "endgame-money";
      priority = endgame.next;
      serverSpend = 0.55;
      homeSpend = 0.25;
      hacknetSpend = cash >= 1000000000 ? 0.02 : 0;
      shouldStocks = cash > 1000000000;
      shouldCorp = cash > 200000000000;
      shouldBatch = true;
    } else if (endgame.mode === "world-daemon") {
      phase = "world-daemon";
      priority = endgame.next;
      shouldShare = false;
      serverSpend = 0.1;
      homeSpend = 0.5;
      hacknetSpend = 0;
      shouldStocks = cash > 1000000000;
      shouldBatch = true;
    }
    if (endgame.trainingGoal) {
      priority = `${priority}; ${endgame.trainingGoal.reason}`;
    }
  }

  if (ports < 5 && cash >= 200000) {
    shouldBuyPrograms = true;
    hacknetSpend = 0;
    serverSpend = Math.min(serverSpend, 0.1);
  }

  if (strategy) {
    serverSpend *= strategy.serverBudgetBoost ?? 1;
    homeSpend *= strategy.homeBudgetBoost ?? 1;
    hacknetSpend *= strategy.hacknetBudgetBoost ?? 1;
    shouldBatch = shouldBatch && strategy.preferBatching !== false;
    shouldGang = shouldGang || Boolean(strategy.preferGangs);
    shouldSleeves = shouldSleeves || Boolean(strategy.preferSleeves);
    shouldBladeburner = shouldBladeburner || Boolean(strategy.preferBladeburner);
    shouldCorp = shouldCorp || (Boolean(strategy.preferCorp) && cash > 50000000000);
    shouldStocks = shouldStocks || (Boolean(strategy.preferStocks) && cash > 250000000);
    shouldStanek = shouldStanek || Boolean(strategy.preferStanek);
    shouldGo = shouldGo || Boolean(strategy.preferGo);
    if (strategy.preferHacknet && cash >= CONFIG.thresholds.hacknetMinCash) {
      hacknetSpend = Math.max(hacknetSpend, CONFIG.budgets.hacknetPreferred);
    }
  }

  const totalSpend = serverSpend + homeSpend + hacknetSpend;
  if (totalSpend > 0.95) {
    const scale = 0.95 / totalSpend;
    serverSpend *= scale;
    homeSpend *= scale;
    hacknetSpend *= scale;
  }

  return {
    time: Date.now(),
    phase,
    priority,
    cash,
    homeRam,
    hack,
    ports,
    rooted,
    pendingAugs,
    combat,
    missingPrograms: portPrograms,
    hasFormulas,
    hasDarknet,
    endgameMode: endgame?.mode ?? null,
    endgameNext: endgame?.next ?? null,
    bitNode: bitnode?.bitNode ?? null,
    bitNodeMain: strategy?.main ?? null,
    resetDecision: endgame?.resetDecision ?? null,
    workLock,
    budgets: {
      servers: serverSpend,
      hacknet: hacknetSpend,
      home: homeSpend,
    },
    goals: {
      buyPrograms: shouldBuyPrograms,
      installAugs: shouldInstallAugs || endgame?.resetDecision?.action === "install",
      share: shouldShare || pendingAugs > 0,
      crime: shouldCrime,
      training: Boolean(endgame?.trainingGoal),
      stocks: shouldStocks,
      gang: shouldGang,
      sleeves: shouldSleeves,
      bladeburner: shouldBladeburner,
      corp: shouldCorp,
      stanek: shouldStanek,
      go: shouldGo,
      darknet: shouldDarknet,
      batch: shouldBatch,
    },
  };
}

function render(ns, state) {
  ns.clearLog();
  ns.print("AUTO OBJECTIVES");
  ns.print(`phase: ${state.phase}`);
  ns.print(`priority: ${state.priority}`);
  ns.print(`cash: ${money(ns, state.cash)}`);
  ns.print(`hack/home: ${state.hack} / ${state.homeRam}GB`);
  ns.print(`ports: ${state.ports}/5`);
  ns.print(`rooted servers: ${state.rooted}`);
  ns.print(`queued augmentations: ${state.pendingAugs}`);
  ns.print(`min combat: ${state.combat}`);
  if (state.endgameMode) ns.print(`endgame: ${state.endgameMode} - ${state.endgameNext}`);
  if (state.bitNode) ns.print(`bitnode: ${state.bitNode} main=${state.bitNodeMain}`);
  if (state.resetDecision) ns.print(`reset: ${state.resetDecision.action} - ${state.resetDecision.reason}`);
  if (state.workLock?.owner) ns.print(`work lock: ${state.workLock.owner} p${state.workLock.priority}`);
  ns.print(`missing port programs: ${state.missingPrograms.join(", ") || "none"}`);
  ns.print(
    `budgets: servers ${(state.budgets.servers * 100).toFixed(0)}%, home ${(state.budgets.home * 100).toFixed(
      0,
    )}%, hacknet ${(state.budgets.hacknet * 100).toFixed(0)}%`,
  );
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Objectives");
    ns.ui?.resizeTail?.(560, 360);
  } catch {
    // Objective tracking still works without the tail API.
  }
}

function portsAvailable(ns) {
  return portPrograms().filter((program) => ns.fileExists(program, "home")).length;
}

function missingPortPrograms(ns) {
  return portPrograms().filter((program) => !ns.fileExists(program, "home"));
}

function portPrograms() {
  return ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"];
}

function countRooted(ns) {
  const seen = new Set(["home"]);
  const queue = ["home"];
  let rooted = 0;
  for (let i = 0; i < queue.length; i++) {
    for (const next of ns.scan(queue[i])) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
      if (ns.hasRootAccess(next)) rooted++;
    }
  }
  return rooted;
}

function pendingAugmentations(ns) {
  if (!ns.singularity) return 0;
  try {
    const installed = new Set(ns.singularity.getOwnedAugmentations(false));
    return ns.singularity.getOwnedAugmentations(true).filter((aug) => !installed.has(aug)).length;
  } catch {
    return 0;
  }
}

function readEndgame(ns) {
  try {
    if (!ns.fileExists(ENDGAME_FILE, "home")) return null;
    return JSON.parse(ns.read(ENDGAME_FILE));
  } catch {
    return null;
  }
}

function readBitnode(ns) {
  try {
    if (!ns.fileExists(BITNODE_FILE, "home")) return null;
    return JSON.parse(ns.read(BITNODE_FILE));
  } catch {
    return null;
  }
}

function readWorkLock(ns) {
  try {
    if (!ns.fileExists(WORKLOCK_FILE, "home")) return null;
    const raw = ns.read(WORKLOCK_FILE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function minCombatSkill(ns) {
  try {
    const skills = ns.getPlayer().skills;
    return Math.min(skills.strength, skills.defense, skills.dexterity, skills.agility);
  } catch {
    return 0;
  }
}

function money(ns, value) {
  if (ns.format?.money) return ns.format.money(value, 2);
  if (ns.format?.number) return "$" + ns.format.number(value, 2);
  return "$" + Number(value).toLocaleString();
}
