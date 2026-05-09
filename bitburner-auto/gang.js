/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  while (true) {
    const result = manageGang(ns);
    render(ns, result);
    await ns.sleep(10000);
  }
}

function manageGang(ns) {
  if (!ns.gang) return { status: "gang API unavailable", members: 0 };
  try {
    if (!ns.gang.inGang()) {
      const created = ns.gang.createGang("Slum Snakes") || ns.gang.createGang("NiteSec");
      return { status: created ? "created gang" : "waiting for gang unlock", members: 0 };
    }

    while (ns.gang.canRecruitMember()) {
      ns.gang.recruitMember(`auto-${ns.gang.getMemberNames().length}`);
    }

    const info = ns.gang.getGangInformation();
    const tasks = ns.gang.getTaskNames();
    const members = ns.gang.getMemberNames();
    const warfare = info.territory < 0.98 && info.territoryClashChance > 0.72;
    for (const [index, name] of members.entries()) {
      ascendIfWorth(ns, name);
      buyEquipmentByBudget(ns, name, members.length);
      ns.gang.setMemberTask(name, chooseTask(ns, name, info, tasks, index, warfare));
    }
    safe(() => ns.gang.setTerritoryWarfare(warfare), false);
    return { status: `active${warfare ? " territory" : ""}`, members: members.length, wanted: info.wantedLevel, respect: info.respect };
  } catch (error) {
    return { status: `idle: ${String(error)}`, members: 0 };
  }
}

function chooseTask(ns, member, info, tasks, index, warfare) {
  const m = ns.gang.getMemberInformation(member);
  const combat = (m.str + m.def + m.dex + m.agi) / 4;
  if (info.wantedPenalty < 0.9 && tasks.includes("Vigilante Justice")) return "Vigilante Justice";
  if (combat < 75 && tasks.includes("Train Combat")) return "Train Combat";
  if (warfare && index < Math.ceil(ns.gang.getMemberNames().length * 0.45) && tasks.includes("Territory Warfare")) return "Territory Warfare";
  for (const task of ["Human Trafficking", "Traffick Illegal Arms", "Money Laundering", "Strongarm Civilians", "Mug People"]) {
    if (tasks.includes(task)) return task;
  }
  return tasks[0] ?? "Unassigned";
}

function ascendIfWorth(ns, member) {
  const result = safe(() => ns.gang.getAscensionResult(member), null);
  if (!result) return;
  const gains = [result.str, result.def, result.dex, result.agi, result.hack, result.cha].filter(Number.isFinite);
  const best = Math.max(...gains);
  if (best >= 1.6) safe(() => ns.gang.ascendMember(member), null);
}

function buyEquipmentByBudget(ns, member, memberCount) {
  const cash = ns.getServerMoneyAvailable("home");
  const budget = Math.max(0, cash * 0.08 / Math.max(1, memberCount));
  const owned = new Set(ns.gang.getMemberInformation(member).upgrades ?? []);
  const items = ns.gang.getEquipmentNames()
    .filter((item) => !owned.has(item))
    .map((item) => ({ item, cost: ns.gang.getEquipmentCost(item), type: ns.gang.getEquipmentType(item) }))
    .sort((a, b) => a.cost - b.cost);
  for (const { item, cost, type } of items) {
    const useful = ["Weapon", "Armor", "Vehicle", "Rootkit", "Augmentation"].includes(type);
    if (useful && cost <= budget) safe(() => ns.gang.purchaseEquipment(member, item), false);
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
  ns.print("AUTO GANG");
  ns.print(`status: ${result.status}`);
  ns.print(`members: ${result.members}`);
  if (result.respect !== undefined) ns.print(`respect: ${result.respect.toFixed(2)}`);
  if (result.wanted !== undefined) ns.print(`wanted: ${result.wanted.toFixed(2)}`);
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Gang");
    ns.ui?.resizeTail?.(520, 320);
  } catch {}
}
