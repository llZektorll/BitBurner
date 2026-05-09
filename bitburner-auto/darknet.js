const STATE_FILE = "/auto/state-darknet.txt";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  while (true) {
    const state = await inspectDarknet(ns);
    await ns.write(STATE_FILE, JSON.stringify(state), "w");
    render(ns, state);
    await ns.sleep(30000);
  }
}

async function inspectDarknet(ns) {
  if (!ns.dnet) return { status: "dnet API unavailable", servers: [] };
  if (!ns.fileExists("DarkscapeNavigator.exe", "home")) {
    return { status: "waiting for DarkscapeNavigator.exe", servers: [] };
  }

  const connected = safe(() => ns.dnet.probe(), []);
  const linked = safe(() => ns.dnet.getStasisLinkedServers(), []);
  const instability = safe(() => ns.dnet.getDarknetInstability(), null);
  const stasisLimit = safe(() => ns.dnet.getStasisLinkLimit(), 0);
  const caches = openCaches(ns);
  const servers = [];
  let action = "probe";

  for (const host of connected) {
    const details = safe(() => ns.dnet.getServerAuthDetails(host), null);
    const depth = safe(() => ns.dnet.getDepth(host), -1);
    const blockedRam = safe(() => ns.dnet.getBlockedRam(host), 0);
    const requiredCharisma = safe(() => ns.dnet.getServerRequiredCharismaLevel(host), 0);
    const logs = await safeAsync(() => ns.dnet.heartbleed(host, { peek: true, logsToCapture: 3 }), null);
    servers.push({
      host,
      depth,
      blockedRam,
      requiredCharisma,
      hasSession: Boolean(details?.hasSession),
      isOnline: details?.isOnline ?? true,
      passwordFormat: details?.passwordFormat ?? "?",
      passwordLength: details?.passwordLength ?? "?",
      hint: details?.passwordHint ?? "",
      logMessage: summarizeResult(logs),
    });
  }

  if (safe(() => ns.dnet.isDarknetServer(), false)) {
    const result = await safeAsync(() => ns.dnet.phishingAttack(), null);
    action = result ? `phishing: ${summarizeResult(result)}` : "darknet-local idle";
  }

  return {
    status: "active",
    action,
    connected,
    linked,
    stasisLimit,
    instability,
    caches,
    servers,
  };
}

function openCaches(ns) {
  const opened = [];
  if (!ns.dnet?.openCache) return opened;
  for (const file of ns.ls(ns.getHostname(), ".cache")) {
    const result = safe(() => ns.dnet.openCache(file, true), null);
    if (result) opened.push({ file, success: result.success, message: result.message, karmaLoss: result.karmaLoss });
  }
  return opened;
}

function summarizeResult(result) {
  if (!result) return "none";
  if (Array.isArray(result.logs)) return result.logs.slice(0, 2).join(" | ");
  return result.message ?? JSON.stringify(result).slice(0, 120);
}

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

async function safeAsync(fn, fallback) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function render(ns, state) {
  ns.clearLog();
  ns.print("AUTO DARKNET");
  ns.print(`status: ${state.status}`);
  ns.print(`action: ${state.action ?? "none"}`);
  ns.print(`connected: ${(state.connected ?? []).join(", ") || "none"}`);
  ns.print(`stasis: ${(state.linked ?? []).length}/${state.stasisLimit ?? 0}`);
  if (state.instability) {
    ns.print(
      `instability: auth x${state.instability.authenticationDurationMultiplier.toFixed(2)}, timeout ${(
        state.instability.authenticationTimeoutChance * 100
      ).toFixed(1)}%`,
    );
  }
  if ((state.caches ?? []).length > 0) ns.print(`opened caches: ${state.caches.length}`);
  ns.print("servers:");
  for (const server of (state.servers ?? []).slice(0, 10)) {
    ns.print(
      `  ${server.host}: depth=${server.depth} session=${server.hasSession} blocked=${server.blockedRam} char=${server.requiredCharisma} pass=${server.passwordFormat}/${server.passwordLength}`,
    );
    if (server.hint) ns.print(`    hint: ${server.hint}`);
    if (server.logMessage && server.logMessage !== "none") ns.print(`    logs: ${server.logMessage}`);
  }
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Darknet");
    ns.ui?.resizeTail?.(680, 520);
  } catch {
    // Darknet automation still works via manual tail.
  }
}
