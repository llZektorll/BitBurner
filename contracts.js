/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  openWindow(ns);

  const loop = ns.args.includes("--loop");
  do {
    const result = await solveAll(ns);
    ns.clearLog();
    ns.print("AUTO CONTRACTS");
    ns.print(`found: ${result.found}`);
    ns.print(`solved: ${result.solved}`);
    ns.print(`failed: ${result.failed}`);
    ns.print(`unknown: ${result.unknown}`);
    for (const line of result.lines.slice(-40)) ns.print(line);
    if (!loop) break;
    await ns.sleep(60000);
  } while (true);
}

async function solveAll(ns) {
  const lines = [];
  let found = 0;
  let solved = 0;
  let failed = 0;
  let unknown = 0;

  for (const host of scanAll(ns)) {
    for (const file of ns.ls(host, ".cct")) {
      found++;
      const type = ns.codingcontract.getContractType(file, host);
      const data = ns.codingcontract.getData(file, host);
      const solver = SOLVERS[type];
      if (!solver) {
        unknown++;
        lines.push(`UNKNOWN ${host}/${file}: ${type}`);
        continue;
      }

      let answer;
      try {
        answer = solver(clone(data));
      } catch (error) {
        failed++;
        lines.push(`ERROR ${host}/${file}: ${type} - ${String(error)}`);
        continue;
      }

      const reward = ns.codingcontract.attempt(answer, file, host, { returnReward: true });
      if (reward) {
        solved++;
        lines.push(`SOLVED ${host}/${file}: ${type} -> ${reward}`);
      } else {
        failed++;
        lines.push(`FAILED ${host}/${file}: ${type} answer=${JSON.stringify(answer)}`);
      }
    }
  }

  return { found, solved, failed, unknown, lines };
}

const SOLVERS = {
  "Find Largest Prime Factor": largestPrimeFactor,
  "Subarray with Maximum Sum": maxSubarraySum,
  "Total Ways to Sum": totalWaysToSum,
  "Total Ways to Sum II": totalWaysToSum2,
  "Spiralize Matrix": spiralize,
  "Array Jumping Game": arrayJumpingGame,
  "Array Jumping Game II": arrayJumpingGame2,
  "Merge Overlapping Intervals": mergeIntervals,
  "Generate IP Addresses": generateIps,
  "Algorithmic Stock Trader I": stock1,
  "Algorithmic Stock Trader II": stock2,
  "Algorithmic Stock Trader III": (data) => stockK(2, data),
  "Algorithmic Stock Trader IV": ([k, prices]) => stockK(k, prices),
  "Minimum Path Sum in a Triangle": minTrianglePath,
  "Unique Paths in a Grid I": ([rows, cols]) => uniquePaths1(rows, cols),
  "Unique Paths in a Grid II": uniquePaths2,
  "Shortest Path in a Grid": shortestGridPath,
  "Sanitize Parentheses in Expression": sanitizeParens,
  "Find All Valid Math Expressions": findMathExpressions,
  "HammingCodes: Integer to Encoded Binary": hammingEncode,
  "HammingCodes: Encoded Binary to Integer": hammingDecode,
  "Proper 2-Coloring of a Graph": twoColorGraph,
  "Compression I: RLE Compression": rle,
  "Compression II: LZ Decompression": lzDecompress,
  "Compression III: LZ Compression": lzCompress,
  "Encryption I: Caesar Cipher": caesar,
  "Encryption II: Vigenere Cipher": vigenere,
};

function largestPrimeFactor(n) {
  let factor = 2;
  let last = 1;
  while (factor * factor <= n) {
    if (n % factor === 0) {
      last = factor;
      n = Math.floor(n / factor);
      while (n % factor === 0) n = Math.floor(n / factor);
    }
    factor += factor === 2 ? 1 : 2;
  }
  return n > 1 ? n : last;
}

function maxSubarraySum(data) {
  let best = data[0];
  let current = data[0];
  for (let i = 1; i < data.length; i++) {
    current = Math.max(data[i], current + data[i]);
    best = Math.max(best, current);
  }
  return best;
}

function totalWaysToSum(n) {
  const ways = Array(n + 1).fill(0);
  ways[0] = 1;
  for (let part = 1; part < n; part++) {
    for (let sum = part; sum <= n; sum++) ways[sum] += ways[sum - part];
  }
  return ways[n];
}

function totalWaysToSum2([target, nums]) {
  const ways = Array(target + 1).fill(0);
  ways[0] = 1;
  for (const num of nums) {
    for (let sum = num; sum <= target; sum++) ways[sum] += ways[sum - num];
  }
  return ways[target];
}

function spiralize(matrix) {
  const out = [];
  let top = 0;
  let bottom = matrix.length - 1;
  let left = 0;
  let right = matrix[0].length - 1;
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) out.push(matrix[top][c]);
    top++;
    for (let r = top; r <= bottom; r++) out.push(matrix[r][right]);
    right--;
    if (top <= bottom) {
      for (let c = right; c >= left; c--) out.push(matrix[bottom][c]);
      bottom--;
    }
    if (left <= right) {
      for (let r = bottom; r >= top; r--) out.push(matrix[r][left]);
      left++;
    }
  }
  return out;
}

function arrayJumpingGame(nums) {
  let reach = 0;
  for (let i = 0; i <= reach && i < nums.length; i++) reach = Math.max(reach, i + nums[i]);
  return reach >= nums.length - 1 ? 1 : 0;
}

function arrayJumpingGame2(nums) {
  if (nums.length <= 1) return 0;
  let jumps = 0;
  let end = 0;
  let far = 0;
  for (let i = 0; i < nums.length - 1; i++) {
    far = Math.max(far, i + nums[i]);
    if (i === end) {
      jumps++;
      end = far;
      if (end >= nums.length - 1) return jumps;
      if (end <= i) return 0;
    }
  }
  return 0;
}

function mergeIntervals(intervals) {
  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (!last || interval[0] > last[1]) merged.push(interval);
    else last[1] = Math.max(last[1], interval[1]);
  }
  return merged;
}

function generateIps(digits) {
  const out = [];
  for (let a = 1; a <= 3; a++) {
    for (let b = 1; b <= 3; b++) {
      for (let c = 1; c <= 3; c++) {
        const d = digits.length - a - b - c;
        if (d < 1 || d > 3) continue;
        const parts = [
          digits.slice(0, a),
          digits.slice(a, a + b),
          digits.slice(a + b, a + b + c),
          digits.slice(a + b + c),
        ];
        if (parts.every(validIpPart)) out.push(parts.join("."));
      }
    }
  }
  return out;
}

function validIpPart(part) {
  return String(Number(part)) === part && Number(part) <= 255;
}

function stock1(prices) {
  let min = Infinity;
  let best = 0;
  for (const price of prices) {
    min = Math.min(min, price);
    best = Math.max(best, price - min);
  }
  return best;
}

function stock2(prices) {
  let profit = 0;
  for (let i = 1; i < prices.length; i++) profit += Math.max(0, prices[i] - prices[i - 1]);
  return profit;
}

function stockK(k, prices) {
  if (k <= 0 || prices.length === 0) return 0;
  if (k >= prices.length / 2) return stock2(prices);
  const hold = Array(k + 1).fill(-Infinity);
  const cash = Array(k + 1).fill(0);
  for (const price of prices) {
    for (let t = 1; t <= k; t++) {
      hold[t] = Math.max(hold[t], cash[t - 1] - price);
      cash[t] = Math.max(cash[t], hold[t] + price);
    }
  }
  return cash[k];
}

function minTrianglePath(triangle) {
  const dp = triangle[triangle.length - 1].slice();
  for (let r = triangle.length - 2; r >= 0; r--) {
    for (let c = 0; c < triangle[r].length; c++) dp[c] = triangle[r][c] + Math.min(dp[c], dp[c + 1]);
  }
  return dp[0];
}

function uniquePaths1(rows, cols) {
  const dp = Array(cols).fill(1);
  for (let r = 1; r < rows; r++) {
    for (let c = 1; c < cols; c++) dp[c] += dp[c - 1];
  }
  return dp[cols - 1];
}

function uniquePaths2(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const dp = Array(cols).fill(0);
  dp[0] = grid[0][0] === 1 ? 0 : 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 1) dp[c] = 0;
      else if (c > 0) dp[c] += dp[c - 1];
    }
  }
  return dp[cols - 1];
}

function shortestGridPath(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  if (grid[0][0] === 1 || grid[rows - 1][cols - 1] === 1) return "";
  const dirs = [
    [1, 0, "D"],
    [-1, 0, "U"],
    [0, 1, "R"],
    [0, -1, "L"],
  ];
  const queue = [[0, 0, ""]];
  const seen = new Set(["0,0"]);
  for (let i = 0; i < queue.length; i++) {
    const [r, c, path] = queue[i];
    if (r === rows - 1 && c === cols - 1) return path;
    for (const [dr, dc, move] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      const key = `${nr},${nc}`;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || grid[nr][nc] === 1 || seen.has(key)) continue;
      seen.add(key);
      queue.push([nr, nc, path + move]);
    }
  }
  return "";
}

function sanitizeParens(s) {
  const out = [];
  const seen = new Set([s]);
  const queue = [s];
  let found = false;
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (validParens(current)) {
      out.push(current);
      found = true;
    }
    if (found) continue;
    for (let j = 0; j < current.length; j++) {
      if (current[j] !== "(" && current[j] !== ")") continue;
      const next = current.slice(0, j) + current.slice(j + 1);
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return out;
}

function validParens(s) {
  let depth = 0;
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function findMathExpressions([digits, target]) {
  const out = [];
  function dfs(index, expr, value, last) {
    if (index === digits.length) {
      if (value === target) out.push(expr);
      return;
    }
    for (let end = index + 1; end <= digits.length; end++) {
      const part = digits.slice(index, end);
      if (part.length > 1 && part[0] === "0") break;
      const n = Number(part);
      if (index === 0) dfs(end, part, n, n);
      else {
        dfs(end, `${expr}+${part}`, value + n, n);
        dfs(end, `${expr}-${part}`, value - n, -n);
        dfs(end, `${expr}*${part}`, value - last + last * n, last * n);
      }
    }
  }
  dfs(0, "", 0, 0);
  return out;
}

function hammingEncode(value) {
  const data = Number(value).toString(2).split("").reverse();
  const bits = [0];
  let dataIndex = 0;
  for (let i = 1; dataIndex < data.length; i++) {
    bits[i] = isPowerOfTwo(i) ? 0 : Number(data[dataIndex++]);
  }
  for (let p = 1; p < bits.length; p *= 2) {
    let parity = 0;
    for (let i = 1; i < bits.length; i++) if (i & p) parity ^= bits[i];
    bits[p] = parity;
  }
  bits[0] = bits.reduce((acc, bit) => acc ^ bit, 0);
  return bits.join("");
}

function hammingDecode(encoded) {
  const bits = String(encoded).split("").map(Number);
  let error = 0;
  for (let p = 1; p < bits.length; p *= 2) {
    let parity = 0;
    for (let i = 1; i < bits.length; i++) if (i & p) parity ^= bits[i];
    if (parity) error += p;
  }
  const overall = bits.reduce((acc, bit) => acc ^ bit, 0);
  if (overall && error < bits.length) bits[error] ^= 1;
  const data = [];
  for (let i = 1; i < bits.length; i++) if (!isPowerOfTwo(i)) data.push(bits[i]);
  return parseInt(data.reverse().join("") || "0", 2);
}

function isPowerOfTwo(n) {
  return n > 0 && (n & (n - 1)) === 0;
}

function twoColorGraph([n, edges]) {
  const graph = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) {
    graph[a].push(b);
    graph[b].push(a);
  }
  const color = Array(n).fill(-1);
  for (let start = 0; start < n; start++) {
    if (color[start] !== -1) continue;
    color[start] = 0;
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const node = queue[i];
      for (const next of graph[node]) {
        if (color[next] === -1) {
          color[next] = 1 - color[node];
          queue.push(next);
        } else if (color[next] === color[node]) {
          return [];
        }
      }
    }
  }
  return color;
}

function rle(input) {
  let out = "";
  for (let i = 0; i < input.length; ) {
    let count = 1;
    while (i + count < input.length && input[i + count] === input[i] && count < 9) count++;
    out += String(count) + input[i];
    i += count;
  }
  return out;
}

function lzDecompress(input) {
  let out = "";
  for (let i = 0; i < input.length; ) {
    const literal = Number(input[i++]);
    out += input.slice(i, i + literal);
    i += literal;
    if (i >= input.length) break;
    const backLen = Number(input[i++]);
    if (backLen === 0) continue;
    const backDist = Number(input[i++]);
    for (let j = 0; j < backLen; j++) out += out[out.length - backDist];
  }
  return out;
}

function lzCompress(plain) {
  const state = Array.from({ length: plain.length + 1 }, () => ["", ""]);
  function set(pos, type, encoded) {
    if (state[pos][type].length === 0 || encoded.length < state[pos][type].length) state[pos][type] = encoded;
  }
  state[0][0] = "";
  for (let i = 0; i < plain.length; i++) {
    const literalState = state[i][0] || state[i][1];
    if (literalState) {
      for (let len = 1; len <= 9 && i + len <= plain.length; len++) {
        set(i + len, 1, literalState + len + plain.slice(i, i + len));
      }
    }
    for (let sourceType = 0; sourceType <= 1; sourceType++) {
      const encoded = state[i][sourceType];
      if (!encoded && i !== 0) continue;
      for (let dist = 1; dist <= 9 && dist <= i; dist++) {
        let len = 0;
        while (len < 9 && i + len < plain.length && plain[i + len] === plain[i + len - dist]) len++;
        for (let l = 1; l <= len; l++) set(i + l, 0, encoded + l + dist);
      }
      if (sourceType === 0) set(i, 1, encoded + "0");
    }
  }
  const a = state[plain.length][0];
  const b = state[plain.length][1];
  if (!a) return b;
  if (!b) return a;
  return a.length <= b.length ? a : b;
}

function caesar([text, shift]) {
  return text
    .split("")
    .map((ch) => {
      if (ch === " ") return ch;
      const code = ch.charCodeAt(0) - 65;
      return String.fromCharCode(((code - shift + 26) % 26) + 65);
    })
    .join("");
}

function vigenere([text, key]) {
  return text
    .split("")
    .map((ch, i) => {
      const shift = key.charCodeAt(i % key.length) - 65;
      const code = ch.charCodeAt(0) - 65;
      return String.fromCharCode(((code + shift) % 26) + 65);
    })
    .join("");
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function openWindow(ns) {
  try {
    ns.ui?.openTail?.();
    ns.ui?.setTailTitle?.("Auto Contracts");
    ns.ui?.resizeTail?.(680, 420);
  } catch {
    // Contract solving does not require a tail window.
  }
}
