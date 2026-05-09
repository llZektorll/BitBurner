const DEFAULT_OPPONENT = "Netburners";
const DEFAULT_SIZE = 5;
const STATE_FILE = "/auto/state-go.txt";
const AUTO_OPPONENTS = ["Netburners", "Slum Snakes", "The Black Hand", "Tetrads", "Daedalus", "Illuminati"];
const HARD_OPPONENTS = new Set(["Illuminati", "Daedalus"]);

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  const preferredOpponent = String(ns.args[0] ?? "auto");
  const preferredSize = Number(ns.args[1] ?? DEFAULT_SIZE);

  while (true) {
    try {
      const memory = readMemory(ns);
      const result = await playGo(ns, preferredOpponent, preferredSize, memory);
      render(ns, result, memory);
      await ns.sleep(result.delay ?? 100);
    } catch (error) {
      ns.print(`loop recovered: ${String(error)}`);
      await ns.sleep(1000);
    }
  }
}

async function playGo(ns, preferredOpponent, preferredSize, memory) {
  if (!ns.go) return { status: "IPvGO API unavailable", delay: 5000 };
  try {
    const state = ns.go.getGameState();
    const currentPlayer = safe(() => ns.go.getCurrentPlayer(), state.currentPlayer);
    const opponent = safe(() => ns.go.getOpponent(), DEFAULT_OPPONENT);
    if (currentPlayer === "None") {
      recordGame(ns, memory, opponent, state);
      return resetGame(ns, preferredOpponent, preferredSize, opponent, "game over", memory);
    }
    if (currentPlayer === "White") {
      const response = await ns.go.passTurn();
      if (response.type === "gameOver") {
        recordGame(ns, memory, opponent, safe(() => ns.go.getGameState(), state));
        return resetGame(ns, preferredOpponent, preferredSize, opponent, "opponent finished game", memory);
      }
      return { status: `waiting for opponent -> ${response.type}` };
    }

    const board = ns.go.getBoardState();
    const history = safe(() => ns.go.getMoveHistory(), []);
    const move = chooseMove(board, history, opponent);
    if (!move) {
      const response = await ns.go.passTurn();
      if (response.type === "gameOver") {
        recordGame(ns, memory, opponent, safe(() => ns.go.getGameState(), state));
        return resetGame(ns, preferredOpponent, preferredSize, opponent, "no moves left", memory);
      }
      return { status: `passed -> ${response.type}` };
    }
    safe(() => ns.go.analysis.clearAllPointHighlights(), null);
    safe(() => ns.go.analysis.highlightPoint(move.x, move.y, "hack", String(Math.round(move.score))), null);
    const response = await ns.go.makeMove(move.x, move.y);
    if (response.type === "gameOver") {
      recordGame(ns, memory, opponent, safe(() => ns.go.getGameState(), state));
      return resetGame(ns, preferredOpponent, preferredSize, opponent, "game ended after move", memory);
    }
    return { status: `played ${move.x},${move.y} score=${move.score.toFixed(1)} -> ${response.type}` };
  } catch (error) {
    return { status: `idle/recovered: ${String(error)}`, delay: 1000 };
  }
}

function resetGame(ns, preferredOpponent, preferredSize, currentOpponent, reason, memory) {
  const selection = selectNextGame(preferredOpponent, preferredSize, currentOpponent, memory);
  ns.go.resetBoardState(selection.opponent, selection.size);
  memory.active = { opponent: selection.opponent, size: selection.size, started: Date.now(), reason: selection.reason };
  writeMemory(ns, memory);
  return { status: `${reason}; reset board vs ${selection.opponent} ${selection.size}x${selection.size} (${selection.reason})` };
}

function selectNextGame(preferredOpponent, preferredSize, currentOpponent, memory) {
  const fixedOpponent = preferredOpponent && preferredOpponent.toLowerCase() !== "auto" ? preferredOpponent : "";
  const fixedSize = [5, 7, 9, 13].includes(preferredSize) ? preferredSize : 0;
  if (fixedOpponent) return { opponent: fixedOpponent, size: fixedSize || DEFAULT_SIZE, reason: "manual" };

  const candidates = AUTO_OPPONENTS.flatMap((opponent) => autoSizesFor(opponent, fixedSize).map((size) => ({ opponent, size })));
  const scored = candidates
    .map((candidate) => ({ ...candidate, score: gameCandidateScore(candidate, memory, currentOpponent) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0] ?? { opponent: currentOpponent || DEFAULT_OPPONENT, size: fixedSize || DEFAULT_SIZE, score: 0 };
  return { opponent: best.opponent, size: best.size, reason: `auto score ${best.score.toFixed(1)}` };
}

function autoSizesFor(opponent, fixedSize) {
  if (fixedSize) return [fixedSize];
  if (opponent === "Illuminati" || opponent === "Daedalus") return [5];
  if (opponent === "Tetrads" || opponent === "The Black Hand") return [5, 7];
  return [5, 7, 9];
}

function gameCandidateScore(candidate, memory, currentOpponent) {
  const key = gameKey(candidate.opponent, candidate.size);
  const stats = memory.stats?.[key] ?? {};
  const games = stats.games ?? 0;
  const wins = stats.wins ?? 0;
  const losses = stats.losses ?? 0;
  const winRate = games > 0 ? wins / games : baseWinRate(candidate.opponent, candidate.size);
  const difficultyReward = AUTO_OPPONENTS.indexOf(candidate.opponent) * 8 + candidate.size * 1.5;
  const maxWins = Math.max(0, ...Object.values(memory.stats ?? {}).map((entry) => entry.wins ?? 0));
  const balanceReward = Math.max(0, maxWins - wins) * 10;
  const bonusCycles = memory.lastBonusCycles ?? 0;
  const safeBonus = bonusCycles > 0 && winRate >= 0.65 ? 18 : 0;
  const riskPenalty = bonusCycles > 0 && winRate < 0.5 ? 20 : 0;
  const consistency = winRate * 100 - losses * 4;
  const explore = games < 3 ? 18 - games * 5 : 0;
  const avoidStreakLoss = (stats.lossStreak ?? 0) * 22;
  const keepBonus = currentOpponent === candidate.opponent ? 4 : 0;
  return consistency + difficultyReward + balanceReward + safeBonus + explore + keepBonus - avoidStreakLoss - riskPenalty;
}

function baseWinRate(opponent, size) {
  const base = {
    Netburners: 0.9,
    "Slum Snakes": 0.82,
    "The Black Hand": 0.68,
    Tetrads: 0.62,
    Daedalus: 0.38,
    Illuminati: 0.25,
  }[opponent] ?? 0.5;
  return Math.max(0.15, base - (size - 5) * 0.05);
}

function recordGame(ns, memory, opponent, state) {
  const board = safe(() => ns.go.getBoardState(), []);
  const size = board.length || memory.active?.size || DEFAULT_SIZE;
  const key = gameKey(opponent, size);
  const blackScore = Number(state?.blackScore ?? 0);
  const whiteScore = Number(state?.whiteScore ?? 0);
  const won = blackScore > whiteScore;
  if (memory.lastRecorded?.key === key && memory.lastRecorded?.blackScore === blackScore && memory.lastRecorded?.whiteScore === whiteScore) return;
  const stats = memory.stats?.[key] ?? { games: 0, wins: 0, losses: 0, winStreak: 0, lossStreak: 0 };
  stats.games++;
  stats.wins += won ? 1 : 0;
  stats.losses += won ? 0 : 1;
  stats.winStreak = won ? (stats.winStreak ?? 0) + 1 : 0;
  stats.lossStreak = won ? 0 : (stats.lossStreak ?? 0) + 1;
  stats.lastScore = `${blackScore}-${whiteScore}`;
  stats.lastResult = won ? "win" : "loss";
  stats.lastTime = Date.now();
  memory.lastBonusCycles = Number(state?.bonusCycles ?? memory.lastBonusCycles ?? 0);
  memory.stats = memory.stats ?? {};
  memory.stats[key] = stats;
  memory.lastRecorded = { key, blackScore, whiteScore };
  writeMemory(ns, memory);
}

function chooseMove(board, history, opponent) {
  const profile = profileFor(opponent, board.length);
  const moves = [];
  for (let x = 0; x < board.length; x++) {
    for (let y = 0; y < board[x].length; y++) {
      const sim = simulateMove(board, x, y);
      if (!sim || repeatsHistory(sim, history)) continue;
      const score = scoreMove(board, sim, x, y, profile);
      if (score > profile.minScore) moves.push({ x, y, score });
    }
  }
  moves.sort((a, b) => b.score - a.score);
  return moves[0] ?? null;
}

function scoreMove(board, sim, x, y, profile) {
  const captured = countStones(board, "O") - countStones(sim, "O");
  const ownGroup = groupAt(sim, x, y);
  const ownLibs = liberties(sim, ownGroup).size;
  const adjacentEnemy = neighbors(sim, x, y)
    .filter(([nx, ny]) => sim[nx][ny] === "O")
    .map(([nx, ny]) => groupAt(sim, nx, ny));
  const enemyPressure = adjacentEnemy.reduce((sum, group) => sum + Math.max(0, 4 - liberties(sim, group).size), 0);
  const rescue = endangeredOwnNeighbor(board, x, y) ? profile.rescueWeight : 0;
  const captureScore = captured * profile.captureWeight;
  const libertyScore = ownLibs * profile.libertyWeight;
  const shapeScore = shapeValue(board, x, y) * profile.shapeWeight;
  const territoryScore = territoryValue(board, x, y) * profile.territoryWeight;
  const replyPenalty = profile.lookaheadWeight > 0 ? bestOpponentReplyScore(sim) * profile.lookaheadWeight : 0;
  const eyePenalty = isLikelyOwnEye(board, x, y) && captured === 0 ? -60 : 0;
  const atariPenalty = ownLibs <= 1 && captured === 0 ? profile.atariPenalty : 0;

  return (
    captureScore +
    rescue +
    enemyPressure * profile.pressureWeight +
    libertyScore +
    shapeScore +
    territoryScore +
    eyePenalty +
    atariPenalty -
    replyPenalty
  );
}

function simulateMove(board, x, y) {
  return simulateColorMove(board, x, y, "X", "O");
}

function simulateColorMove(board, x, y, color, enemy) {
  if (board[x]?.[y] !== ".") return null;
  const sim = cloneBoard(board);
  sim[x] = replaceAt(sim[x], y, color);
  removeCaptured(sim, enemy);
  const ownGroup = groupAt(sim, x, y);
  if (liberties(sim, ownGroup).size === 0) return null;
  return sim;
}

function bestOpponentReplyScore(board) {
  let best = 0;
  for (let x = 0; x < board.length; x++) {
    for (let y = 0; y < board[x].length; y++) {
      const sim = simulateColorMove(board, x, y, "O", "X");
      if (!sim) continue;
      const capturedOwn = countStones(board, "X") - countStones(sim, "X");
      const enemyGroup = groupAt(sim, x, y);
      const enemyLibs = liberties(sim, enemyGroup).size;
      const ownAtari = neighbors(sim, x, y)
        .filter(([nx, ny]) => sim[nx][ny] === "X")
        .reduce((sum, [nx, ny]) => sum + (liberties(sim, groupAt(sim, nx, ny)).size <= 1 ? 1 : 0), 0);
      const score = capturedOwn * 70 + ownAtari * 28 + enemyLibs * 3;
      if (score > best) best = score;
    }
  }
  return best;
}

function profileFor(opponent, size) {
  const hard = [...HARD_OPPONENTS].some((name) => name.toLowerCase() === String(opponent).toLowerCase());
  if (!hard) {
    return {
      minScore: -50,
      captureWeight: 45,
      rescueWeight: 18,
      libertyWeight: 5,
      pressureWeight: 7,
      shapeWeight: 1,
      territoryWeight: 1,
      lookaheadWeight: 0,
      atariPenalty: -80,
    };
  }
  return {
    minScore: -15,
    captureWeight: 58,
    rescueWeight: 34,
    libertyWeight: 10,
    pressureWeight: 5,
    shapeWeight: 0.7,
    territoryWeight: 0.75,
    lookaheadWeight: size <= 7 ? 0.95 : 0.25,
    atariPenalty: -140,
  };
}

function removeCaptured(board, color) {
  const seen = new Set();
  for (let x = 0; x < board.length; x++) {
    for (let y = 0; y < board[x].length; y++) {
      if (board[x][y] !== color) continue;
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      const group = groupAt(board, x, y);
      for (const p of group) seen.add(`${p[0]},${p[1]}`);
      if (liberties(board, group).size === 0) {
        for (const [gx, gy] of group) board[gx] = replaceAt(board[gx], gy, ".");
      }
    }
  }
}

function groupAt(board, x, y) {
  const color = board[x]?.[y];
  if (!color || color === "." || color === "#") return [];
  const out = [];
  const seen = new Set([`${x},${y}`]);
  const queue = [[x, y]];
  for (let i = 0; i < queue.length; i++) {
    const [cx, cy] = queue[i];
    out.push([cx, cy]);
    for (const [nx, ny] of neighbors(board, cx, cy)) {
      const key = `${nx},${ny}`;
      if (!seen.has(key) && board[nx][ny] === color) {
        seen.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  return out;
}

function liberties(board, group) {
  const libs = new Set();
  for (const [x, y] of group) {
    for (const [nx, ny] of neighbors(board, x, y)) {
      if (board[nx][ny] === ".") libs.add(`${nx},${ny}`);
    }
  }
  return libs;
}

function endangeredOwnNeighbor(board, x, y) {
  return neighbors(board, x, y).some(([nx, ny]) => {
    if (board[nx][ny] !== "X") return false;
    const group = groupAt(board, nx, ny);
    return liberties(board, group).size <= 1;
  });
}

function isLikelyOwnEye(board, x, y) {
  const adjacent = neighbors(board, x, y);
  if (adjacent.length < 3) return false;
  return adjacent.every(([nx, ny]) => board[nx][ny] === "X" || board[nx][ny] === "#");
}

function shapeValue(board, x, y) {
  const size = board.length;
  const center = (size - 1) / 2;
  const distCenter = Math.abs(x - center) + Math.abs(y - center);
  const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
  let score = 0;
  if (size === 5) score += edge === 1 ? 8 : 0;
  else score += edge >= 1 && edge <= 2 ? 8 : 0;
  score -= distCenter * 0.7;
  for (const [nx, ny] of neighbors(board, x, y)) {
    if (board[nx][ny] === "X") score += 6;
    if (board[nx][ny] === "O") score += 4;
  }
  return score;
}

function territoryValue(board, x, y) {
  let own = 0;
  let enemy = 0;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const nx = x + dx;
      const ny = y + dy;
      const value = board[nx]?.[ny];
      if (value === "X") own++;
      if (value === "O") enemy++;
    }
  }
  return own * 1.5 + enemy * 2;
}

function repeatsHistory(board, history) {
  if (!Array.isArray(history)) return false;
  const signature = board.join("|");
  return history.some((past) => Array.isArray(past) && past.join("|") === signature);
}

function neighbors(board, x, y) {
  return [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ].filter(([nx, ny]) => board[nx]?.[ny] !== undefined && board[nx][ny] !== "#");
}

function cloneBoard(board) {
  return board.map((col) => String(col));
}

function replaceAt(text, index, ch) {
  return text.slice(0, index) + ch + text.slice(index + 1);
}

function countStones(board, color) {
  return board.reduce((sum, col) => sum + col.split("").filter((cell) => cell === color).length, 0);
}

function gameKey(opponent, size) {
  return `${opponent}|${size}`;
}

function readMemory(ns) {
  try {
    if (!ns.fileExists(STATE_FILE, "home")) return { stats: {}, active: null, lastRecorded: null, lastBonusCycles: 0 };
    const parsed = JSON.parse(ns.read(STATE_FILE));
    return {
      stats: parsed.stats ?? {},
      active: parsed.active ?? null,
      lastRecorded: parsed.lastRecorded ?? null,
      lastBonusCycles: parsed.lastBonusCycles ?? 0,
    };
  } catch {
    return { stats: {}, active: null, lastRecorded: null, lastBonusCycles: 0 };
  }
}

function writeMemory(ns, memory) {
  try {
    ns.write(STATE_FILE, JSON.stringify(memory), "w");
  } catch {
    // The game loop must keep running even if state persistence is unavailable.
  }
}

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function render(ns, result, memory) {
  ns.clearLog();
  ns.print("AUTO IPVGO");
  ns.print(`status: ${result.status}`);
  ns.print(`opponent: ${safe(() => ns.go.getOpponent(), "unknown")}`);
  if (memory.active) ns.print(`auto target: ${memory.active.opponent} ${memory.active.size}x${memory.active.size}`);
  const state = safe(() => ns.go.getGameState(), null);
  if (state) {
    ns.print(`turn: ${state.currentPlayer}`);
    ns.print(`score: black ${state.blackScore} / white ${state.whiteScore} komi ${state.komi}`);
    ns.print(`bonus cycles: ${state.bonusCycles}`);
  }
  ns.print(`last bonus cycles: ${memory.lastBonusCycles ?? 0}`);
  const recent = Object.entries(memory.stats ?? {})
    .sort((a, b) => (b[1].lastTime ?? 0) - (a[1].lastTime ?? 0))
    .slice(0, 5);
  for (const [key, stats] of recent) {
    const rate = stats.games ? ((stats.wins / stats.games) * 100).toFixed(0) : "0";
    ns.print(`${key}: ${stats.wins}/${stats.games} ${rate}% ${stats.lastResult ?? ""} ${stats.lastScore ?? ""}`);
  }
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto IPvGO");
    ns.ui?.resizeTail?.(560, 340);
  } catch {
    // IPvGO automation still works without a tail window.
  }
}
