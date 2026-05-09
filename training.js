import { acquireWorkLock, releaseWorkLock } from "./lib.js";

const STATE_FILE = "/auto/state-endgame.txt";
const UNIVERSITY = "Rothman University";
const GYM = "Powerhouse Gym";
const COMPANIES = ["ECorp", "MegaCorp", "KuaiGong International", "Four Sigma", "NWO", "Blade Industries"];

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  if (!ns.singularity) {
    ns.tprint("training: Singularity API unavailable. Training/company automation needs Source-File 4.");
    return;
  }

  while (true) {
    const endgame = readEndgame(ns);
    const goal = chooseGoal(ns, endgame);
    await applyGoal(ns, goal);
    render(ns, endgame, goal);
    await ns.sleep(30000);
  }
}

function chooseGoal(ns, endgame) {
  const player = ns.getPlayer();
  const skills = player.skills ?? player;
  const minCombat = Math.min(skills.strength ?? 0, skills.defense ?? 0, skills.dexterity ?? 0, skills.agility ?? 0);

  if (endgame?.trainingGoal) return endgame.trainingGoal;
  if (endgame?.mode === "faction-unlocks" && (skills.hacking ?? 0) < 250) {
    return { type: "class", stat: "hacking", target: 250, reason: "early faction/server hacking gates" };
  }
  if (endgame?.mode === "world-daemon" && endgame.worldDaemon?.requiredHack > (skills.hacking ?? 0)) {
    return { type: "class", stat: "hacking", target: endgame.worldDaemon.requiredHack, reason: "World Daemon hacking gate" };
  }
  if (endgame?.mode === "scale" && minCombat < 100) {
    return { type: "gym", stat: weakestCombat(skills), target: 100, reason: "baseline combat for late-game factions" };
  }
  if (endgame?.next?.includes("Fulcrum")) {
    return { type: "company", company: "Fulcrum Technologies", reason: "Fulcrum Secret Technologies path" };
  }
  return { type: "idle", reason: "no training or company blocker" };
}

async function applyGoal(ns, goal) {
  if (!goal || goal.type === "idle") {
    releaseWorkLock(ns, "training");
    return;
  }
  if (!acquireWorkLock(ns, "training", 80, 45000)) return;

  if (goal.type === "class") {
    ensureCity(ns, "Sector-12");
    ns.singularity.universityCourse(UNIVERSITY, courseFor(goal.stat), false);
    return;
  }

  if (goal.type === "gym") {
    ensureCity(ns, "Sector-12");
    ns.singularity.gymWorkout(GYM, gymStat(goal.stat), false);
    return;
  }

  if (goal.type === "company") {
    const company = goal.company ?? bestCompany(ns);
    try {
      ns.singularity.applyToCompany(company, "software");
      ns.singularity.workForCompany(company, false);
    } catch {
      // Some companies require different stat/job prerequisites.
    }
  }
}

function ensureCity(ns, city) {
  try {
    ns.singularity.travelToCity(city);
  } catch {
    // Not enough money or unavailable city travel.
  }
}

function courseFor(stat) {
  if (stat === "charisma") return "Leadership";
  return "Algorithms";
}

function gymStat(stat) {
  if (stat === "strength") return "strength";
  if (stat === "defense") return "defense";
  if (stat === "dexterity") return "dexterity";
  return "agility";
}

function weakestCombat(skills) {
  const stats = ["strength", "defense", "dexterity", "agility"];
  return stats.sort((a, b) => (skills[a] ?? 0) - (skills[b] ?? 0))[0];
}

function bestCompany(ns) {
  let best = COMPANIES[0];
  let bestRep = -Infinity;
  for (const company of COMPANIES) {
    try {
      const rep = ns.singularity.getCompanyRep(company);
      if (rep > bestRep) {
        best = company;
        bestRep = rep;
      }
    } catch {
      // Company may not exist in this BitNode/context.
    }
  }
  return best;
}

function readEndgame(ns) {
  try {
    if (!ns.fileExists(STATE_FILE, "home")) return null;
    return JSON.parse(ns.read(STATE_FILE));
  } catch {
    return null;
  }
}

function render(ns, endgame, goal) {
  const player = ns.getPlayer();
  const skills = player.skills ?? player;
  ns.clearLog();
  ns.print("AUTO TRAINING / COMPANY");
  ns.print(`endgame mode: ${endgame?.mode ?? "none"}`);
  ns.print(`endgame next: ${endgame?.next ?? "none"}`);
  ns.print(`goal: ${goal?.type ?? "none"}`);
  ns.print(`reason: ${goal?.reason ?? "none"}`);
  if (goal?.target) ns.print(`target: ${goal.stat} ${goal.target}`);
  if (goal?.company) ns.print(`company: ${goal.company}`);
  ns.print(`hacking: ${skills.hacking ?? 0}`);
  ns.print(
    `combat: str ${skills.strength ?? 0} / def ${skills.defense ?? 0} / dex ${skills.dexterity ?? 0} / agi ${skills.agility ?? 0}`,
  );
  try {
    const work = ns.singularity.getCurrentWork();
    ns.print(`current work: ${work?.type ?? "none"} ${work?.factionName ?? work?.companyName ?? ""}`);
  } catch {
    ns.print("current work: unknown");
  }
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Training");
    ns.ui?.resizeTail?.(580, 380);
  } catch {
    // Training automation still works without the tail API.
  }
}
