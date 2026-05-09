const STATE_FILE = "/auto/state-endgame.txt";

const FACTION_SERVERS = [
  ["CyberSec", "CSEC"],
  ["NiteSec", "avmnite-02"],
  ["The Black Hand", "I.I.I.I"],
  ["BitRunners", "run4theh111z"],
  ["Fulcrum Secret Technologies", "fulcrumassets"],
];

const ENDGAME_FACTIONS = ["Daedalus", "The Covenant", "Illuminati", "BitRunners", "Fulcrum Secret Technologies"];

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  while (true) {
    const state = buildState(ns);
    await ns.write(STATE_FILE, JSON.stringify(state), "w");
    render(ns, state);
    await ns.sleep(15000);
  }
}

function buildState(ns) {
  const player = ns.getPlayer();
  const factions = player.factions ?? [];
  const ownedAugs = safeOwnedAugs(ns);
  const installedAugs = safeInstalledAugs(ns);
  const pendingAugs = ownedAugs.filter((aug) => !installedAugs.includes(aug));
  const hack = ns.getHackingLevel();
  const cash = ns.getServerMoneyAvailable("home");
  const worldDaemon = serverStatus(ns, "w0r1d_d43m0n");
  const redPill = ownedAugs.includes("The Red Pill");
  const daedalus = factions.includes("Daedalus");
  const factionProgress = factionServerProgress(ns, factions);
  const joinedEndgame = ENDGAME_FACTIONS.filter((faction) => factions.includes(faction));
  const targetFaction = chooseTargetFaction(ns, factions);
  const targetAug = targetFaction ? chooseBestAug(ns, targetFaction, ownedAugs) : null;
  const trainingGoal = chooseTrainingGoal(ns, hack, worldDaemon, joinedEndgame);
  const resetDecision = chooseResetDecision(ns, pendingAugs, targetAug, redPill);
  const blockers = [];

  for (const item of factionProgress) {
    if (!item.joined) {
      if (!item.rooted) blockers.push(`root ${item.server} for ${item.faction}`);
      else if (!item.backdoored) blockers.push(`backdoor ${item.server} for ${item.faction}`);
      else blockers.push(`accept ${item.faction} invite`);
      break;
    }
  }

  if (!daedalus) {
    blockers.push(`join Daedalus: need high hacking/combat, money, and enough augmentations`);
  }

  if (trainingGoal) blockers.push(trainingGoal.reason);

  if (targetFaction && targetAug) {
    if (targetAug.repNeeded > 0) blockers.push(`farm ${targetAug.repNeeded.toFixed(0)} rep for ${targetAug.name}`);
    if (targetAug.moneyNeeded > 0) blockers.push(`save ${money(ns, targetAug.moneyNeeded)} for ${targetAug.name}`);
  }

  if (!redPill) blockers.push("buy The Red Pill");

  if (!worldDaemon.exists) {
    blockers.push("find w0r1d_d43m0n");
  } else {
    if (!worldDaemon.rooted) blockers.push("root w0r1d_d43m0n");
    if (worldDaemon.requiredHack > hack) blockers.push(`reach hacking ${worldDaemon.requiredHack} for w0r1d_d43m0n`);
    if (!worldDaemon.backdoored) blockers.push("backdoor w0r1d_d43m0n");
  }

  const next = blockers[0] ?? "ready for BitNode completion";
  const mode = chooseMode({ redPill, worldDaemon, daedalus, targetAug, pendingAugs, joinedEndgame });

  return {
    time: Date.now(),
    mode,
    next,
    blockers,
    cash,
    hack,
    ownedAugCount: ownedAugs.length,
    pendingAugCount: pendingAugs.length,
    redPill,
    daedalus,
    targetFaction,
    targetAug,
    trainingGoal,
    resetDecision,
    joinedEndgame,
    factionProgress,
    worldDaemon,
  };
}

function chooseTrainingGoal(ns, hack, worldDaemon, joinedEndgame) {
  const skills = ns.getPlayer().skills ?? ns.getPlayer();
  const minCombat = Math.min(skills.strength ?? 0, skills.defense ?? 0, skills.dexterity ?? 0, skills.agility ?? 0);
  if (worldDaemon.exists && worldDaemon.requiredHack > hack) {
    return { type: "class", stat: "hacking", target: worldDaemon.requiredHack, reason: `train hacking to ${worldDaemon.requiredHack}` };
  }
  if (joinedEndgame.length === 0 && hack < 250) {
    return { type: "class", stat: "hacking", target: 250, reason: "train hacking for faction unlock path" };
  }
  if (minCombat < 100 && joinedEndgame.length > 0) {
    return { type: "gym", stat: weakestCombat(skills), target: 100, reason: "train combat baseline for late-game requirements" };
  }
  return null;
}

function weakestCombat(skills) {
  const stats = ["strength", "defense", "dexterity", "agility"];
  return stats.sort((a, b) => (skills[a] ?? 0) - (skills[b] ?? 0))[0];
}

function chooseMode(ctx) {
  if (!ctx.redPill && ctx.targetAug?.name === "The Red Pill") return "red-pill";
  if (ctx.targetAug?.repNeeded > 0) return "faction-rep";
  if (ctx.targetAug?.moneyNeeded > 0) return "money";
  if (ctx.pendingAugs.length >= 5) return "install";
  if (ctx.worldDaemon.exists && ctx.redPill && !ctx.worldDaemon.backdoored) return "world-daemon";
  if (ctx.joinedEndgame.length === 0) return "faction-unlocks";
  return "scale";
}

function factionServerProgress(ns, factions) {
  return FACTION_SERVERS.map(([faction, server]) => {
    const status = serverStatus(ns, server);
    return {
      faction,
      server,
      joined: factions.includes(faction),
      exists: status.exists,
      rooted: status.rooted,
      backdoored: status.backdoored,
      requiredHack: status.requiredHack,
    };
  });
}

function serverStatus(ns, server) {
  try {
    const s = ns.getServer(server);
    return {
      exists: true,
      rooted: ns.hasRootAccess(server),
      backdoored: Boolean(s.backdoorInstalled),
      requiredHack: ns.getServerRequiredHackingLevel(server),
    };
  } catch {
    return { exists: false, rooted: false, backdoored: false, requiredHack: Infinity };
  }
}

function chooseTargetFaction(ns, factions) {
  for (const faction of ["Daedalus", "BitRunners", "The Black Hand", "NiteSec", "CyberSec"]) {
    if (factions.includes(faction)) return faction;
  }
  return factions[0] ?? null;
}

function chooseBestAug(ns, faction, ownedAugs) {
  if (!ns.singularity) return null;
  try {
    const rep = ns.singularity.getFactionRep(faction);
    const cash = ns.getServerMoneyAvailable("home");
    const candidates = ns.singularity
      .getAugmentationsFromFaction(faction)
      .filter((aug) => !ownedAugs.includes(aug))
      .map((aug) => {
        const price = ns.singularity.getAugmentationPrice(aug);
        const repReq = ns.singularity.getAugmentationRepReq(aug);
        const score = augScore(ns, aug);
        return {
          name: aug,
          price,
          repReq,
          repNeeded: Math.max(0, repReq - rep),
          moneyNeeded: Math.max(0, price - cash),
          score,
        };
      })
      .sort((a, b) => b.score - a.score || a.repNeeded - b.repNeeded || a.price - b.price);
    return candidates[0] ?? null;
  } catch {
    return null;
  }
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
      40 * (stats.company_rep ?? 0) +
      10 * (stats.charisma ?? 0) +
      10 * (stats.charisma_exp ?? 0)
    );
  } catch {
    return 1;
  }
}

function safeOwnedAugs(ns) {
  if (!ns.singularity) return [];
  try {
    return ns.singularity.getOwnedAugmentations(true);
  } catch {
    return [];
  }
}

function safeInstalledAugs(ns) {
  if (!ns.singularity) return [];
  try {
    return ns.singularity.getOwnedAugmentations(false);
  } catch {
    return [];
  }
}

function render(ns, state) {
  ns.clearLog();
  ns.print("AUTO ENDGAME");
  ns.print(`mode: ${state.mode}`);
  ns.print(`next: ${state.next}`);
  ns.print(`hack: ${state.hack}`);
  ns.print(`cash: ${money(ns, state.cash)}`);
  ns.print(`augs: owned ${state.ownedAugCount}, pending ${state.pendingAugCount}`);
  ns.print(`red pill: ${state.redPill}`);
  ns.print(`daedalus: ${state.daedalus}`);
  ns.print(`target faction: ${state.targetFaction ?? "none"}`);
  ns.print(`target aug: ${state.targetAug?.name ?? "none"}`);
  if (state.targetAug) {
    ns.print(`target rep needed: ${state.targetAug.repNeeded.toFixed(0)}`);
    ns.print(`target money needed: ${money(ns, state.targetAug.moneyNeeded)}`);
  }
  ns.print(`reset: ${state.resetDecision.action} - ${state.resetDecision.reason}`);
  ns.print("blockers:");
  for (const blocker of state.blockers.slice(0, 8)) ns.print(`  ${blocker}`);
}

function chooseResetDecision(ns, pendingAugs, targetAug, redPill) {
  const meaningful = pendingAugs.filter((aug) => aug !== "NeuroFlux Governor");
  const hasRedPillQueued = pendingAugs.includes("The Red Pill");
  const score = meaningful.reduce((sum, aug) => sum + augScore(ns, aug), 0);

  if (hasRedPillQueued) {
    return { action: "install", reason: "The Red Pill is queued", score, pending: pendingAugs.length };
  }

  if (targetAug?.repNeeded > 0 && targetAug.repNeeded < Math.max(5000, targetAug.repReq * 0.15)) {
    return { action: "hold", reason: `close to rep for ${targetAug.name}`, score, pending: pendingAugs.length };
  }

  if (targetAug?.moneyNeeded > 0 && targetAug.moneyNeeded < Math.max(1000000, targetAug.price * 0.2)) {
    return { action: "hold", reason: `close to money for ${targetAug.name}`, score, pending: pendingAugs.length };
  }

  if (meaningful.length >= 8) {
    return { action: "install", reason: `${meaningful.length} meaningful augmentations queued`, score, pending: pendingAugs.length };
  }

  if (meaningful.length >= 4 && score >= 800) {
    return { action: "install", reason: "high-value hacking augmentations queued", score, pending: pendingAugs.length };
  }

  if (!redPill && meaningful.length >= 5 && !targetAug) {
    return { action: "install", reason: "reset to unlock stronger faction progression", score, pending: pendingAugs.length };
  }

  return { action: "hold", reason: "waiting for stronger augmentation bundle", score, pending: pendingAugs.length };
}

function money(ns, value) {
  if (!Number.isFinite(value)) return "n/a";
  if (ns.format?.money) return ns.format.money(value, 2);
  if (ns.format?.number) return "$" + ns.format.number(value, 2);
  return "$" + Number(value).toLocaleString();
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Endgame");
    ns.ui?.resizeTail?.(620, 440);
  } catch {
    // Planning still works without the tail API.
  }
}
