/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const confirmed = ns.args.includes("--confirm");
  const includeRemote = ns.args.includes("--remote");
  const keepSelf = ns.args.includes("--keep-self");
  const self = ns.getScriptName();
  const hosts = includeRemote ? scanAll(ns) : ["home"];

  let killed = 0;
  let removed = 0;
  const skipped = [];

  ns.tprint(confirmed ? "WIPE CONFIRMED." : "DRY RUN ONLY. Add --confirm to actually delete files.");
  ns.tprint(includeRemote ? "Scope: home + all reachable servers." : "Scope: home only. Add --remote to include all reachable servers.");

  for (const host of hosts) {
    for (const proc of ns.ps(host)) {
      if (host === "home" && keepSelf && proc.filename === self) continue;
      if (confirmed) ns.kill(proc.pid);
      killed++;
    }
  }

  await ns.sleep(200);

  for (const host of hosts) {
    for (const file of ns.ls(host)) {
      if (host === "home" && keepSelf && normalize(file) === normalize(self)) {
        skipped.push(`${host}:${file}`);
        continue;
      }
      if (confirmed) {
        if (ns.rm(file, host)) removed++;
        else skipped.push(`${host}:${file}`);
      } else {
        removed++;
      }
    }
  }

  ns.tprint(`${confirmed ? "Killed" : "Would kill"} ${killed} process(es).`);
  ns.tprint(`${confirmed ? "Removed" : "Would remove"} ${removed} file(s).`);
  if (skipped.length > 0) {
    ns.tprint(`Skipped ${skipped.length} file(s):`);
    for (const item of skipped.slice(0, 20)) ns.tprint(`  ${item}`);
    if (skipped.length > 20) ns.tprint(`  ...and ${skipped.length - 20} more`);
  }
}

function normalize(path) {
  return String(path).replace(/^\/+/, "");
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
