/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  while (true) {
    const result = await playGo(ns);
    render(ns, result);
    await ns.sleep(5000);
  }
}

async function playGo(ns) {
  if (!ns.go) return { status: "IPvGO API unavailable" };
  try {
    const state = ns.go.getGameState();
    if (state.currentPlayer === "None") {
      ns.go.resetBoardState("Netburners", 5);
      return { status: "reset board" };
    }
    const board = ns.go.getBoardState();
    const move = chooseMove(board);
    if (!move) {
      await ns.go.passTurn();
      return { status: "passed" };
    }
    await ns.go.makeMove(move.x, move.y);
    return { status: `played ${move.x},${move.y}` };
  } catch (error) {
    return { status: `idle: ${String(error)}` };
  }
}

function chooseMove(board) {
  const size = board.length;
  const preferred = [
    [Math.floor(size / 2), Math.floor(size / 2)],
    [1, 1],
    [1, size - 2],
    [size - 2, 1],
    [size - 2, size - 2],
  ];
  for (const [x, y] of preferred) {
    if (board[x]?.[y] === ".") return { x, y };
  }
  let best = null;
  let bestScore = -Infinity;
  for (let x = 0; x < board.length; x++) {
    for (let y = 0; y < board[x].length; y++) {
      if (board[x][y] !== ".") continue;
      const score = liberties(board, x, y) - distanceToEdge(board, x, y) * 0.1;
      if (score > bestScore) {
        best = { x, y };
        bestScore = score;
      }
    }
  }
  return best;
}

function liberties(board, x, y) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => board[x + dx]?.[y + dy] === ".").length;
}

function distanceToEdge(board, x, y) {
  return Math.min(x, y, board.length - 1 - x, board.length - 1 - y);
}

function render(ns, result) {
  ns.clearLog();
  ns.print("AUTO IPVGO");
  ns.print(`status: ${result.status}`);
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto IPvGO");
    ns.ui?.resizeTail?.(480, 260);
  } catch {}
}
