const STATE_FILE = "/auto/state-bitnode.txt";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  while (true) {
    const state = buildState(ns);
    await ns.write(STATE_FILE, JSON.stringify(state), "w");
    render(ns, state);
    await ns.sleep(30000);
  }
}

function buildState(ns) {
  const player = ns.getPlayer();
  const bitNode = player.bitNodeN ?? 1;
  const sourceFiles = player.sourceFiles ?? [];
  const sf = Object.fromEntries(sourceFiles.map((item) => [item.n ?? item.number, item.lvl ?? item.level ?? 1]).filter(([n]) => n));
  const strategy = strategyFor(bitNode, sf);

  return {
    time: Date.now(),
    bitNode,
    sourceFiles: sf,
    strategy,
    unlocked: {
      singularity: Boolean(ns.singularity),
      gang: Boolean(ns.gang),
      corporation: Boolean(ns.corporation),
      bladeburner: Boolean(ns.bladeburner),
      sleeve: Boolean(ns.sleeve),
      stock: Boolean(ns.stock),
      stanek: Boolean(ns.stanek),
      go: Boolean(ns.go),
    },
  };
}

function strategyFor(bitNode, sf) {
  const base = {
    main: "hacking",
    preferBatching: true,
    preferGangs: false,
    preferCorp: false,
    preferBladeburner: false,
    preferStocks: false,
    preferHacknet: false,
    preferSleeves: false,
    preferStanek: false,
    preferGo: false,
    serverBudgetBoost: 1,
    hacknetBudgetBoost: 1,
    homeBudgetBoost: 1,
    resetAggression: 1,
  };

  if (bitNode === 2) return { ...base, main: "gang", preferGangs: true, resetAggression: 0.85 };
  if (bitNode === 3) return { ...base, main: "corp", preferCorp: true, serverBudgetBoost: 0.7, homeBudgetBoost: 0.8 };
  if (bitNode === 4) return { ...base, main: "singularity", homeBudgetBoost: 1.2, resetAggression: 1.15 };
  if (bitNode === 6 || bitNode === 7) return { ...base, main: "bladeburner", preferBladeburner: true, resetAggression: 0.9 };
  if (bitNode === 8) return { ...base, main: "stocks", preferStocks: true, serverBudgetBoost: 0.6 };
  if (bitNode === 9) return { ...base, main: "hacknet", preferHacknet: true, hacknetBudgetBoost: 3, serverBudgetBoost: 0.75 };
  if (bitNode === 10) return { ...base, main: "sleeves", preferSleeves: true, resetAggression: 0.9 };
  if (bitNode === 13) return { ...base, main: "stanek", preferStanek: true };
  if (bitNode === 14) return { ...base, main: "go", preferGo: true };

  if ((sf[2] ?? 0) > 0) base.preferGangs = true;
  if ((sf[3] ?? 0) > 0) base.preferCorp = true;
  if ((sf[6] ?? 0) > 0 || (sf[7] ?? 0) > 0) base.preferBladeburner = true;
  if ((sf[8] ?? 0) > 0) base.preferStocks = true;
  if ((sf[10] ?? 0) > 0) base.preferSleeves = true;
  return base;
}

function render(ns, state) {
  ns.clearLog();
  ns.print("AUTO BITNODE");
  ns.print(`bitnode: ${state.bitNode}`);
  ns.print(`main: ${state.strategy.main}`);
  ns.print(`batching: ${state.strategy.preferBatching}`);
  ns.print(`gang/corp/blade: ${state.strategy.preferGangs}/${state.strategy.preferCorp}/${state.strategy.preferBladeburner}`);
  ns.print(`stocks/hacknet/sleeves: ${state.strategy.preferStocks}/${state.strategy.preferHacknet}/${state.strategy.preferSleeves}`);
  ns.print(`stanek/go: ${state.strategy.preferStanek}/${state.strategy.preferGo}`);
  ns.print(
    `budget boosts: server ${state.strategy.serverBudgetBoost}, home ${state.strategy.homeBudgetBoost}, hacknet ${state.strategy.hacknetBudgetBoost}`,
  );
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto BitNode");
    ns.ui?.resizeTail?.(560, 340);
  } catch {
    // Strategy state still works without a tail window.
  }
}
