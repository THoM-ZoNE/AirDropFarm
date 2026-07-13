// Statistic counters + transaction list (live API)
(function () {
  function animateCounter(el, endValue, decimals = 0, duration = 1200) {
    if (!el) return;

    const numericValue = Number(endValue);
    if (!Number.isFinite(numericValue)) {
      el.textContent = "0";
      return;
    }

    const startTime = performance.now();

    function step(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const value = numericValue * progress;

      el.textContent =
        decimals > 0
          ? value.toFixed(decimals)
          : Math.floor(value).toLocaleString("hu-HU");

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent =
          decimals > 0
            ? numericValue.toFixed(decimals)
            : Math.floor(numericValue).toLocaleString("hu-HU");
      }
    }

    requestAnimationFrame(step);
  }

  function renderStats(stats) {
    if (!stats) return;

    animateCounter(
      document.getElementById("statHolders"),
      stats.totalHolders ?? 0,
      0
    );

    animateCounter(
      document.getElementById("statSol"),
      stats.totalSolDistributed ?? 0,
      2
    );

    animateCounter(
      document.getElementById("statRounds"),
      stats.totalRounds ?? 0,
      0
    );

    animateCounter(
      document.getElementById("statAvg"),
      stats.avgSolPerHolder ?? 0,
      4
    );

    animateCounter(
      document.getElementById("miniHolders"),
      stats.totalHolders ?? 0,
      0
    );

    animateCounter(
      document.getElementById("miniSol"),
      stats.totalSolDistributed ?? 0,
      2
    );

    animateCounter(
      document.getElementById("miniRounds"),
      stats.totalRounds ?? 0,
      0
    );
  }

  function renderRecentTx(txList) {
    const tbody = document.getElementById("recentTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!Array.isArray(txList) || txList.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td colspan="4">There are no transactions to display.</td>
      `;
      tbody.appendChild(tr);
      return;
    }

    txList.forEach((tx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${tx.time ?? "-"}</td>
        <td>${tx.wallet ?? "-"}</td>
        <td class="sol-amount">${Number(tx.amount ?? 0).toFixed(4)} SOL</td>
        <td>
          ${
            tx.tx
              ? `<a href="https://solscan.io/tx/${tx.tx}" target="_blank" rel="noopener">View</a>`
              : "-"
          }
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  async function loadStats() {
    if (!window.AIRDROP_CONFIG || !AIRDROP_CONFIG.statsApiUrl) {
      console.warn("Stats API URL nincs beállítva.");
      return;
    }

    try {
      const res = await fetch(AIRDROP_CONFIG.statsApiUrl, {
        headers: { Accept: "application/json" }
      });

      if (!res.ok) {
        throw new Error(`Stats API error: ${res.status}`);
      }

      const data = await res.json();
      renderStats(data);
    } catch (error) {
      console.warn("Stats API unavailable", error);
    }
  }

  async function loadRecentTx() {
    if (!window.AIRDROP_CONFIG || !AIRDROP_CONFIG.recentTxApiUrl) {
      return;
    }

    try {
      const res = await fetch(AIRDROP_CONFIG.recentTxApiUrl, {
        headers: { Accept: "application/json" }
      });

      if (!res.ok) {
        throw new Error(`Recent transactions API error: ${res.status}`);
      }

      const data = await res.json();
      renderRecentTx(Array.isArray(data) ? data : data.items);
    } catch (error) {
      console.warn("Recent transactions API unavailable", error);
      renderRecentTx([]);
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await loadStats();
    await loadRecentTx();

    setInterval(loadStats, 30000);

    if (window.AIRDROP_CONFIG?.recentTxApiUrl) {
      setInterval(loadRecentTx, 30000);
    }
  });
})();