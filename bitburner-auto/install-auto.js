const FILES = [
  "Loader.js",
  "config.js",
  "controller.js",
  "lib.js",
  "dashboard.js",
  "objectives.js",
  "bitnode.js",
  "endgame.js",
  "early.js",
  "worker.js",
  "hgw.js",
  "batcher.js",
  "manager.js",
  "root.js",
  "network-gui.js",
  "servers.js",
  "hacknet.js",
  "singularity.js",
  "backdoor.js",
  "share.js",
  "share-manager.js",
  "crime.js",
  "training.js",
  "stocks.js",
  "gang.js",
  "sleeves.js",
  "bladeburner.js",
  "corp.js",
  "stanek.js",
  "go.js",
  "darknet.js",
  "contracts.js",
  "doctor.js",
  "README.md",
  "implementation.md",
];

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const base = String(ns.args[0] ?? "").replace(/\/+$/, "");
  const start = ns.args.includes("--start");
  const restart = ns.args.includes("--restart");

  if (!base) {
    ns.tprint("Usage:");
    ns.tprint("  run install-auto.js https://raw.githubusercontent.com/llZektorll/BitBurner/main/bitburner-auto --restart");
    return;
  }

  ns.tprint(`installer: source ${base}`);
  if (restart) killAuto(ns);

  let ok = 0;
  let failed = 0;
  for (const file of FILES) {
    const url = `${base}/${file}`;
    const dest = `/auto/${file}`;
    const success = await ns.wget(url, dest, "home");
    if (success) {
      ok++;
      ns.tprint(`installed ${dest}`);
    } else {
      failed++;
      ns.tprint(`FAILED ${dest} from ${url}`);
    }
    await ns.sleep(25);
  }

  ns.tprint(`installer: ${ok} installed, ${failed} failed.`);
  if ((start || restart) && failed === 0) {
    const pid = ns.run("/auto/controller.js", 1);
    ns.tprint(pid ? `installer: started controller pid=${pid}` : "installer: could not start controller, probably RAM.");
  }
}

function killAuto(ns) {
  for (const host of scanAll(ns)) {
    for (const proc of ns.ps(host)) {
      if (String(proc.filename).startsWith("/auto/") || String(proc.filename).startsWith("auto/")) {
        ns.kill(proc.pid);
      }
    }
  }
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
