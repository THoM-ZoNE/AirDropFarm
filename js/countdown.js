// Countdown logic
(function () {
  const els = {
    days: document.getElementById("cdDays"),
    hours: document.getElementById("cdHours"),
    minutes: document.getElementById("cdMinutes"),
    seconds: document.getElementById("cdSeconds"),
    note: document.getElementById("countdownNote")
  };

  let target = new Date(AIRDROP_CONFIG.nextRoundTimestamp).getTime();

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function tick() {
    const now = Date.now();
    let diff = target - now;

    if (diff <= 0) {
      // Round closed -> new round
      target = now + AIRDROP_CONFIG.roundLengthHours * 60 * 60 * 1000;
      if (els.note) els.note.textContent = "New airdrop round started!";
      diff = target - now;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);

    if (els.days) els.days.textContent = pad(d);
    if (els.hours) els.hours.textContent = pad(h);
    if (els.minutes) els.minutes.textContent = pad(m);
    if (els.seconds) els.seconds.textContent = pad(s);
  }

  tick();
  setInterval(tick, 1000);
})();