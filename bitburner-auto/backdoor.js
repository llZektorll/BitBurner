import { acquireWorkLock, releaseWorkLock } from "./lib.js";

const PRIORITY = [
  "CSEC",
  "avmnite-02",
  "I.I.I.I",
  "run4theh111z",
  "fulcrumassets",
  "The-Cave",
  "w0r1d_d43m0n",
];

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  while (true) {
    const candidates = backdoorCandidates(ns);
    let action = "idle";

    if (!ns.singularity) {
      render(ns, "fallback: Singularity unavailable, showing manual paths only", candidates);
      await ns.sleep(30000);
      continue;
    }

    for (const host of candidates) {
      const server = ns.getServer(host);
      if (server.backdoorInstalled) continue;
      if (!ns.hasRootAccess(host)) continue;
      if (ns.getServerRequiredHackingLevel(host) > ns.getHackingLevel()) continue;

      const path = pathTo(ns, host);
      if (path.length === 0) continue;
      if (!acquireWorkLock(ns, "backdoor", 100, Math.max(120000, ns.getHackTime(host) + 60000))) continue;

      action = `backdooring ${host}`;
      render(ns, action, candidates);

      if (connectPath(ns, path)) {
        try {
          await ns.singularity.installBackdoor();
          ns.tprint(`backdoor: installed on ${host}.`);
        } catch (error) {
          ns.print(`Failed ${host}: ${String(error)}`);
        }
      }
      ns.singularity.connect("home");
      releaseWorkLock(ns, "backdoor");
      await ns.sleep(1000);
      break;
    }

    render(ns, action, candidates);
    await ns.sleep(30000);
  }
}

function backdoorCandidates(ns) {
  const all = scanAll(ns);
  const priority = PRIORITY.filter((host) => all.includes(host));
  const rest = all
    .filter((host) => !priority.includes(host) && host !== "home")
    .sort((a, b) => ns.getServerRequiredHackingLevel(a) - ns.getServerRequiredHackingLevel(b));
  return [...priority, ...rest];
}

function connectPath(ns, path) {
  ns.singularity.connect("home");
  for (const host of path.slice(1)) {
    if (!ns.singularity.connect(host)) return false;
  }
  return true;
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

function scanAll(ns) {
  const seen = new Set(["home"]);
  const queue = ["home"];
  for (let i = 0; i < queue.length; i++) {
    for (const next of ns.scan(queue[i])) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return [...seen];
}

function render(ns, action, candidates) {
  ns.clearLog();
  ns.print("AUTO BACKDOOR");
  ns.print(`action: ${action}`);
  ns.print(`hacking level: ${ns.getHackingLevel()}`);
  ns.print(`singularity: ${ns.singularity ? "available" : "unavailable"}`);
  ns.print("priority:");
  for (const host of candidates.slice(0, 12)) {
    const s = ns.getServer(host);
    const path = pathTo(ns, host);
    const status = s.backdoorInstalled
      ? "done"
      : !ns.hasRootAccess(host)
        ? "no root"
        : ns.getServerRequiredHackingLevel(host) > ns.getHackingLevel()
          ? `needs hack ${ns.getServerRequiredHackingLevel(host)}`
          : ns.singularity
            ? "ready"
            : `manual path: ${path.join(" > ")}`;
    ns.print(`  ${host}: ${status}`);
  }
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Backdoor");
    ns.ui?.resizeTail?.(560, 420);
  } catch {
    // Backdoor automation still works without the tail API.
  }
}
