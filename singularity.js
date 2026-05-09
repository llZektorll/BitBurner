import { CONF, acquireWorkLock, money, readEndgame, readObjectives, releaseWorkLock } from "./lib.js";

const CITY_FACTIONS = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];
const EARLY_FACTIONS = [
  "CyberSec",
  "Tian Di Hui",
  "Netburners",
  "NiteSec",
  "The Black Hand",
  "BitRunners",
];
const ENDGAME_FACTIONS = ["Daedalus", "The Covenant", "Illuminati", "Fulcrum Secret Technologies"];

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui?.openTail?.();

  if (!ns.singularity) {
    ns.tprint("singularity: unavailable. Unlock Source-File 4 to automate factions, programs, and aug installs.");
    return;
  }

  while (true) {
    const objectives = readObjectives(ns);
    const endgame = readEndgame(ns);
    upgradeHome(ns, objectives);
    if (objectives?.goals?.buyPrograms ?? true) buyUsefulPrograms(ns);
    joinInvites(ns, endgame);
    if (!endgame?.trainingGoal) workForUsefulFaction(ns, endgame);
    buyAffordableAugmentations(ns, endgame);
    installIfReady(ns, objectives, endgame);
    await ns.sleep(30000);
  }
}

function buyUsefulPrograms(ns) {
  try {
    ns.singularity.purchaseTor();
  } catch {
    // SF4 level and money gates decide whether this is possible.
  }
  for (const program of [
    "BruteSSH.exe",
    "FTPCrack.exe",
    "relaySMTP.exe",
    "HTTPWorm.exe",
    "SQLInject.exe",
    "ServerProfiler.exe",
    "DeepscanV1.exe",
    "DeepscanV2.exe",
    "AutoLink.exe",
    "Formulas.exe",
    "DarkscapeNavigator.exe",
  ]) {
    if (!ns.fileExists(program, "home")) {
      try {
        ns.singularity.purchaseProgram(program);
      } catch {
        // Some programs are gated by hack level or version.
      }
    }
  }
}

function upgradeHome(ns, objectives) {
  const ratio = objectives?.budgets?.home ?? CONF.homeUpgradeBudgetRatio;
  const budget = ns.getServerMoneyAvailable("home") * ratio;
  const ramCost = safeCost(() => ns.singularity.getUpgradeHomeRamCost());
  const coreCost = safeCost(() => ns.singularity.getUpgradeHomeCoresCost());

  if (ramCost > 0 && ramCost <= budget) {
    if (ns.singularity.upgradeHomeRam()) {
      ns.print(`Upgraded home RAM for ${money(ns, ramCost)}. New RAM: ${ns.getServerMaxRam("home")}GB.`);
      return;
    }
  }

  if (coreCost > 0 && coreCost <= budget) {
    if (ns.singularity.upgradeHomeCores()) {
      ns.print(`Upgraded home cores for ${money(ns, coreCost)}.`);
    }
  }
}

function safeCost(fn) {
  try {
    const cost = fn();
    return Number.isFinite(cost) ? cost : 0;
  } catch {
    return 0;
  }
}

function joinInvites(ns, endgame) {
  for (const faction of ns.singularity.checkFactionInvitations()) {
    if (
      faction === endgame?.targetFaction ||
      EARLY_FACTIONS.includes(faction) ||
      ENDGAME_FACTIONS.includes(faction) ||
      CITY_FACTIONS.includes(faction)
    ) {
      ns.singularity.joinFaction(faction);
      ns.print(`Joined ${faction}.`);
    }
  }
}

function workForUsefulFaction(ns, endgame) {
  if (!acquireWorkLock(ns, "faction", 60, 45000)) return;
  const joined = ns.getPlayer().factions ?? [];
  const ordered = [
    endgame?.targetFaction,
    "Daedalus",
    "BitRunners",
    "The Black Hand",
    "NiteSec",
    "CyberSec",
    ...EARLY_FACTIONS,
    ...joined,
  ].filter(Boolean);
  for (const faction of [...new Set(ordered)]) {
    if (!joined.includes(faction)) continue;
    const augs = ns.singularity
      .getAugmentationsFromFaction(faction)
      .filter((aug) => !ns.singularity.getOwnedAugmentations(true).includes(aug));
    if (augs.length === 0) continue;

    const started =
      ns.singularity.workForFaction(faction, "hacking", false) ||
      ns.singularity.workForFaction(faction, "field", false) ||
      ns.singularity.workForFaction(faction, "security", false);
    if (started) {
      ns.print(`Working for ${faction}.`);
      return;
    }
  }
  releaseWorkLock(ns, "faction");
}

function buyAffordableAugmentations(ns, endgame) {
  const owned = new Set(ns.singularity.getOwnedAugmentations(true));
  const player = ns.getPlayer();
  const candidates = [];

  for (const faction of player.factions ?? []) {
    for (const aug of ns.singularity.getAugmentationsFromFaction(faction)) {
      if (owned.has(aug)) continue;
      const repReq = ns.singularity.getAugmentationRepReq(aug);
      const price = ns.singularity.getAugmentationPrice(aug);
      if (ns.singularity.getFactionRep(faction) >= repReq && ns.getServerMoneyAvailable("home") >= price) {
        const priority = aug === endgame?.targetAug?.name ? 1000000 : augScore(ns, aug);
        candidates.push({ faction, aug, price, priority });
      }
    }
  }

  candidates.sort((a, b) => b.priority - a.priority || a.price - b.price);
  for (const item of candidates) {
    if (ns.singularity.purchaseAugmentation(item.faction, item.aug)) {
      ns.print(`Bought ${item.aug} from ${item.faction} for ${money(ns, item.price)}.`);
      owned.add(item.aug);
    }
  }

  const neuroFaction = (player.factions ?? []).find((faction) =>
    ns.singularity.getAugmentationsFromFaction(faction).includes("NeuroFlux Governor"),
  );
  if (neuroFaction) ns.singularity.purchaseAugmentation(neuroFaction, "NeuroFlux Governor");
}

function augScore(ns, aug) {
  if (aug === "The Red Pill") return 1000000;
  try {
    const stats = ns.singularity.getAugmentationStats(aug);
    return (
      100 * (stats.hacking ?? 0) +
      90 * (stats.hacking_exp ?? 0) +
      90 * (stats.hacking_money ?? 0) +
      80 * (stats.hacking_speed ?? 0) +
      80 * (stats.hacking_chance ?? 0) +
      70 * (stats.hacking_grow ?? 0) +
      75 * (stats.faction_rep ?? 0) +
      40 * (stats.company_rep ?? 0)
    );
  } catch {
    return 1;
  }
}

function installIfReady(ns, objectives, endgame) {
  const installed = new Set(ns.singularity.getOwnedAugmentations(false));
  const ownedWithQueued = ns.singularity.getOwnedAugmentations(true);
  const pending = ownedWithQueued.filter((aug) => !installed.has(aug));
  const meaningfulPending = pending.filter((aug) => aug !== "NeuroFlux Governor");

  const shouldInstall = objectives?.goals?.installAugs || endgame?.resetDecision?.action === "install";
  if (shouldInstall || meaningfulPending.length >= CONF.minPendingAugsToInstall) {
    const reason = endgame?.resetDecision?.reason ?? `${meaningfulPending.length} meaningful augmentations queued`;
    ns.tprint(`singularity: installing ${pending.length} pending augmentations (${reason}) and restarting controller.`);
    ns.singularity.installAugmentations("/auto/controller.js");
  }
}
