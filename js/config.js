const AIRDROP_CONFIG = {
  // Next round of airdrop date (demo)
  nextRoundTimestamp: new Date(Date.now() + 1000 * 60 * 5).toISOString(),
  roundLengthMinutes: 5,

  // API endpoints (if we have a backend)
  statsApiUrl: "http://localhost:8787/stats",
  recentTxApiUrl: null,

  // Demo statistics
  demoStats: null,
  demoChartData: null,
  demoRecentTx: []
};