(function () {
  let nextSnapshotAtMs = null;
  let serverOffsetMs = 0;
  let countdownTimer = null;
  let syncTimer = null;

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function renderCountdown(diffMs) {
    const safeDiff = Math.max(0, diffMs);
    const totalSeconds = Math.floor(safeDiff / 1000);

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    setText("days", pad(days));
    setText("hours", pad(hours));
    setText("minutes", pad(minutes));
    setText("seconds", pad(seconds));
  }

  async function loadSchedule() {
    if (!window.AIRDROP_CONFIG?.statsApiUrl) {
      console.warn("Stats API URL not configured.");
      return;
    }

    try {
      const res = await fetch(window.AIRDROP_CONFIG.statsApiUrl, {
        headers: { Accept: "application/json" }
      });

      if (!res.ok) {
        throw new Error(`Stats API error: ${res.status}`);
      }

      const data = await res.json();

      if (data.serverTime) {
        serverOffsetMs = new Date(data.serverTime).getTime() - Date.now();
      }

      if (data.nextSnapshotAt) {
        nextSnapshotAtMs = new Date(data.nextSnapshotAt).getTime();
      }
    } catch (error) {
      console.warn("Countdown schedule unavailable", error);
    }
  }

  async function syncAndRender() {
    await loadSchedule();

    if (!nextSnapshotAtMs) {
      renderCountdown(0);
      return;
    }

    const now = Date.now() + serverOffsetMs;
    renderCountdown(nextSnapshotAtMs - now);
  }

  function startCountdownLoop() {
    if (countdownTimer) clearInterval(countdownTimer);

    countdownTimer = setInterval(async () => {
      if (!nextSnapshotAtMs) {
        renderCountdown(0);
        return;
      }

      const now = Date.now() + serverOffsetMs;
      const diff = nextSnapshotAtMs - now;

      renderCountdown(diff);

      if (diff <= 0) {
        await syncAndRender();
      }
    }, 1000);
  }

  function startSyncLoop() {
    if (syncTimer) clearInterval(syncTimer);

    syncTimer = setInterval(async () => {
      await syncAndRender();
    }, 30000);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await syncAndRender();
    startCountdownLoop();
    startSyncLoop();
  });
})();