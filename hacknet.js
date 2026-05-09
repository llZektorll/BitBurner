import { CONF, money, readObjectives } from "./lib.js";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui?.openTail?.();

  while (true) {
    const cash = ns.getServerMoneyAvailable("home");
    const objectives = readObjectives(ns);
    const budget = hacknetBudget(cash, objectives);
    let spent = 0;
    let action = "none";

    if (budget > 0) {
      const buyCost = ns.hacknet.getPurchaseNodeCost();
      if (buyCost <= budget) {
        const index = ns.hacknet.purchaseNode();
        if (index !== -1) {
          spent = buyCost;
          action = `node ${index}`;
        }
      }

      if (spent === 0) {
        const candidate = bestUpgrade(ns, budget);
        if (candidate) {
          const ok = candidate.kind === "level"
            ? ns.hacknet.upgradeLevel(candidate.index, 1)
            : candidate.kind === "ram"
              ? ns.hacknet.upgradeRam(candidate.index, 1)
              : ns.hacknet.upgradeCore(candidate.index, 1);
          if (ok) {
            spent = candidate.cost;
            action = `${candidate.kind} ${candidate.index}`;
          }
        }
      }
    } else {
      action = `paused until ${money(ns, CONF.hacknetMinCash)}`;
    }

    ns.print(
      `hacknet: phase=${objectives?.phase ?? "none"} ${action}, spent ${money(ns, spent)}, budget ${money(
        ns,
        budget,
      )}, cash ${money(ns, cash)}`,
    );
    await ns.sleep(10000);
  }
}

function hacknetBudget(cash, objectives) {
  if (cash < CONF.hacknetMinCash) return 0;
  const planned = objectives?.budgets?.hacknet;
  if (typeof planned === "number") return cash * planned;
  if (cash < 1000000000) return cash * CONF.hacknetBudgetRatio;
  return cash * 0.05;
}

function bestUpgrade(ns, budget) {
  const upgrades = [];
  for (let i = 0; i < ns.hacknet.numNodes(); i++) {
    upgrades.push({ index: i, kind: "level", cost: ns.hacknet.getLevelUpgradeCost(i, 1) });
    upgrades.push({ index: i, kind: "ram", cost: ns.hacknet.getRamUpgradeCost(i, 1) });
    upgrades.push({ index: i, kind: "core", cost: ns.hacknet.getCoreUpgradeCost(i, 1) });
  }
  return upgrades
    .filter((u) => Number.isFinite(u.cost) && u.cost <= budget)
    .sort((a, b) => a.cost - b.cost)[0];
}
