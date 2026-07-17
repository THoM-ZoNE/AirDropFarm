(function () {
  const els = {
    days:    document.getElementById("cdDays"),
    hours:   document.getElementById("cdHours"),
    minutes: document.getElementById("cdMinutes"),
    seconds: document.getElementById("cdSeconds"),
    note:    document.getElementById("countdownNote")
  };

  const STORAGE_KEY = "airdropfarm_countdown_target";
  const roundMs = (window.AIRDROP_CONFIG?.roundLengthMinutes ?? 5) * 60 * 1000;

  function getOrCreateTarget() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const t = parseInt(stored, 10);
      if (t > Date.now()) return t;
    }
    const t = Date.now() + roundMs;
    localStorage.setItem(STORAGE_KEY, String(t));
    return t;
  }

  let target = getOrCreateTarget();

  function pad(n) { return String(n).padStart(2, "0"); }

  function tick() {
    const now = Date.now();
    let diff = target - now;

    if (diff <= 0) {
      target = Date.now() + roundMs;
      localStorage.setItem(STORAGE_KEY, String(target));
      if (els.note) els.note.textContent = "New airdrop round started!";
      diff = target - Date.now();
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

  tick();
  setInterval(tick, 1000);
})();