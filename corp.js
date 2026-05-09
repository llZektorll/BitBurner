const DIVISION = "Agri";
const CITIES = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  while (true) {
    const result = manageCorp(ns);
    render(ns, result);
    await ns.sleep(15000);
  }
}

function manageCorp(ns) {
  if (!ns.corporation) return { status: "corporation API unavailable" };
  try {
    if (!ns.corporation.hasCorporation()) {
      if (ns.getServerMoneyAvailable("home") < 200000000000) return { status: "saving for corporation" };
      const ok = ns.corporation.createCorporation("AutoCorp", false);
      return { status: ok ? "created corporation" : "waiting for corp unlock" };
    }

    const corp = ns.corporation.getCorporation();
    if (!corp.divisions.includes(DIVISION)) {
      ns.corporation.expandIndustry("Agriculture", DIVISION);
      return { status: "created Agriculture division" };
    }

    for (const city of CITIES) {
      safe(() => ns.corporation.expandCity(DIVISION, city), false);
      if (!safe(() => ns.corporation.hasWarehouse(DIVISION, city), false)) {
        safe(() => ns.corporation.purchaseWarehouse(DIVISION, city), false);
      }
      safe(() => ns.corporation.hireEmployee(DIVISION, city, "Operations"), false);
      safe(() => ns.corporation.hireEmployee(DIVISION, city, "Engineer"), false);
      safe(() => ns.corporation.hireEmployee(DIVISION, city, "Business"), false);
      safe(() => ns.corporation.hireEmployee(DIVISION, city, "Management"), false);
      safe(() => ns.corporation.hireEmployee(DIVISION, city, "Research & Development"), false);
      safe(() => ns.corporation.setSmartSupply(DIVISION, city, true), false);
      safe(() => ns.corporation.sellMaterial(DIVISION, city, "Plants", "MAX", "MP"), false);
      safe(() => ns.corporation.sellMaterial(DIVISION, city, "Food", "MAX", "MP"), false);
      const wh = safe(() => ns.corporation.getWarehouse(DIVISION, city), null);
      if (wh && wh.sizeUsed / wh.size > 0.8 && corp.funds > safe(() => ns.corporation.getUpgradeWarehouseCost(DIVISION, city), Infinity) * 5) {
        safe(() => ns.corporation.upgradeWarehouse(DIVISION, city), false);
      }
    }

    for (const upgrade of ["Smart Factories", "Smart Storage", "FocusWires", "Neural Accelerators", "Speech Processor Implants", "DreamSense", "Wilson Analytics"]) {
      const cost = safe(() => ns.corporation.getUpgradeLevelCost(upgrade), Infinity);
      if (cost < corp.funds * 0.05) safe(() => ns.corporation.levelUpgrade(upgrade), false);
    }

    return { status: `active funds ${money(ns, corp.funds)}` };
  } catch (error) {
    return { status: `idle: ${String(error)}` };
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
  ns.print("AUTO CORP");
  ns.print(`status: ${result.status}`);
}

function money(ns, value) {
  if (ns.format?.money) return ns.format.money(value, 2);
  if (ns.format?.number) return "$" + ns.format.number(value, 2);
  return "$" + Number(value).toLocaleString();
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Corp");
    ns.ui?.resizeTail?.(560, 320);
  } catch {}
}
