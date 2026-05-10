import {
  CONF,
  deleteServer,
  money,
  purchaseServer,
  purchasedServerCost,
  purchasedServerLimit,
  purchasedServerMaxRam,
  purchasedServers,
  readObjectives,
  upgradeServer,
} from "./lib.js";
import { CONFIG } from "./config.js";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui?.openTail?.();

  while (true) {
    const objectives = readObjectives(ns);
    const budgetRatio = objectives?.budgets?.servers ?? CONF.serverBudgetRatio;
    const startCash = ns.getServerMoneyAvailable("home");
    const budget = startCash * budgetRatio;
    let spent = 0;
    let actions = 0;
    let owned = purchasedServers(ns);
    const limit = purchasedServerLimit(ns);
    const maxRam = purchasedServerMaxRam(ns);

    while (actions < CONFIG.servers.maxActionsPerPass) {
      owned = purchasedServers(ns);
      const remainingBudget = Math.max(0, budget - spent);
      const targetRam = affordableRam(ns, remainingBudget, maxRam);
      if (targetRam < CONF.minServerRam) break;
      const cost = purchasedServerCost(ns, targetRam);
      if (cost > ns.getServerMoneyAvailable("home")) break;

      if (owned.length < limit) {
        const name = nextServerName(owned);
        const bought = purchaseServer(ns, name, targetRam);
        if (!bought) break;
        spent += cost;
        actions++;
        ns.print(`Purchased ${bought} with ${targetRam}GB for ${money(ns, cost)}.`);
      } else {
        const weakest = owned
          .map((host) => ({ host, ram: ns.getServerMaxRam(host) }))
          .sort((a, b) => a.ram - b.ram)[0];
        if (!weakest || targetRam < weakest.ram * CONFIG.servers.minUpgradeMultiplier) break;
        if (upgradeServer(ns, weakest.host, targetRam)) {
          spent += cost;
          actions++;
          ns.print(`Upgraded ${weakest.host}: ${weakest.ram}GB -> ${targetRam}GB for ${money(ns, cost)}.`);
        } else {
          ns.killall(weakest.host);
          if (!deleteServer(ns, weakest.host)) break;
          const bought = purchaseServer(ns, weakest.host, targetRam);
          if (bought) {
            spent += cost;
            actions++;
            ns.print(`Replaced ${weakest.host}: ${weakest.ram}GB -> ${targetRam}GB for ${money(ns, cost)}.`);
          } else {
            break;
          }
        }
      }
    }

    ns.print(
      `server loop: phase=${objectives?.phase ?? "none"} owned=${purchasedServers(ns).length}/${limit} spent=${money(ns, spent)}/${money(
        ns,
        budget,
      )}`,
    );
    await ns.sleep(actions > 0 ? CONFIG.servers.activeSleepMs : CONFIG.servers.idleSleepMs);
  }
}

function affordableRam(ns, budget, maxRam) {
  let ram = 2;
  while (ram * 2 <= maxRam && purchasedServerCost(ns, ram * 2) <= budget) ram *= 2;
  return ram;
}

function nextServerName(owned) {
  const names = new Set(owned);
  for (let i = 0; i < 10000; i++) {
    const name = `${CONF.prefix}-${i}`;
    if (!names.has(name)) return name;
  }
  return `${CONF.prefix}-${Date.now()}`;
}
