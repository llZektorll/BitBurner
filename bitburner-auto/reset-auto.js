const AUTO_PREFIX = "/auto/";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const dryRun = ns.args.includes("--dry");

  const hosts = scanAll(ns);
  let killed = 0;
  let removed = 0;

  for (const host of hosts) {
    for (const proc of ns.ps(host)) {
      if (isAutoFile(proc.filename)) {
        if (!dryRun) ns.kill(proc.pid);
        killed++;
      }
    }
  }

  await ns.sleep(200);

  for (const host of hosts) {
    for (const file of ns.ls(host)) {
      if (!isAutoFile(file)) continue;
      if (!dryRun && ns.rm(file, host)) removed++;
      if (dryRun) removed++;
    }
  }

  ns.tprint(`${dryRun ? "DRY RUN: would kill" : "Killed"} ${killed} /auto process(es).`);
  ns.tprint(`${dryRun ? "DRY RUN: would remove" : "Removed"} ${removed} /auto file(s).`);
  ns.tprint("Done. Upload the new /auto files, then run: run auto/controller.js");
}

function isAutoFile(file) {
  return file === "/auto" || file.startsWith(AUTO_PREFIX) || file.startsWith("auto/");
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
