import { acquireWorkLock, releaseWorkLock } from "./lib.js";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  while (true) {
    const result = manageBladeburner(ns);
    render(ns, result);
    await ns.sleep(10000);
  }
}

function manageBladeburner(ns) {
  if (!ns.bladeburner) {
    releaseWorkLock(ns, "bladeburner");
    return { status: "bladeburner API unavailable" };
  }
  try {
    if (!acquireWorkLock(ns, "bladeburner", 40, 45000)) return { status: "waiting for work lock" };
    safe(() => ns.bladeburner.joinBladeburnerDivision(), false);
    safe(() => ns.bladeburner.joinBladeburnerFaction(), false);
    upgradeSkills(ns);
    const [stamina, maxStamina] = ns.bladeburner.getStamina();
    if (stamina / maxStamina < 0.55) {
      ns.bladeburner.startAction("General", "Hyperbolic Regeneration Chamber");
      return { status: "recovering stamina" };
    }
    if (needsAnalysis(ns)) {
      ns.bladeburner.startAction("General", "Field Analysis");
      return { status: "field analysis" };
    }

    const blackOp = safe(() => ns.bladeburner.getNextBlackOp(), null);
    if (blackOp && safe(() => ns.bladeburner.getRank(), 0) >= blackOp.rank && chance(ns, "Black Operations", blackOp.name) > 0.9) {
      ns.bladeburner.startAction("Black Operations", blackOp.name);
      return { status: `black op ${blackOp.name}` };
    }

    for (const [type, names] of [["Operations", ns.bladeburner.getOperationNames()], ["Contracts", ns.bladeburner.getContractNames()]]) {
      const best = names
        .filter((name) => safe(() => ns.bladeburner.getActionCountRemaining(type, name), 0) > 0)
        .map((name) => ({ name, c: chance(ns, type, name), rep: safe(() => ns.bladeburner.getActionRepGain(type, name), 1), time: safe(() => ns.bladeburner.getActionTime(type, name), 1) }))
        .filter((x) => x.c > 0.78)
        .sort((a, b) => (b.rep * b.c) / b.time - (a.rep * a.c) / a.time)[0];
      if (best) {
        ns.bladeburner.startAction(type, best.name);
        return { status: `${type}: ${best.name}` };
      }
    }

    ns.bladeburner.startAction("General", "Field Analysis");
    return { status: "field analysis" };
  } catch (error) {
    releaseWorkLock(ns, "bladeburner");
    return { status: `idle: ${String(error)}` };
  }
}

function needsAnalysis(ns) {
  const city = ns.bladeburner.getCity();
  const chaos = safe(() => ns.bladeburner.getCityChaos(city), 0);
  const communities = safe(() => ns.bladeburner.getCityCommunities(city), 1);
  return chaos > 50 || communities < 1;
}

function chance(ns, type, name) {
  const [min, max] = ns.bladeburner.getActionEstimatedSuccessChance(type, name);
  return (min + max) / 2;
}

function upgradeSkills(ns) {
  for (const skill of ["Overclock", "Blade's Intuition", "Digital Observer", "Cloak", "Short-Circuit", "Reaper", "Evasive System"]) {
    const cost = safe(() => ns.bladeburner.getSkillUpgradeCost(skill), Infinity);
    if (cost <= safe(() => ns.bladeburner.getSkillPoints(), 0)) safe(() => ns.bladeburner.upgradeSkill(skill), false);
  }
}

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function render(ns, result) {
  ns.clearLog();
  ns.print("AUTO BLADEBURNER");
  ns.print(`status: ${result.status}`);
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Bladeburner");
    ns.ui?.resizeTail?.(560, 320);
  } catch {}
}
