const STATE_FILE = "/auto/state-objectives.txt";
const STOCK_STATE_FILE = "/auto/state-stocks.txt";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  while (true) {
    const state = readState(ns);
    const stockState = readStockState(ns);
    const result = trade(ns, state, stockState);
    await ns.write(STOCK_STATE_FILE, JSON.stringify(result.nextState), "w");
    render(ns, state, result);
    await waitForNextTick(ns);
  }
}

function trade(ns, state, stockState) {
  if (!ns.stock) return { status: "stock API unavailable", trades: 0, value: 0, nextState: stockState };
  const access = buyAccess(ns);
  let symbols;
  try {
    symbols = ns.stock.getSymbols();
  } catch {
    return { status: `waiting for TIX API (${access})`, trades: 0, value: 0, nextState: stockState };
  }

  const cash = ns.getServerMoneyAvailable("home");
  const budget = stockBudget(cash, state);
  const prices = {};
  let trades = 0;
  let value = 0;
  let mode = "momentum";

  for (const sym of symbols) {
    const [longShares, , shortShares] = safe(() => ns.stock.getPosition(sym), [0, 0, 0, 0]);
    const price = safe(() => ns.stock.getPrice(sym), 0);
    prices[sym] = price;
    const signal = stockSignal(ns, sym, price, stockState);
    if (signal.source === "4S") mode = "4S";
    const maxShares = safe(() => ns.stock.getMaxShares(sym), 0);
    value += longShares * price + shortShares * price;

    if (longShares > 0 && signal.score < signal.sellLong) {
      safe(() => ns.stock.sellStock(sym, longShares), 0);
      trades++;
      continue;
    }
    if (shortShares > 0 && signal.score > signal.sellShort) {
      safe(() => ns.stock.sellShort(sym, shortShares), 0);
      trades++;
      continue;
    }

    if (budget.maxPosition <= 0 || price <= 0) continue;
    const freeCash = ns.getServerMoneyAvailable("home") - budget.reserve;
    const perTrade = Math.min(
      freeCash * signal.cashWeight,
      budget.maxPosition - longShares * price - shortShares * price,
    );
    if (perTrade <= 1000000) continue;
    const shares = Math.max(0, Math.floor(perTrade / price));

    if (signal.score > signal.buyLong && longShares < maxShares && shares > 0) {
      const bought = safe(() => ns.stock.buyStock(sym, Math.min(shares, maxShares - longShares)), 0);
      if (bought > 0) trades++;
    } else if (signal.source === "4S" && signal.score < signal.buyShort && shortShares < maxShares && shares > 0) {
      const bought = safe(() => ns.stock.buyShort(sym, Math.min(shares, maxShares - shortShares)), 0);
      if (bought > 0) trades++;
    }
  }

  return { status: `active ${mode} (${access})`, trades, value, nextState: { prices, updated: Date.now() } };
}

function stockBudget(cash, state) {
  const phase = state?.phase ?? "";
  if (!["scale", "endgame-money", "world-daemon", "stocks"].includes(phase) && cash < 1000000000) {
    return { reserve: cash, maxPosition: 0 };
  }
  const reserveRatio = phase === "endgame-money" || phase === "stocks" ? 0.25 : 0.45;
  return {
    reserve: cash * reserveRatio,
    maxPosition: Math.max(0, cash * 0.15),
  };
}

function buyAccess(ns) {
  const bought = [];
  if (safe(() => ns.stock.purchaseWseAccount(), false)) bought.push("WSE");
  if (safe(() => ns.stock.purchaseTixApi(), false)) bought.push("TIX");
  if (safe(() => ns.stock.purchase4SMarketData(), false)) bought.push("4S UI");
  if (safe(() => ns.stock.purchase4SMarketDataTixApi(), false)) bought.push("4S API");
  return bought.length ? bought.join(",") : "access checked";
}

function stockSignal(ns, sym, price, stockState) {
  const forecast = safe(() => ns.stock.getForecast(sym), null);
  const volatility = safe(() => ns.stock.getVolatility(sym), null);
  if (typeof forecast === "number" && typeof volatility === "number") {
    const edge = Math.abs(forecast - 0.5) * volatility;
    return {
      source: "4S",
      score: forecast,
      buyLong: 0.56,
      sellLong: 0.515,
      buyShort: 0.44,
      sellShort: 0.485,
      cashWeight: Math.min(0.22, 0.05 + edge * 20),
    };
  }

  const previous = stockState?.prices?.[sym] ?? price;
  const momentum = previous > 0 ? price / previous - 1 : 0;
  return {
    source: "momentum",
    score: momentum,
    buyLong: 0.004,
    sellLong: -0.002,
    buyShort: -Infinity,
    sellShort: Infinity,
    cashWeight: Math.min(0.08, Math.max(0.02, Math.abs(momentum) * 8)),
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

function readStockState(ns) {
  try {
    if (!ns.fileExists(STOCK_STATE_FILE, "home")) return { prices: {}, updated: 0 };
    return JSON.parse(ns.read(STOCK_STATE_FILE));
  } catch {
    return { prices: {}, updated: 0 };
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

async function waitForNextTick(ns) {
  try {
    await ns.stock.nextUpdate();
  } catch {
    await ns.sleep(6000);
  }
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
