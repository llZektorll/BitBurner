import { money, scanAll, tryRoot } from "./lib.js";

const PANEL_ID = "auto-network-gui";
const REFRESH_MS = 1000;

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  let running = true;
  let busy = false;
  let lastAction = "ready";
  let pendingAction = null;
  let pointerInside = false;
  let forceRender = true;
  const doc = getDocument();
  const panel = doc ? createPanel(doc) : null;
  const queueAction = (action, host) => {
    if (busy && action !== "close") return;
    pendingAction = { action, host };
    lastAction = host ? `clicked ${action} ${host}` : `clicked ${action}`;
  };

  safe(() => ns.atExit(() => {
    try {
      panel?.remove();
    } catch {
      // Ignore cleanup failures when the game reloads.
    }
  }), null);

  if (panel) {
    panel.addEventListener("mouseenter", () => {
      pointerInside = true;
    });
    panel.addEventListener("mouseleave", () => {
      pointerInside = false;
      forceRender = true;
    });
    panel.addEventListener("pointerdown", () => {
      pointerInside = true;
    });
    panel.addEventListener("click", (event) => {
      const button = event.target?.closest?.("button[data-action]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      queueAction(button.dataset.action, button.dataset.host);
    });
  }

  while (running) {
    if (pendingAction && !busy) {
      const next = pendingAction;
      pendingAction = null;
      busy = true;
      try {
        if (next.action === "close") {
          running = false;
          panel?.remove();
          break;
        }
        lastAction = await runAction(ns, next.action, next.host);
        forceRender = true;
      } catch (error) {
        lastAction = `${next.action} failed: ${String(error)}`;
        forceRender = true;
      } finally {
        busy = false;
      }
    }
    const model = buildModel(ns, lastAction);
    if (panel) {
      if (forceRender || busy || !pointerInside) {
        renderPanel(panel, model, busy, queueAction);
        forceRender = false;
      }
    }
    else renderTail(ns, model);
    await ns.sleep(REFRESH_MS);
  }
}

async function runAction(ns, action, host) {
  if (action === "refresh") return "refreshed";
  if (action === "root-all") {
    const result = rootAll(ns);
    return `root all: ${result.rooted} rooted, ${result.blocked} blocked`;
  }
  if (action === "backdoor-all") {
    if (!ns.singularity) return "Backdoor automation unavailable: Singularity API is locked.";
    const result = await backdoorAll(ns);
    return `backdoor all: ${result.done} installed, ${result.skipped} skipped`;
  }
  if (action === "root" && host) return tryRoot(ns, host) ? `rooted ${host}` : `could not root ${host}`;
  if (action === "connect" && host) return rootAndConnect(ns, host);
  if (action === "backdoor" && host) return (await backdoorHost(ns, host)) ? `backdoored ${host}` : `could not backdoor ${host}`;
  if (action === "kill" && host) {
    try {
      ns.killall(host);
      return `killed scripts on ${host}`;
    } catch {
      return `could not kill scripts on ${host}`;
    }
  }
  return `unknown action ${action}`;
}

function rootAndConnect(ns, host) {
  let rootStatus = "already rooted";
  if (host !== "home" && !ns.hasRootAccess(host)) {
    rootStatus = tryRoot(ns, host) ? "rooted first" : "root unavailable";
  }
  const path = pathTo(ns, host);
  const command = path.map((step) => `connect ${step}`).join("; ");
  if (connectTo(ns, host)) return `connected to ${host} (${rootStatus})`;
  if (!ns.singularity) {
    ns.tprint(`network-gui path to ${host}: ${command}`);
    return `Singularity unavailable. Manual path printed: ${command}`;
  }
  ns.tprint(`network-gui could not connect to ${host}. Try: ${command}`);
  return `could not connect to ${host} (${rootStatus}). Path printed.`;
}

function buildModel(ns, lastAction) {
  const hosts = scanAll(ns);
  const paths = new Map(hosts.map((host) => [host, pathTo(ns, host)]));
  const ports = portsAvailable(ns);
  const rows = hosts
    .map((host) => serverRow(ns, host, paths.get(host) ?? ["home"], ports))
    .sort((a, b) => a.path.join("/").localeCompare(b.path.join("/")));
  const rooted = rows.filter((row) => row.root).length;
  const eligible = rows.filter((row) => row.canRoot).length;
  const backdoorReady = rows.filter((row) => row.canBackdoor).length;
  return {
    rows,
    lastAction,
    ports,
    rooted,
    total: rows.length,
    eligible,
    backdoorReady,
    hack: ns.getHackingLevel(),
    cash: ns.getServerMoneyAvailable("home"),
    cashText: money(ns, ns.getServerMoneyAvailable("home")),
    singularity: Boolean(ns.singularity),
  };
}

function serverRow(ns, host, path, ports) {
  const server = safe(() => ns.getServer(host), {});
  const requiredPorts = safe(() => ns.getServerNumPortsRequired(host), 0);
  const requiredHack = safe(() => ns.getServerRequiredHackingLevel(host), 0);
  const root = host === "home" || safe(() => ns.hasRootAccess(host), false);
  const canRoot = host !== "home" && !root && requiredPorts <= ports;
  const canHack = requiredHack <= ns.getHackingLevel();
  const backdoored = Boolean(server.backdoorInstalled);
  const canBackdoor = Boolean(ns.singularity) && host !== "home" && root && canHack && !backdoored;
  const maxRam = safe(() => ns.getServerMaxRam(host), 0);
  const usedRam = safe(() => ns.getServerUsedRam(host), 0);
  const maxMoney = safe(() => ns.getServerMaxMoney(host), 0);
  return {
    host,
    path,
    depth: Math.max(0, path.length - 1),
    root,
    canRoot,
    canHack,
    canBackdoor,
    backdoored,
    requiredPorts,
    requiredHack,
    ram: `${formatNumber(usedRam)}/${formatNumber(maxRam)}GB`,
    money: maxMoney > 0 ? money(ns, maxMoney) : "-",
    purchased: Boolean(server.purchasedByPlayer),
  };
}

function renderPanel(panel, model, busy = false, queueAction = null) {
  const table = panel.querySelector(".table");
  const scrollTop = table?.scrollTop ?? 0;
  const scrollLeft = table?.scrollLeft ?? 0;
  panel.innerHTML = `
    <style>
      #${PANEL_ID} {
        position: fixed;
        right: 18px;
        top: 72px;
        z-index: 99999;
        width: min(1120px, calc(100vw - 36px));
        max-height: calc(100vh - 100px);
        overflow: hidden;
        background: #111318;
        color: #e6edf3;
        border: 1px solid #303845;
        box-shadow: 0 18px 50px rgba(0,0,0,.45);
        font-family: Inter, Arial, sans-serif;
        font-size: 13px;
      }
      #${PANEL_ID} .bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid #303845;
        background: #181c23;
      }
      #${PANEL_ID} .title { font-size: 15px; font-weight: 700; margin-right: auto; }
      #${PANEL_ID} .stat { color: #aab6c5; white-space: nowrap; }
      #${PANEL_ID} button {
        border: 1px solid #3d4654;
        background: #242a33;
        color: #e6edf3;
        padding: 5px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      #${PANEL_ID} button:hover { background: #2e3743; }
      #${PANEL_ID} button.good { border-color: #2f855a; color: #9ae6b4; }
      #${PANEL_ID} button.warn { border-color: #b7791f; color: #fbd38d; }
      #${PANEL_ID} button.danger { border-color: #9b2c2c; color: #feb2b2; }
      #${PANEL_ID} .host-link {
        border: 0;
        background: transparent;
        color: #93c5fd;
        padding: 0;
        font-family: inherit;
        font-size: inherit;
        text-align: left;
      }
      #${PANEL_ID} .host-link:hover {
        background: transparent;
        color: #bfdbfe;
        text-decoration: underline;
      }
      #${PANEL_ID} .status {
        padding: 8px 12px;
        color: #cbd5e1;
        border-bottom: 1px solid #303845;
      }
      #${PANEL_ID} .table {
        overflow: auto;
        max-height: calc(100vh - 210px);
      }
      #${PANEL_ID} .row {
        display: grid;
        grid-template-columns: minmax(220px, 1fr) 74px 78px 76px 92px 98px 260px;
        gap: 8px;
        align-items: center;
        padding: 6px 10px;
        border-bottom: 1px solid rgba(48,56,69,.55);
      }
      #${PANEL_ID} .head {
        position: sticky;
        top: 0;
        background: #181c23;
        color: #9fb0c2;
        font-weight: 700;
        z-index: 1;
      }
      #${PANEL_ID} .host { font-family: "Lucida Console", Consolas, monospace; white-space: nowrap; }
      #${PANEL_ID} .badge {
        display: inline-block;
        min-width: 48px;
        text-align: center;
        padding: 2px 5px;
        border-radius: 3px;
        background: #2b3440;
        color: #cbd5e1;
      }
      #${PANEL_ID} .ok { background: #153d2a; color: #9ae6b4; }
      #${PANEL_ID} .bad { background: #4a1d1d; color: #feb2b2; }
      #${PANEL_ID} .muted { color: #7d8a99; }
      #${PANEL_ID} .actions { display: flex; flex-wrap: wrap; gap: 5px; }
    </style>
    <div class="bar">
      <div class="title">Network Control</div>
      <div class="stat">root ${model.rooted}/${model.total}</div>
      <div class="stat">ports ${model.ports}/5</div>
      <div class="stat">hack ${model.hack}</div>
      <button type="button" data-action="refresh" ${busy ? "disabled" : ""}>Refresh</button>
      <button type="button" class="good" data-action="root-all" ${busy ? "disabled" : ""}>Root all (${model.eligible})</button>
      <button type="button" class="warn" data-action="backdoor-all" ${!busy && model.singularity ? "" : "disabled"}>Backdoor ready (${model.backdoorReady})</button>
      <button type="button" class="danger" data-action="close">Close</button>
    </div>
    <div class="status">cash ${escapeHtml(model.cashText)} | singularity ${model.singularity ? "yes" : "no"} | ${escapeHtml(model.lastAction)}</div>
    <div class="table">
      <div class="row head">
        <div>Host</div><div>Root</div><div>Ports</div><div>Hack</div><div>RAM</div><div>Money</div><div>Actions</div>
      </div>
      ${model.rows.map((row) => rowHtml(row, busy)).join("")}
    </div>
  `;
  bindPanelButtons(panel, queueAction);
  const nextTable = panel.querySelector(".table");
  if (nextTable) {
    nextTable.scrollTop = scrollTop;
    nextTable.scrollLeft = scrollLeft;
  }
}

function rowHtml(row, busy = false) {
  const indent = row.depth * 18;
  const rootClass = row.root ? "ok" : row.canRoot ? "bad" : "";
  const rootText = row.root ? "root" : row.canRoot ? "ready" : "locked";
  const hackClass = row.canHack ? "ok" : "bad";
  const backdoorText = row.backdoored ? "backdoor" : row.canBackdoor ? "ready" : "";
  return `
    <div class="row">
      <div class="host" style="padding-left:${indent}px">
        ${row.depth ? "L " : ""}
        <button type="button" class="host-link" data-action="connect" data-host="${escapeAttr(row.host)}" ${busy ? "disabled" : ""}>${escapeHtml(row.host)}</button>
        ${row.purchased ? '<span class="muted">cloud</span>' : ""}
      </div>
      <div><span class="badge ${rootClass}">${rootText}</span></div>
      <div>${row.requiredPorts}/5</div>
      <div><span class="badge ${hackClass}">${row.requiredHack}</span></div>
      <div>${escapeHtml(row.ram)}</div>
      <div>${escapeHtml(row.money)}</div>
      <div class="actions">
        <button type="button" class="good" data-action="root" data-host="${escapeAttr(row.host)}" ${!busy && row.canRoot ? "" : "disabled"}>Root</button>
        <button type="button" data-action="connect" data-host="${escapeAttr(row.host)}" ${busy ? "disabled" : ""}>Connect</button>
        <button type="button" class="warn" data-action="backdoor" data-host="${escapeAttr(row.host)}" ${!busy && row.canBackdoor ? "" : "disabled"}>${backdoorText || "Backdoor"}</button>
        <button type="button" class="danger" data-action="kill" data-host="${escapeAttr(row.host)}" ${!busy && row.host !== "home" ? "" : "disabled"}>Kill</button>
      </div>
    </div>
  `;
}

function bindPanelButtons(panel, queueAction) {
  if (!queueAction) return;
  for (const button of panel.querySelectorAll("button[data-action]")) {
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      queueAction(button.dataset.action, button.dataset.host);
      return false;
    };
  }
}

function renderTail(ns, model) {
  ns.clearLog();
  ns.print("NETWORK CONTROL");
  ns.print(`root ${model.rooted}/${model.total} ports ${model.ports}/5 hack ${model.hack}`);
  ns.print(`last: ${model.lastAction}`);
  for (const row of model.rows) {
    ns.print(`${" ".repeat(row.depth * 2)}${row.host} root=${row.root} ports=${row.requiredPorts} hack=${row.requiredHack}`);
  }
}

function rootAll(ns) {
  let rooted = 0;
  let blocked = 0;
  const hosts = scanAll(ns).filter((host) => host !== "home");
  for (const host of hosts) {
    if (ns.hasRootAccess(host)) continue;
    if (tryRoot(ns, host)) rooted++;
    else blocked++;
  }
  return { rooted, blocked };
}

async function backdoorAll(ns) {
  let done = 0;
  let skipped = 0;
  for (const host of scanAll(ns).filter((server) => server !== "home")) {
    const ok = await backdoorHost(ns, host);
    if (ok) done++;
    else skipped++;
    await ns.sleep(25);
  }
  return { done, skipped };
}

async function backdoorHost(ns, host) {
  if (!ns.singularity) return false;
  const server = safe(() => ns.getServer(host), null);
  if (!server || server.backdoorInstalled) return false;
  if (!ns.hasRootAccess(host)) return false;
  if (ns.getServerRequiredHackingLevel(host) > ns.getHackingLevel()) return false;
  if (!connectTo(ns, host)) return false;
  try {
    await ns.singularity.installBackdoor();
    ns.singularity.connect("home");
    return true;
  } catch {
    safe(() => ns.singularity.connect("home"), false);
    return false;
  }
}

function connectTo(ns, host) {
  if (!ns.singularity) return false;
  const path = pathTo(ns, host);
  if (path.length === 0) return false;
  try {
    ns.singularity.connect("home");
    for (const step of path.slice(1)) {
      if (!ns.singularity.connect(step)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function pathTo(ns, target) {
  const queue = [["home"]];
  const seen = new Set(["home"]);
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i];
    const host = path[path.length - 1];
    if (host === target) return path;
    for (const next of ns.scan(host)) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push([...path, next]);
    }
  }
  return [];
}

function portsAvailable(ns) {
  return ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"].filter((program) =>
    ns.fileExists(program, "home"),
  ).length;
}

function createPanel(doc) {
  doc.getElementById(PANEL_ID)?.remove();
  const panel = doc.createElement("div");
  panel.id = PANEL_ID;
  doc.body.appendChild(panel);
  return panel;
}

function getDocument() {
  try {
    return eval("document");
  } catch {
    return null;
  }
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Network Control");
    ns.ui?.resizeTail?.(460, 260);
  } catch {
    // The GUI overlay can still work without a tail window.
  }
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1024) return `${(value / 1024).toFixed(1)}T`;
  if (value >= 1) return value.toFixed(1);
  return String(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
