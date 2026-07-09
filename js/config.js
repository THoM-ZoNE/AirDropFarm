const AIRDROP_CONFIG = {
  // Next round of airdrop date (demo)
  nextRoundTimestamp: new Date(Date.now() + 1000 * 60 * 60 * 26).toISOString(),
  roundLengthHours: 26,

  // API endpoints (if we have a backend)
  statsApiUrl: null,
  recentTxApiUrl: null,

  // Demo statistics
  demoStats: {
    totalHolders: 1842,
    totalSolDistributed: 128.47,
    totalRounds: 37,
    avgSolPerHolder: 0.0697
  },

  demoChartData: {
    labels: ["Round 31","Round 32","Round 33","Round 34","Round 35","Round 36","Round 37"],
    values: [2.1, 3.4, 2.8, 4.1, 3.9, 5.2, 4.6]
  },

  demoRecentTx: [
    { time: "2026-07-09 18:42", wallet: "7xKX...aP2q", amount: 0.084, tx: "5h2f...9kQ1" },
    { time: "2026-07-09 18:42", wallet: "9pQm...vT3z", amount: 0.061, tx: "3nB7...7mLx" },
    { time: "2026-07-09 18:42", wallet: "4dRt...cX8w", amount: 0.112, tx: "8qWe...2vNs" },
    { time: "2026-07-08 12:05", wallet: "2fGh...nY5k", amount: 0.047, tx: "6uJp...1dRz" },
    { time: "2026-07-08 12:05", wallet: "6zLp...mK9a", amount: 0.093, tx: "1aXc...4fTb" }
  ]
};