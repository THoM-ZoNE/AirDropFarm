// Statisctic counters + transaction list (demo)
(function () {
  function animateCounter(el, endValue, decimals = 0, duration = 1200) {
    if (!el) return;
    const startTime = performance.now();

    function step(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const value = endValue * progress;
      el.textContent = decimals > 0
        ? value.toFixed(decimals)
        : Math.floor(value).toLocaleString("hu-HU");
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = decimals > 0
          ? endValue.toFixed(decimals)
          : Math.floor(endValue).toLocaleString("hu-HU");
      }
    }

    requestAnimationFrame(step);
  }

  function renderStats(stats) {
    animateCounter(document.getElementById("statHolders"), stats.totalHolders, 0);
    animateCounter(document.getElementById("statSol"), stats.totalSolDistributed, 2);
    animateCounter(document.getElementById("statRounds"), stats.totalRounds, 0);
    animateCounter(document.getElementById("statAvg"), stats.avgSolPerHolder, 4);

    animateCounter(document.getElementById("miniHolders"), stats.totalHolders, 0);
    animateCounter(document.getElementById("miniSol"), stats.totalSolDistributed, 2);
    animateCounter(document.getElementById("miniRounds"), stats.totalRounds, 0);
  }

  function renderRecentTx(txList) {
    const tbody = document.getElementById("recentTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    txList.forEach((tx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${tx.time}</td>
        <td>${tx.wallet}</td>
        <td class="sol-amount">${tx.amount.toFixed(4)} SOL</td>
        <td><a href="https://solscan.io/tx/${tx.tx}" target="_blank" rel="noopener">${tx.tx}</a></td>
      `;
      tbody.appendChild(tr);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    // If we have AP, you can replace it here
    renderStats(AIRDROP_CONFIG.demoStats);
    renderRecentTx(AIRDROP_CONFIG.demoRecentTx);
  });
})();