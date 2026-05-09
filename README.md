# Bitburner Automation Pack

This is a Netscript 2 automation pack for Bitburner 3.x. It avoids NS1 scripts and includes compatibility fallbacks for the older purchased-server API if `ns.cloud` is not present.

## Install

Copy the `.js` files into the game under `/auto/`:

- `/auto/lib.js`
- `/auto/early.js`
- `/auto/worker.js`
- `/auto/hgw.js`
- `/auto/batcher.js`
- `/auto/share.js`
- `/auto/dashboard.js`
- `/auto/share-manager.js`
- `/auto/objectives.js`
- `/auto/bitnode.js`
- `/auto/endgame.js`
- `/auto/root.js`
- `/auto/manager.js`
- `/auto/servers.js`
- `/auto/hacknet.js`
- `/auto/singularity.js`
- `/auto/backdoor.js`
- `/auto/crime.js`
- `/auto/training.js`
- `/auto/stocks.js`
- `/auto/gang.js`
- `/auto/sleeves.js`
- `/auto/bladeburner.js`
- `/auto/corp.js`
- `/auto/stanek.js`
- `/auto/go.js`
- `/auto/darknet.js`
- `/auto/doctor.js`
- `/auto/controller.js`

Then run:

```text
run /auto/controller.js
```

## GitHub Install/Update

Bootstrap the installer from your GitHub repo:

```text
wget https://raw.githubusercontent.com/llZektorll/BitBurner/main/bitburner-auto/install-auto.js install-auto.js
```

Then run it with your raw GitHub folder URL:

```text
run install-auto.js https://raw.githubusercontent.com/llZektorll/BitBurner/main/bitburner-auto --restart
```

Use `--start` to start after install without killing existing scripts, or `--restart` to kill old `/auto/` scripts first.

If your GitHub branch is `master` instead of `main`, use:

```text
wget https://raw.githubusercontent.com/llZektorll/BitBurner/master/bitburner-auto/install-auto.js install-auto.js
run install-auto.js https://raw.githubusercontent.com/llZektorll/BitBurner/master/bitburner-auto --restart
```

On a fresh save with 8GB home RAM, the controller starts only `/auto/early.js`. After you upgrade home RAM to at least 32GB, it will stop the early loop and start the larger automation daemons.

## What It Automates

- Scans and roots servers as port programs become available.
- Uses a tiny early-game bootstrap loop while `home` has less than 32GB RAM, and deploys `/auto/worker.js` onto rooted starter servers as soon as they have RAM.
- Tracks game milestones in `/auto/objectives.js` and writes `/auto/state-objectives.txt` so spending scripts can follow the current phase.
- Shows a unified live status window in `/auto/dashboard.js`.
- Tracks BitNode-specific strategy in `/auto/bitnode.js` and writes `/auto/state-bitnode.txt`.
- Tracks endgame blockers in `/auto/endgame.js`, including faction unlocks, The Red Pill, augmentations, and `w0r1d_d43m0n`.
- Coordinates character-control scripts with `/auto/state-worklock.txt` so faction work, training, crime, backdoors, and Bladeburner do not fight each other.
- Chooses profitable hack targets based on money, hack level, chance, security, and weaken time.
- Deploys a self-balancing worker loop across rooted servers.
- Uses a batch hacking engine at 512GB+ home RAM, with the older manager as a fallback.
- Buys and upgrades purchased servers using `ns.cloud` when available.
- Buys Hacknet nodes/upgrades with a conservative budget.
- With Singularity unlocked, buys TOR/programs, joins useful factions, works for factions, buys affordable augmentations, and installs them once enough are queued.
- With Singularity unlocked, backdoors eligible rooted servers, prioritizing faction/endgame servers.
- Uses share mode during reputation-heavy phases to boost faction work reputation gain.
- Uses Slums/crime automation when the objective planner calls for early money, combat stats, or karma.
- Uses university, gym, and company work when the endgame planner identifies a stat or company blocker.
- Adds guarded automation for stock trading, gangs, sleeves, Bladeburner, corporations, Stanek charging, and IPvGO when those systems are unlocked and useful.
- Adds guarded Darknet reconnaissance/cache handling through `ns.dnet` when `DarkscapeNavigator.exe` is available.
- Provides `/auto/doctor.js` for install, state, RAM, capability, and stale-process diagnostics.
- `doctor.js --fix` kills stale automation workers and restarts the controller if it is stopped.

## Notes

This is meant to carry a save from early game into late game with minimal babysitting, but Bitburner still has mechanics that are intentionally situational: BitNode choice, Corporation strategy, Bladeburner, Sleeves, Stanek, Gangs, IPvGO, and Darknet. Those are better as specialist modules once your save reaches them.

For Bitburner 3.0.0, check `/APIBreakInfo-3.0.0.txt` on `home` if any script complains after game updates.
