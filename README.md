# BitBurner Automation Pack

Full-game automation suite for Bitburner 3.x: fast early money, aggressive rooting, batch hacking from 32GB home RAM, purchased-server scaling, faction/endgame planning, contracts, stocks, gangs, sleeves, Bladeburner, Corporation, Stanek, IPvGO, and Darknet reconnaissance.

The goal is simple:

```text
fresh save -> first money -> rooted network -> batch income -> augmentations -> Red Pill -> w0r1d_d43m0n
```

## Quick Install

Copy this into the Bitburner terminal:

```text
wget https://raw.githubusercontent.com/llZektorll/BitBurner/main/bitburner-auto/install-auto.js install-auto.js
run install-auto.js https://raw.githubusercontent.com/llZektorll/BitBurner/main/bitburner-auto --restart
```

If your GitHub branch is `master`:

```text
wget https://raw.githubusercontent.com/llZektorll/BitBurner/master/bitburner-auto/install-auto.js install-auto.js
run install-auto.js https://raw.githubusercontent.com/llZektorll/BitBurner/master/bitburner-auto --restart
```

After install, the main script is:

```text
run auto/controller.js
```

Optional network GUI:

```text
run auto/network-gui.js
```

It opens a live map of the network with buttons for root-all, per-server root, connect, backdoor, and killing scripts on a selected host. Clicking a server name tries to root it first, then connects to it when Singularity is available.

If Singularity is not unlocked yet, automatic connect/backdoor/faction/training/crime actions are disabled or shown as manual fallback. Rooting, nuking, hacking, batch income, purchased servers, and the network map still work.

## Why This Pack Is Fast

- **Money engine first**: early/mid game prioritizes hacking income, home RAM, port programs, and purchased servers.
- **Aggressive rooter**: `/auto/root.js` loops continuously and nukes every eligible server as soon as port programs appear.
- **Speedrun economy**: the batcher keeps a pipeline of batches in flight instead of waiting for one cycle to finish.
- **Priority startup**: when unlocked and RAM allows it, the controller starts root, purchased servers, batcher, and Singularity before lower-priority side systems.
- **Early distributed hacking**: `/auto/early.js` uses rooted starter servers as worker RAM before the full batcher is active.
- **Batch hacking at 32GB+**: `/auto/batcher.js` replaces the simple manager once home RAM reaches 32GB.
- **Formulas-aware**: if `Formulas.exe` exists, the batcher uses formulas for better target scoring and thread tuning.
- **Not everything runs at once**: objectives and controller gate side systems until they are actually useful.

## First Run Checklist

With a fresh 8GB home server:

```text
run auto/controller.js
tail auto/dashboard.js
tail auto/root.js
```

Expected early behavior:

```text
early.js running
root.js running
dashboard.js running
objectives.js running
manager/batcher depending on RAM
```

Your first big manual goal is still:

```text
upgrade home RAM to 32GB
```

At 32GB, the pack starts using the batch hacking engine.

## RAM Tiers

```text
8GB home
  controller + dashboard + objectives + early bootstrap
  roots starter servers
  uses rooted starter RAM where possible

32GB home
  batcher activates
  stronger target prep
  better money scaling

128GB home
  Singularity helpers become practical
  home upgrades, programs, factions, backdoors, training, crime

256GB+ home
  advanced systems can activate when useful
  stocks, gangs, sleeves, Bladeburner, Stanek, IPvGO

512GB+ home
  corporation automation can activate when money/objectives justify it
```

## Main Command Center

Use the dashboard instead of opening ten windows:

```text
tail auto/dashboard.js
```

It shows:

```text
cash / hacking / home RAM
root progress and ports
current objective phase
BitNode strategy
endgame blocker
reset decision
work lock owner
budgets
active goals
running modules
```

## Progression Flow

### Phase 1: Bootstrap

Scripts involved:

```text
controller.js
dashboard.js
objectives.js
root.js
early.js
worker.js
```

What happens:

- Roots 0-port starter servers.
- Farms early money and hacking XP.
- Deploys workers to rooted starter servers.
- Pushes toward 32GB home RAM.

### Phase 2: Money Engine

Scripts involved:

```text
batcher.js
hgw.js
servers.js
root.js
objectives.js
```

What happens:

- Batcher preps targets by weakening/growing.
- Launches coordinated hack/grow/weaken batches.
- Buys/upgrades purchased servers.
- Keeps rooting new servers as soon as port programs are available.

### Phase 3: Programs and Network Control

Scripts involved:

```text
singularity.js
root.js
network-gui.js
backdoor.js
darknet.js
```

What happens:

- Buys TOR/programs when Singularity is available.
- Prioritizes port openers:

```text
BruteSSH.exe
FTPCrack.exe
relaySMTP.exe
HTTPWorm.exe
SQLInject.exe
```

- Backdoors faction/endgame servers.
- Handles guarded Darknet reconnaissance once `DarkscapeNavigator.exe` exists.

### Phase 4: Factions and Augmentations

Scripts involved:

```text
endgame.js
singularity.js
share-manager.js
training.js
crime.js
```

What happens:

- Tracks faction blockers.
- Works for useful factions.
- Uses `share()` during rep-heavy phases.
- Buys high-value augmentations.
- Installs augmentations when the reset strategy says it is worth it.

### Phase 5: Late-Game Systems

Guarded modules activate only when useful/unlocked:

```text
stocks.js
gang.js
sleeves.js
bladeburner.js
corp.js
stanek.js
go.js
contracts.js
```

These modules are intentionally guarded. If an API is locked in your BitNode, they idle instead of crashing.

IPvGO defaults to auto mode:

```text
run auto/go.js
```

It keeps running forever, records results in `/auto/state-go.txt`, and rotates opponent/board size to balance win rate and bonus progress. Manual override still works:

```text
run auto/go.js "Illuminati" 5
```

## BitNode Strategy

`/auto/bitnode.js` writes:

```text
/auto/state-bitnode.txt
```

The objective planner uses it to shift priorities:

```text
BN2  -> gangs
BN3  -> corporation
BN6/7 -> Bladeburner
BN8  -> stocks
BN9  -> Hacknet
BN10 -> sleeves
BN13 -> Stanek
BN14 -> IPvGO
default -> hacking/batching
```

## Diagnostics

Run:

```text
run auto/doctor.js
```

Repair common stale-process issues:

```text
run auto/doctor.js --fix
```

Doctor checks:

```text
missing files
controller status
state files
RAM costs
API capabilities
root progress
stale share workers
old workers running while batcher is active
removed formatter usage
```

## Manual Utilities

Solve contracts once:

```text
run auto/contracts.js
```

Solve contracts continuously:

```text
run auto/contracts.js --loop
```

Clean only automation files:

```text
run reset-auto.js --dry
run reset-auto.js
```

Wipe all files on home, dangerous:

```text
run wipe-all-files.js --confirm
```

## Full File List

Core:

```text
/auto/controller.js
/auto/lib.js
/auto/dashboard.js
/auto/objectives.js
/auto/bitnode.js
/auto/endgame.js
/auto/doctor.js
```

Hacking:

```text
/auto/early.js
/auto/worker.js
/auto/hgw.js
/auto/batcher.js
/auto/manager.js
/auto/root.js
/auto/network-gui.js
/auto/servers.js
/auto/hacknet.js
```

Character and progression:

```text
/auto/singularity.js
/auto/backdoor.js
/auto/share.js
/auto/share-manager.js
/auto/crime.js
/auto/training.js
```

Advanced systems:

```text
/auto/stocks.js
/auto/gang.js
/auto/sleeves.js
/auto/bladeburner.js
/auto/corp.js
/auto/stanek.js
/auto/go.js
/auto/darknet.js
/auto/contracts.js
```

Installer:

```text
install-auto.js
```

## Troubleshooting

### `wget` gives 404

Check branch/path:

```text
main vs master
bitburner-auto folder exists
GitHub repo is public
file name casing is exact
```

### Stocks are not trading

Open:

```text
tail auto/stocks.js
```

Expected statuses:

```text
waiting for TIX API
active momentum
active 4S
```

Without 4S, it uses momentum. With 4S, it uses forecast/volatility.

### Root is too slow

Open:

```text
tail auto/root.js
```

Check:

```text
ports available: N/5
rooted: X/Y
blocked: server(requiredPorts)
```

If ports are missing, you need port programs. With Singularity unlocked, `singularity.js` buys them automatically.

### Too many windows

Use only:

```text
tail auto/dashboard.js
```

The dashboard summarizes the rest.

## Version Notes

- Built for Bitburner 3.x.
- Uses Netscript 2 only.
- Avoids NS1.
- Uses `ns.cloud` for purchased servers when available.
- Uses `ns.dnet` for guarded Darknet reconnaissance.
- Avoids removed formatters like `ns.nFormat()` and `ns.formatNumber()`.
