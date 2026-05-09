/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  while (true) {
    const result = chargeGift(ns);
    render(ns, result);
    await ns.sleep(2000);
  }
}

function chargeGift(ns) {
  if (!ns.stanek) return { status: "stanek API unavailable", charged: 0 };
  try {
    const fragments = ns.stanek.activeFragments();
    let charged = 0;
    const chargeable = fragments
      .filter((f) => f.id < 100)
      .sort((a, b) => (a.numCharge ?? 0) - (b.numCharge ?? 0));
    for (const f of chargeable) {
      if (f.id >= 100) continue;
      ns.stanek.chargeFragment(f.x, f.y);
      charged++;
    }
    return { status: fragments.length ? "charging lowest-charge fragments" : "no gift layout", charged };
  } catch (error) {
    return { status: `idle: ${String(error)}`, charged: 0 };
  }
}

function render(ns, result) {
  ns.clearLog();
  ns.print("AUTO STANEK");
  ns.print(`status: ${result.status}`);
  ns.print(`charged fragments: ${result.charged}`);
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Stanek");
    ns.ui?.resizeTail?.(480, 260);
  } catch {}
}
