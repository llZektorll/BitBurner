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

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui?.openTail?.();

  while (true) {
    const cash = ns.getServerMoneyAvailable("home");
    const objectives = readObjectives(ns);
    const budgetRatio = objectives?.budgets?.servers ?? CONF.serverBudgetRatio;
    const budget = cash * budgetRatio;
    const owned = purchasedServers(ns);
    const limit = purchasedServerLimit(ns);
    const maxRam = purchasedServerMaxRam(ns);
    const targetRam = affordableRam(ns, budget, maxRam);

    if (targetRam >= CONF.minServerRam) {
      if (owned.length < limit) {
        const name = `${CONF.prefix}-${owned.length}`;
        const bought = purchaseServer(ns, name, targetRam);
        if (bought) ns.print(`Purchased ${bought} with ${targetRam}GB.`);
      } else {
        const weakest = owned
          .map((host) => ({ host, ram: ns.getServerMaxRam(host) }))
          .sort((a, b) => a.ram - b.ram)[0];
        if (weakest && targetRam >= weakest.ram * 2) {
          if (upgradeServer(ns, weakest.host, targetRam)) {
            ns.print(`Upgraded ${weakest.host}: ${weakest.ram}GB -> ${targetRam}GB.`);
          } else {
            ns.killall(weakest.host);
            if (deleteServer(ns, weakest.host)) {
              const bought = purchaseServer(ns, weakest.host, targetRam);
              if (bought) ns.print(`Replaced ${weakest.host}: ${weakest.ram}GB -> ${targetRam}GB.`);
            }
          }
        }
      }
    }

    ns.print(
      `server loop: phase=${objectives?.phase ?? "none"} owned=${owned.length}/${limit} targetRam=${targetRam}GB budget=${money(ns, budget)}`,
    );
    await ns.sleep(15000);
  }
}

function affordableRam(ns, budget, maxRam) {
  let ram = 2;
  while (ram * 2 <= maxRam && purchasedServerCost(ns, ram * 2) <= budget) ram *= 2;
  return ram;
}
