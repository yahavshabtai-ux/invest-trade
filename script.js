const $ = (id) => document.getElementById(id);

let balance = 10000;
let currentPrice = 64250;
const sessionOpen = currentPrice;
let sessionHigh = currentPrice;
let sessionLow = currentPrice;
let activeTrade = null;
let tradeCount = 0;
let marketTimer = null;
let chartSpeed = 400;

const fmtMoney = (n) =>
  "$" + Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const labels = [];
const prices = [];

for (let i = 0; i < 90; i++) {
  currentPrice += (Math.random() - 0.5) * 45;
  labels.push("");
  prices.push(currentPrice);
}

sessionHigh = Math.max(...prices, sessionOpen);
sessionLow = Math.min(...prices, sessionOpen);

const ctx = $("priceChart").getContext("2d");
const gradient = ctx.createLinearGradient(0, 0, 0, 500);
gradient.addColorStop(0, "rgba(0,217,120,.18)");
gradient.addColorStop(1, "rgba(0,217,120,0)");

const chart = new Chart(ctx, {
  type: "line",
  data: {
    labels,
    datasets: [{
      data: prices,
      borderColor: "#00d978",
      backgroundColor: gradient,
      borderWidth: 2,
      pointRadius: 0,
      fill: true,
      tension: 0.18
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    normalized: true,
    interaction: {
      intersect: false,
      mode: "index"
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        backgroundColor: "#161d27",
        callbacks: {
          label: (c) => fmtMoney(c.raw)
        }
      }
    },
    scales: {
      x: {
        display: false,
        grid: { display: false }
      },
      y: {
        position: "right",
        ticks: {
          color: "#697486",
          callback: (v) => "$" + Math.round(v).toLocaleString()
        },
        grid: {
          color: "#121821"
        },
        border: {
          display: false
        }
      }
    }
  }
});

function updateHeader() {
  $("price").textContent = fmtMoney(currentPrice);

  sessionHigh = Math.max(sessionHigh, currentPrice);
  sessionLow = Math.min(sessionLow, currentPrice);

  $("sessionOpen").textContent = fmtMoney(sessionOpen);
  $("sessionHigh").textContent = fmtMoney(sessionHigh);
  $("sessionLow").textContent = fmtMoney(sessionLow);
  $("tradeCount").textContent = tradeCount;

  const pct = ((currentPrice - sessionOpen) / sessionOpen) * 100;
  const change = $("change");
  change.textContent = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  change.className = pct >= 0 ? "positive" : "negative";
}

function updateMarket() {
  const prior = currentPrice;

  const baseVolatility = currentPrice * 0.00085;
  const noise = (Math.random() - 0.5) * baseVolatility;
  const occasionalMove =
    Math.random() < 0.08 ? (Math.random() - 0.5) * baseVolatility * 3 : 0;

  currentPrice = Math.max(100, currentPrice + noise + occasionalMove);

  prices.push(currentPrice);
  prices.shift();
  labels.push("");
  labels.shift();

  const up = currentPrice >= prior;
  chart.data.datasets[0].borderColor = up ? "#00d978" : "#ff4d61";
  chart.update("none");

  updateHeader();
  updateLivePnL();
}

function startMarket() {
  clearInterval(marketTimer);
  marketTimer = setInterval(updateMarket, chartSpeed);
}

function secondsFromInputs() {
  const value = Math.max(1, Number($("duration").value) || 1);
  const unit = $("durationType").value;

  if (unit === "seconds") return value;
  if (unit === "minutes") return value * 60;
  if (unit === "hours") return value * 3600;
  return value * 86400;
}

function formatDuration(totalSeconds) {
  let s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86400);
  s %= 86400;
  const h = Math.floor(s / 3600);
  s %= 3600;
  const m = Math.floor(s / 60);
  const sec = s % 60;

  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function updateBalance() {
  $("balance").textContent = fmtMoney(balance);
}

function calculatePnL() {
  if (!activeTrade) return 0;

  const move = (currentPrice - activeTrade.entry) / activeTrade.entry;
  const signedMove = activeTrade.direction === "BUY" ? move : -move;

  // Demo multiplier to make short demo trades visibly move.
  return signedMove * activeTrade.amount * 30;
}

function updateLivePnL() {
  if (!activeTrade) return;
  const pnl = calculatePnL();
  const el = $("pnl");
  el.textContent = `${pnl >= 0 ? "+" : ""}${fmtMoney(pnl)}`;
  el.className = pnl >= 0 ? "positive" : "negative";
}

function openTrade(direction) {
  if (activeTrade) {
    alert("כבר יש עסקה פתוחה.");
    return;
  }

  const amount = Number($("amount").value);

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("צריך לבחור סכום תקין.");
    return;
  }

  if (amount > balance) {
    alert("אין מספיק יתרה וירטואלית.");
    return;
  }

  const seconds = secondsFromInputs();

  balance -= amount;
  updateBalance();

  activeTrade = {
    direction,
    entry: currentPrice,
    amount,
    remaining: seconds,
    originalSeconds: seconds
  };

  $("activeTrade").classList.remove("hidden");
  $("directionText").textContent = direction;
  $("directionText").className = direction === "BUY" ? "positive" : "negative";
  $("entryPrice").textContent = fmtMoney(activeTrade.entry);
  $("timer").textContent = formatDuration(activeTrade.remaining);

  activeTrade.interval = setInterval(() => {
    if (!activeTrade) return;

    activeTrade.remaining -= 1;
    $("timer").textContent = formatDuration(activeTrade.remaining);
    updateLivePnL();

    if (activeTrade.remaining <= 0) finishTrade();
  }, 1000);
}

function finishTrade() {
  if (!activeTrade) return;

  clearInterval(activeTrade.interval);

  const finished = { ...activeTrade };
  const pnl = calculatePnL();
  const finalReturn = Math.max(0, finished.amount + pnl);

  balance += finalReturn;
  tradeCount += 1;

  const historyItem = document.createElement("div");
  historyItem.className = "history-item";

  const resultClass = pnl >= 0 ? "positive" : "negative";
  historyItem.innerHTML = `
    <div>
      <strong class="${finished.direction === "BUY" ? "positive" : "negative"}">
        ${finished.direction === "BUY" ? "▲ BUY" : "▼ SELL"}
      </strong>
      <span>${fmtMoney(finished.amount)} · ${formatDuration(finished.originalSeconds)}</span>
    </div>
    <div class="history-result ${resultClass}">
      ${pnl >= 0 ? "+" : ""}${fmtMoney(pnl)}
    </div>
  `;

  const history = $("history");
  const empty = history.querySelector(".empty-history");
  if (empty) empty.remove();
  history.prepend(historyItem);

  activeTrade = null;
  $("activeTrade").classList.add("hidden");
  updateBalance();
  updateHeader();
}

function resetDemo() {
  if (activeTrade) {
    clearInterval(activeTrade.interval);
    activeTrade = null;
  }

  balance = 10000;
  tradeCount = 0;
  $("activeTrade").classList.add("hidden");
  $("history").innerHTML = `<div class="empty-history">עוד אין עסקאות</div>`;
  updateBalance();
  updateHeader();
}

document.querySelectorAll(".quick-times button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".quick-times button").forEach((b) =>
      b.classList.remove("selected")
    );

    button.classList.add("selected");
    $("duration").value = button.dataset.value;
    $("durationType").value = button.dataset.unit;
  });
});

document.querySelectorAll(".chart-speed").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".chart-speed").forEach((b) =>
      b.classList.remove("active")
    );

    button.classList.add("active");
    chartSpeed = Number(button.dataset.speed);
    startMarket();
  });
});

$("buyBtn").addEventListener("click", () => openTrade("BUY"));
$("sellBtn").addEventListener("click", () => openTrade("SELL"));
$("resetBtn").addEventListener("click", resetDemo);

$("fullscreenBtn").addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (_) {}
});

updateBalance();
updateHeader();
startMarket();
