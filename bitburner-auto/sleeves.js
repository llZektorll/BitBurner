const STATE_FILE = "/auto/state-objectives.txt";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  while (true) {
    const state = readState(ns);
    const result = manageSleeves(ns, state);
    render(ns, state, result);
    await ns.sleep(15000);
  }
}

function manageSleeves(ns, state) {
  if (!ns.sleeve) return { status: "sleeve API unavailable", count: 0 };
  try {
    const count = ns.sleeve.getNumSleeves();
    for (let i = 0; i < count; i++) {
      const sleeve = ns.sleeve.getSleeve(i);
      if ((sleeve.shock ?? 0) > 0) {
        ns.sleeve.setToShockRecovery(i);
      } else if ((sleeve.sync ?? 100) < 100) {
        ns.sleeve.setToSynchronize(i);
      } else if (state?.goals?.share || state?.phase === "faction-rep") {
        setSleeveFactionWork(ns, i);
      } else if (state?.goals?.training) {
        ns.sleeve.setToUniversityCourse(i, "Rothman University", "Algorithms");
      } else {
        ns.sleeve.setToCommitCrime(i, chooseSleeveCrime(ns, i));
      }
    }
    buySleeveAugs(ns, count);
    return { status: "active", count };
  } catch (error) {
    return { status: `idle: ${String(error)}`, count: 0 };
  }
}

function setSleeveFactionWork(ns, i) {
  const factions = ns.getPlayer().factions ?? [];
  for (const faction of ["Daedalus", "BitRunners", "The Black Hand", "NiteSec", "CyberSec", ...factions]) {
    if (!factions.includes(faction)) continue;
    if (safe(() => ns.sleeve.setToFactionWork(i, faction, "hacking"), false)) return;
  }
  ns.sleeve.setToCommitCrime(i, "Homicide");
}

function buySleeveAugs(ns, count) {
  for (let i = 0; i < count; i++) {
    const augs = safe(() => ns.sleeve.getSleevePurchasableAugs(i), []);
    for (const aug of augs.sort((a, b) => a.cost - b.cost)) {
      if (aug.cost < ns.getServerMoneyAvailable("home") * 0.03 && goodSleeveAug(aug)) safe(() => ns.sleeve.purchaseSleeveAug(i, aug.name), false);
    }
  }
}

function chooseSleeveCrime(ns, i) {
  const sleeve = ns.sleeve.getSleeve(i);
  const combat = ((sleeve.skills?.strength ?? sleeve.strength ?? 0) + (sleeve.skills?.defense ?? sleeve.defense ?? 0) + (sleeve.skills?.dexterity ?? sleeve.dexterity ?? 0) + (sleeve.skills?.agility ?? sleeve.agility ?? 0)) / 4;
  return combat > 80 ? "Homicide" : "Mug";
}

function goodSleeveAug(aug) {
  const name = String(aug.name).toLowerCase();
  return ["hack", "neural", "synaptic", "combat", "bionic", "social", "speech"].some((part) => name.includes(part));
}

function readState(ns) {
  try {
    if (!ns.fileExists(STATE_FILE, "home")) return null;
    return JSON.parse(ns.read(STATE_FILE));
  } catch {
    return null;
  }
}

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function render(ns, state, result) {
  ns.clearLog();
  ns.print("AUTO SLEEVES");
  ns.print(`phase: ${state?.phase ?? "none"}`);
  ns.print(`status: ${result.status}`);
  ns.print(`sleeves: ${result.count}`);
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Sleeves");
    ns.ui?.resizeTail?.(520, 320);
  } catch {}
}
