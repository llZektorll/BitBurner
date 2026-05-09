const STATE_FILE = "/auto/state-objectives.txt";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  while (true) {
    const state = readState(ns);
    const result = trade(ns, state);
    render(ns, state, result);
    await ns.sleep(6000);
  }
}

function trade(ns, state) {
  if (!ns.stock) return { status: "stock API unavailable", trades: 0, value: 0 };
  let symbols;
  try {
    symbols = ns.stock.getSymbols();
  } catch {
    return { status: "waiting for WSE/TIX API", trades: 0, value: 0 };
  }

  const cash = ns.getServerMoneyAvailable("home");
  const budget = stockBudget(cash, state);
  let trades = 0;
  let value = 0;

  for (const sym of symbols) {
    const [longShares, avgLong, shortShares, avgShort] = safe(() => ns.stock.getPosition(sym), [0, 0, 0, 0]);
    const price = safe(() => ns.stock.getPrice(sym), 0);
    const forecast = safe(() => ns.stock.getForecast(sym), 0.5);
    const volatility = safe(() => ns.stock.getVolatility(sym), 0.01);
    const maxShares = safe(() => ns.stock.getMaxShares(sym), 0);
    value += longShares * price + shortShares * price;

    const edge = Math.abs(forecast - 0.5) * volatility;
    if (longShares > 0 && forecast < 0.515) {
      safe(() => ns.stock.sellStock(sym, longShares), 0);
      trades++;
      continue;
    }
    if (shortShares > 0 && forecast > 0.485) {
      safe(() => ns.stock.sellShort(sym, shortShares), 0);
      trades++;
      continue;
    }

    if (budget.maxPosition <= 0 || price <= 0) continue;
    const freeCash = ns.getServerMoneyAvailable("home") - budget.reserve;
    const perTrade = Math.min(freeCash * Math.min(0.2, 0.05 + edge * 20), budget.maxPosition - longShares * price - shortShares * price);
    if (perTrade <= 1000000) continue;
    const shares = Math.max(0, Math.floor(perTrade / price));

    if (forecast > 0.57 && edge > 0.001 && longShares < maxShares && shares > 0) {
      const bought = safe(() => ns.stock.buyStock(sym, Math.min(shares, maxShares - longShares)), 0);
      if (bought > 0) trades++;
    } else if (forecast < 0.43 && edge > 0.001 && shortShares < maxShares && shares > 0) {
      const bought = safe(() => ns.stock.buyShort(sym, Math.min(shares, maxShares - shortShares)), 0);
      if (bought > 0) trades++;
    }
  }

  return { status: "active", trades, value };
}

function stockBudget(cash, state) {
  const phase = state?.phase ?? "";
  if (!["scale", "endgame-money", "world-daemon"].includes(phase) && cash < 10000000000) {
    return { reserve: cash, maxPosition: 0 };
  }
  const reserveRatio = phase === "endgame-money" ? 0.3 : 0.5;
  return {
    reserve: cash * reserveRatio,
    maxPosition: Math.max(0, cash * 0.12),
  };
}

function readState(ns) {
  try {
    if (!ns.fileExists(STATE_FILE, "home")) return null;
    return JSON.parse(ns.read(STATE_FILE));
  } catch {
    return null;
  }
}

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function render(ns, state, result) {
  ns.clearLog();
  ns.print("AUTO STOCKS");
  ns.print(`phase: ${state?.phase ?? "none"}`);
  ns.print(`status: ${result.status}`);
  ns.print(`trades: ${result.trades}`);
  ns.print(`stock value: ${money(ns, result.value)}`);
  ns.print(`cash: ${money(ns, ns.getServerMoneyAvailable("home"))}`);
}

function money(ns, value) {
  if (ns.format?.money) return ns.format.money(value, 2);
  if (ns.format?.number) return "$" + ns.format.number(value, 2);
  return "$" + Number(value).toLocaleString();
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Stocks");
    ns.ui?.resizeTail?.(520, 320);
  } catch {}
}
