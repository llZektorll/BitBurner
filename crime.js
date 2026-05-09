import { acquireWorkLock, releaseWorkLock } from "./lib.js";

const STATE_FILE = "/auto/state-objectives.txt";
const CRIMES = [
  "Shoplift",
  "Rob Store",
  "Mug",
  "Larceny",
  "Deal Drugs",
  "Bond Forgery",
  "Traffick Arms",
  "Homicide",
  "Grand Theft Auto",
  "Kidnap",
  "Assassination",
  "Heist",
];

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  if (!ns.singularity) {
    ns.tprint("crime: Singularity API unavailable. Slums automation needs Source-File 4.");
    return;
  }

  while (true) {
    const state = readState(ns);
    const mode = crimeMode(ns, state);
    const choice = chooseCrime(ns, mode);

    render(ns, state, mode, choice);
    if (choice) {
      if (!acquireWorkLock(ns, "crime", 20, 45000)) {
        await ns.sleep(10000);
        continue;
      }
      const time = ns.singularity.commitCrime(choice.name, false);
      await ns.sleep(Math.max(1000, time + 100));
    } else {
      releaseWorkLock(ns, "crime");
      await ns.sleep(30000);
    }
  }
}

function crimeMode(ns, state) {
  const player = ns.getPlayer();
  const combat = minCombat(player);
  const currentWork = currentWorkType(ns);

  if (currentWork === "FACTION" || currentWork === "COMPANY") return "idle";
  if (state?.phase === "bootstrap" && ns.getServerMoneyAvailable("home") < 1000000) return "money";
  if (combat < 75) return "combat";
  if (state?.goals?.crime) return "karma";
  if (state?.phase === "scale") return "karma";
  return "idle";
}

function currentWorkType(ns) {
  try {
    return ns.singularity.getCurrentWork()?.type ?? "";
  } catch {
    return "";
  }
}

function chooseCrime(ns, mode) {
  if (mode === "idle") return null;

  const options = CRIMES.map((name) => {
    const stats = ns.singularity.getCrimeStats(name);
    const chance = ns.singularity.getCrimeChance(name);
    const time = Math.max(1, stats.time);
    const moneyPerSecond = (stats.money * chance) / (time / 1000);
    const karmaPerSecond = (Math.abs(stats.karma ?? 0) * chance) / (time / 1000);
    const combatExp =
      ((stats.strength_exp + stats.defense_exp + stats.dexterity_exp + stats.agility_exp) * chance) / (time / 1000);
    return { name, chance, time, moneyPerSecond, karmaPerSecond, combatExp };
  }).filter((crime) => crime.chance >= minChance(mode, crime.name));

  if (options.length === 0) return { name: "Shoplift", chance: ns.singularity.getCrimeChance("Shoplift") };
  if (mode === "money") return options.sort((a, b) => b.moneyPerSecond - a.moneyPerSecond)[0];
  if (mode === "combat") return options.sort((a, b) => b.combatExp - a.combatExp)[0];
  return options.sort((a, b) => b.karmaPerSecond - a.karmaPerSecond)[0];
}

function minChance(mode, name) {
  if (mode === "money") return 0.35;
  if (mode === "combat") return name === "Homicide" ? 0.35 : 0.45;
  return name === "Homicide" ? 0.5 : 0.65;
}

function readState(ns) {
  try {
    if (!ns.fileExists(STATE_FILE, "home")) return null;
    return JSON.parse(ns.read(STATE_FILE));
  } catch {
    return null;
  }
}

function render(ns, state, mode, choice) {
  const player = ns.getPlayer();
  ns.clearLog();
  ns.print("AUTO CRIME / SLUMS");
  ns.print(`mode: ${mode}`);
  ns.print(`phase: ${state?.phase ?? "none"}`);
  ns.print(`crime: ${choice?.name ?? "none"}`);
  ns.print(`chance: ${choice ? (choice.chance * 100).toFixed(1) + "%" : "n/a"}`);
  ns.print(`cash: ${money(ns, ns.getServerMoneyAvailable("home"))}`);
  ns.print(
    `combat: str ${skill(player, "strength")} / def ${skill(player, "defense")} / dex ${skill(player, "dexterity")} / agi ${skill(player, "agility")}`,
  );
  if (choice?.moneyPerSecond) ns.print(`money/sec: ${money(ns, choice.moneyPerSecond)}`);
  if (choice?.karmaPerSecond) ns.print(`karma/sec: ${choice.karmaPerSecond.toFixed(4)}`);
  if (choice?.combatExp) ns.print(`combat exp/sec: ${choice.combatExp.toFixed(2)}`);
}

function minCombat(player) {
  return Math.min(skill(player, "strength"), skill(player, "defense"), skill(player, "dexterity"), skill(player, "agility"));
}

function skill(player, name) {
  return player.skills?.[name] ?? player[name] ?? 0;
}

function money(ns, value) {
  if (ns.format?.money) return ns.format.money(value, 2);
  if (ns.format?.number) return "$" + ns.format.number(value, 2);
  return "$" + Number(value).toLocaleString();
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Crime");
    ns.ui?.resizeTail?.(540, 360);
  } catch {
    // Crime automation still works without the tail API.
  }
}
