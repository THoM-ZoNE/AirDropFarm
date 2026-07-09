// Simple bar chart using the Canvas API
(function () {
  function drawBarChart(canvas, labels, values) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight || 240;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const max = Math.max(...values) * 1.2;
    const barWidth = (width / values.length) * 0.55;
    const gap = (width / values.length) * 0.45;

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#14f1c6");
    gradient.addColorStop(1, "#7c5cff");

    values.forEach((val, i) => {
      const barHeight = (val / max) * (height - 40);
      const x = i * (barWidth + gap) + gap / 2;
      const y = height - barHeight - 24;

      ctx.fillStyle = gradient;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barWidth, barHeight, 6);
      } else {
        ctx.rect(x, y, barWidth, barHeight);
      }
      ctx.fill();

      ctx.fillStyle = "#93a0bd";
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(labels[i], x + barWidth / 2, height - 6);

      ctx.fillStyle = "#e8ecf7";
      ctx.font = "12px Inter, sans-serif";
      ctx.fillText(val.toFixed(1), x + barWidth / 2, y - 8);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("distributionChart");
    if (!canvas) return;
    const { labels, values } = AIRDROP_CONFIG.demoChartData;
    drawBarChart(canvas, labels, values);
    window.addEventListener("resize", () => drawBarChart(canvas, labels, values));
  });
})();