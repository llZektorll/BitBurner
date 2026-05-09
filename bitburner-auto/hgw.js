/** @param {NS} ns */
export async function main(ns) {
  const mode = String(ns.args[0] ?? "weaken");
  const target = String(ns.args[1] ?? "n00dles");
  const delay = Math.max(0, Number(ns.args[2] ?? 0));

  if (delay > 0) await ns.sleep(delay);
  if (mode === "hack") await ns.hack(target);
  else if (mode === "grow") await ns.grow(target);
  else await ns.weaken(target);
}

