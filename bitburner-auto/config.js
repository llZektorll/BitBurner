export const CONFIG = {
  mode: "speedrun",
  refreshMs: 5000,
  loaderTail: {
    enabled: true,
    width: 820,
    height: 620,
  },
  budgets: {
    bootstrapHome: 0.95,
    programsHome: 0.5,
    programsServers: 0.25,
    earlyHome: 0.45,
    earlyServers: 0.5,
    fleetServers: 0.7,
    fleetHome: 0.25,
    scaleServers: 0.6,
    scaleHome: 0.35,
    hacknetDefault: 0,
    hacknetPreferred: 0.12,
  },
  thresholds: {
    batchHomeRam: 32,
    singularityHomeRam: 128,
    advancedHomeRam: 256,
    corpHomeRam: 512,
    hacknetMinCash: 10000000,
    stocksCash: 2000000000,
    sideSystemCash: 25000000000,
    corpCash: 200000000000,
    goCash: 25000000000,
  },
  batcher: {
    spacingMs: 120,
    maxBatchesPerPass: 24,
    minPreparedMoneyRatio: 0.95,
    maxSecurityOverMin: 2,
    hackFractions: [0.04, 0.06, 0.08, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5],
    activeTargetPenalty: 0.35,
  },
  servers: {
    maxActionsPerPass: 20,
    minUpgradeMultiplier: 2,
    activeSleepMs: 1000,
    idleSleepMs: 5000,
  },
  scripts: {
    dashboard: { file: "/auto/dashboard.js", enabled: true, minHomeRam: 0 },
    objectives: { file: "/auto/objectives.js", enabled: true, minHomeRam: 0 },
    bitnode: { file: "/auto/bitnode.js", enabled: true, minHomeRam: 32 },
    endgame: { file: "/auto/endgame.js", enabled: true, minHomeRam: 64 },
    root: { file: "/auto/root.js", enabled: true, minHomeRam: 0 },
    early: { file: "/auto/early.js", enabled: true, minHomeRam: 0 },
    servers: { file: "/auto/servers.js", enabled: true, minHomeRam: 32 },
    batcher: { file: "/auto/batcher.js", enabled: true, minHomeRam: 32 },
    manager: { file: "/auto/manager.js", enabled: true, minHomeRam: 32 },
    hacknet: { file: "/auto/hacknet.js", enabled: true, minHomeRam: 32 },
    singularity: { file: "/auto/singularity.js", enabled: true, minHomeRam: 128, requires: "singularity" },
    backdoor: { file: "/auto/backdoor.js", enabled: false, minHomeRam: 128 },
    share: { file: "/auto/share-manager.js", enabled: true, minHomeRam: 128 },
    crime: { file: "/auto/crime.js", enabled: true, minHomeRam: 128, requires: "singularity" },
    training: { file: "/auto/training.js", enabled: true, minHomeRam: 128, requires: "singularity" },
    stocks: { file: "/auto/stocks.js", enabled: true, minHomeRam: 128, requires: "stock" },
    gang: { file: "/auto/gang.js", enabled: true, minHomeRam: 256, requires: "gang" },
    sleeves: { file: "/auto/sleeves.js", enabled: true, minHomeRam: 256, requires: "sleeve" },
    bladeburner: { file: "/auto/bladeburner.js", enabled: true, minHomeRam: 256, requires: "bladeburner" },
    corp: { file: "/auto/corp.js", enabled: true, minHomeRam: 512, requires: "corporation" },
    stanek: { file: "/auto/stanek.js", enabled: true, minHomeRam: 256, requires: "stanek" },
    go: { file: "/auto/go.js", enabled: true, minHomeRam: 256, requires: "go" },
    darknet: { file: "/auto/darknet.js", enabled: true, minHomeRam: 256 },
    contracts: { file: "/auto/contracts.js", enabled: true, minHomeRam: 64 },
    networkGui: { file: "/auto/network-gui.js", enabled: false, minHomeRam: 64 },
  },
};

export function enabledScriptEntries() {
  return Object.entries(CONFIG.scripts).filter(([, spec]) => spec.enabled);
}

export function scriptFile(name) {
  return CONFIG.scripts[name]?.file ?? "";
}
