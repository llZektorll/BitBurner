/** @param {NS} ns */
export async function main(ns) {
  const target = String(ns.args[0] ?? "n00dles");
  const mode = String(ns.args[1] ?? "smart");

  if (mode === "weaken") return void (await ns.weaken(target));
  if (mode === "grow") return void (await ns.grow(target));
  if (mode === "hack") return void (await ns.hack(target));

  const minSec = ns.getServerMinSecurityLevel(target);
  const maxMoney = ns.getServerMaxMoney(target);

  while (true) {
    const sec = ns.getServerSecurityLevel(target);
    const money = ns.getServerMoneyAvailable(target);
    if (sec > minSec + 4) {
      await ns.weaken(target);
    } else if (maxMoney > 0 && money < maxMoney * 0.85) {
      await ns.grow(target);
    } else {
      await ns.hack(target);
    }
  }
}

