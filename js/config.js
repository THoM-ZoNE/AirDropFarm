const AIRDROP_CONFIG = {
  // Next round of airdrop date (demo)
  nextRoundTimestamp: new Date(Date.now() + 1000 * 60 * 5).toISOString(),
  roundLengthMinutes: 5,

  // API endpoints (if we have a backend)
  statsApiUrl: "https://airdrop.thomzone.net/api/stats",
  recentTxApiUrl: "https://airdrop.thomzone.net/api/transactions",

  // Demo statistics
  demoStats: null,
  demoChartData: null,
  demoRecentTx: []
};