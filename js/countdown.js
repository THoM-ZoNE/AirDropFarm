(function () {
  const els = {
    days:    document.getElementById("cdDays"),
    hours:   document.getElementById("cdHours"),
    minutes: document.getElementById("cdMinutes"),
    seconds: document.getElementById("cdSeconds"),
    note:    document.getElementById("countdownNote")
  };

  const API_URL = window.AIRDROP_CONFIG?.statsApiUrl ?? "/stats";

  // serverTime offset: server és kliens órajel különbsége
  let serverOffset = 0;
  let targetTs = null;
  let ticker = null;

  function pad(n) { return String(n).padStart(2, "0"); }

  function renderTick() {
    const now = Date.now() + serverOffset;
    let diff = targetTs - now;

    if (diff <= 0) {
      // Visszaszámláló elérte a 0-t -> új schedule lekérés
      diff = 0;
      if (els.note) els.note.textContent = "Snapshot running… fetching next round";
      clearInterval(ticker);
      // Kis késleltetéssel újra lekéri
      setTimeout(fetchSchedule, 3000);
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);

    if (els.days)    els.days.textContent    = pad(d);
    if (els.hours)   els.hours.textContent   = pad(h);
    if (els.minutes) els.minutes.textContent = pad(m);
    if (els.seconds) els.seconds.textContent = pad(s);
  }

  function startTicker() {
    if (ticker) clearInterval(ticker);
    renderTick();
    ticker = setInterval(renderTick, 1000);
  }

  async function fetchSchedule() {
    try {
      const resp = await fetch(API_URL, { cache: "no-store" });
      if (!resp.ok) throw new Error("stats " + resp.status);
      const data = await resp.json();

      // serverTime alapján offset számítás
      if (data.serverTime) {
        serverOffset = data.serverTime - Date.now();
      }

      // nextSnapshotAt az elsődleges countdown cél
      if (data.nextSnapshotAt) {
        targetTs = data.nextSnapshotAt;
        if (els.note) els.note.textContent = "Next snapshot: " + new Date(data.nextSnapshotAt).toUTCString();
      } else {
        // Fallback: ha a backend még nem adja nextSnapshotAt-t
        if (!targetTs || targetTs <= Date.now() + serverOffset) {
          targetTs = Date.now() + (window.AIRDROP_CONFIG?.roundLengthMinutes ?? 5) * 60 * 1000;
          if (els.note) els.note.textContent = "Schedule sync pending…";
        }
      }

      startTicker();
    } catch (err) {
      console.warn("[countdown] fetchSchedule error:", err);
      // Fallback: lokális timer, hogy ne álljon meg a UI
      if (!targetTs || targetTs <= Date.now()) {
        targetTs = Date.now() + (window.AIRDROP_CONFIG?.roundLengthMinutes ?? 5) * 60 * 1000;
      }
      startTicker();
      // Retry 30s múlva
      setTimeout(fetchSchedule, 30_000);
    }
  }

  // Inicializálás
  fetchSchedule();
})();