
const symbols = [
  { key: "BTCUSD", name: "Bitcoin / US Dollar", base: 64250, spread: 12, icon: "₿" },
  { key: "ETHUSD", name: "Ethereum / US Dollar", base: 3450, spread: 4, icon: "Ξ" },
  { key: "AAPL", name: "Apple Inc.", base: 228, spread: 0.15, icon: "A" },
  { key: "TSLA", name: "Tesla, Inc.", base: 264, spread: 0.20, icon: "T" },
  { key: "EURUSD", name: "Euro / US Dollar", base: 1.092, spread: 0.0003, icon: "€" },
  { key: "XAUUSD", name: "Gold / US Dollar", base: 2528, spread: 0.60, icon: "Au" }
];

const state = {
  balance: 10000,
  currentSymbol: "BTCUSD",
  timeframe: "1m",
  activeTrade: null,
  tradeCount: 0,
  history: []
};

const marketStore = {};
symbols.forEach(s => {
  marketStore[s.key] = buildMarketSeries(s.base);
});

function buildMarketSeries(base) {
  const candles = [];
  let price = base;
  const now = Math.floor(Date.now() / 1000) - 200 * 60;

  for (let i = 0; i < 200; i++) {
    const open = price;
    const move = (Math.random() - 0.5) * base * 0.0035;
    const close = Math.max(base * 0.2, open + move);
    const high = Math.max(open, close) + Math.random() * base * 0.0018;
    const low = Math.max(base * 0.1, Math.min(open, close) - Math.random() * base * 0.0018);
    candles.push({
      time: now + i * 60,
      open,
      high,
      low,
      close
    });
    price = close;
  }

  return { candles, last: candles[candles.length - 1].close };
}

const $ = (id) => document.getElementById(id);

let chart;
let candleSeries;

function fmtPrice(value) {
  if (value >= 1000) {
    return "$" + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (value >= 1) {
    return "$" + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  return "$" + value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 5 });
}

function fmtSigned(value) {
  return (value >= 0 ? "+" : "") + fmtPrice(value);
}

function fmtPercent(value) {
  return (value >= 0 ? "+" : "") + value.toFixed(2) + "%";
}

function formatBalance(v) {
  return "$" + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function durationToSeconds(value, unit) {
  value = Math.max(1, Number(value) || 1);
  if (unit === "seconds") return value;
  if (unit === "minutes") return value * 60;
  if (unit === "hours") return value * 3600;
  return value * 86400;
}

function formatCountdown(total) {
  let s = Math.max(0, Math.floor(total));
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

function getCurrentMeta() {
  return symbols.find(s => s.key === state.currentSymbol);
}

function getCurrentSeries() {
  return marketStore[state.currentSymbol];
}

function initChart() {
  const chartEl = $("tvChart");
  chart = LightweightCharts.createChart(chartEl, {
    layout: {
      background: { color: "#0b1220" },
      textColor: "#94a3bb"
    },
    rightPriceScale: {
      borderColor: "#1d2740"
    },
    timeScale: {
      borderColor: "#1d2740",
      timeVisible: true,
      secondsVisible: false
    },
    grid: {
      vertLines: { color: "#121b2d" },
      horzLines: { color: "#121b2d" }
    },
    crosshair: {
      mode: 1
    },
    handleScroll: true,
    handleScale: true
  });

  candleSeries = chart.addCandlestickSeries({
    upColor: "#22ab94",
    downColor: "#f23645",
    borderVisible: false,
    wickUpColor: "#22ab94",
    wickDownColor: "#f23645",
    priceLineVisible: true
  });

  updateChartForSymbol();

  window.addEventListener("resize", () => {
    chart.applyOptions({
      width: chartEl.clientWidth,
      height: chartEl.clientHeight
    });
  });

  setTimeout(() => {
    chart.applyOptions({
      width: chartEl.clientWidth,
      height: chartEl.clientHeight
    });
  }, 50);
}

function renderWatchlist() {
  const container = $("watchlist");
  container.innerHTML = "";

  symbols.forEach(symbol => {
    const market = marketStore[symbol.key];
    const candles = market.candles;
    const last = candles[candles.length - 1].close;
    const prev = candles[candles.length - 2].close;
    const changePct = ((last - prev) / prev) * 100;

    const btn = document.createElement("button");
    btn.className = "watch-item" + (state.currentSymbol === symbol.key ? " active" : "");
    btn.innerHTML = `
      <div class="mini-symbol">${symbol.icon}</div>
      <div class="watch-main">
        <strong>${symbol.key}</strong>
        <span>${symbol.name}</span>
      </div>
      <div class="watch-price">
        <strong>${fmtPrice(last)}</strong>
        <span class="${changePct >= 0 ? "up" : "down"}">${fmtPercent(changePct)}</span>
      </div>
    `;
    btn.addEventListener("click", () => {
      state.currentSymbol = symbol.key;
      syncSelect();
      updateChartForSymbol();
      renderWatchlist();
      refreshQuotes();
      refreshHeader();
      updateActiveTradeSymbolUI();
    });

    container.appendChild(btn);
  });
}

function fillSymbolSelect() {
  const select = $("symbolSelect");
  select.innerHTML = "";
  symbols.forEach(s => {
    const option = document.createElement("option");
    option.value = s.key;
    option.textContent = `${s.key} — ${s.name}`;
    select.appendChild(option);
  });

  select.value = state.currentSymbol;
  select.addEventListener("change", () => {
    state.currentSymbol = select.value;
    updateChartForSymbol();
    renderWatchlist();
    refreshQuotes();
    refreshHeader();
    updateActiveTradeSymbolUI();
  });
}

function syncSelect() {
  $("symbolSelect").value = state.currentSymbol;
}

function updateChartForSymbol() {
  const meta = getCurrentMeta();
  const market = getCurrentSeries();
  candleSeries.setData(market.candles);
  chart.timeScale().fitContent();

  $("activeSymbolName").textContent = meta.key;
  $("activeSymbolDesc").textContent = meta.name;
  $("chartSymbol").textContent = meta.key;
  $("chartSymbolFull").textContent = meta.name;

  refreshHeader();
  refreshQuotes();
}

function refreshHeader() {
  const market = getCurrentSeries();
  const candles = market.candles;
  const last = candles[candles.length - 1];
  const first = candles[0];
  const sessionHigh = Math.max(...candles.map(c => c.high));
  const sessionLow = Math.min(...candles.map(c => c.low));
  const changePct = ((last.close - first.open) / first.open) * 100;

  $("lastPrice").textContent = fmtPrice(last.close);
  $("lastChange").textContent = fmtPercent(changePct);
  $("lastChange").className = changePct >= 0 ? "up" : "down";
  $("sessionHigh").textContent = fmtPrice(sessionHigh);
  $("sessionLow").textContent = fmtPrice(sessionLow);
  $("balanceValue").textContent = formatBalance(state.balance);
}

function refreshQuotes() {
  const market = getCurrentSeries();
  const meta = getCurrentMeta();
  const last = market.candles[market.candles.length - 1].close;
  const buy = last + meta.spread;
  const sell = last - meta.spread;
  $("buyQuote").textContent = fmtPrice(buy);
  $("sellQuote").textContent = fmtPrice(sell);
}

function tickMarket() {
  symbols.forEach(symbol => {
    const market = marketStore[symbol.key];
    const prev = market.candles[market.candles.length - 1];
    const open = prev.close;
    const move = (Math.random() - 0.5) * Math.max(0.0004 * symbol.base, symbol.base * 0.004);
    const close = Math.max(symbol.base * 0.05, open + move);
    const high = Math.max(open, close) + Math.random() * Math.max(0.0002 * symbol.base, symbol.base * 0.0015);
    const low = Math.max(symbol.base * 0.03, Math.min(open, close) - Math.random() * Math.max(0.0002 * symbol.base, symbol.base * 0.0015));
    const time = prev.time + 60;

    market.candles.push({ time, open, high, low, close });
    if (market.candles.length > 220) market.candles.shift();
    market.last = close;
  });

  updateChartForSymbol();
  renderWatchlist();
  updateLivePnl();
}

function calculateTradePnl() {
  if (!state.activeTrade) return 0;
  const market = marketStore[state.activeTrade.symbol];
  const currentPrice = market.candles[market.candles.length - 1].close;
  const movement = (currentPrice - state.activeTrade.entry) / state.activeTrade.entry;
  const directionalMove = state.activeTrade.side === "BUY" ? movement : -movement;
  return directionalMove * state.activeTrade.amount * 28;
}

function updateActiveTradeSymbolUI() {
  if (!state.activeTrade) return;
  $("activeTradeSymbol").textContent = state.activeTrade.symbol;
}

function updateLivePnl() {
  if (!state.activeTrade) return;
  const pnl = calculateTradePnl();
  const el = $("livePnlValue");
  el.textContent = (pnl >= 0 ? "+" : "") + formatBalance(pnl);
  el.className = pnl >= 0 ? "up" : "down";
}

function openTrade(side) {
  if (state.activeTrade) {
    alert("יש כבר עסקה פעילה.");
    return;
  }

  state.currentSymbol = $("symbolSelect").value;
  const amount = Number($("amountInput").value);

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("תבחר סכום תקין.");
    return;
  }

  if (amount > state.balance) {
    alert("אין מספיק יתרה וירטואלית.");
    return;
  }

  const durationSeconds = durationToSeconds($("durationValue").value, $("durationUnit").value);
  const market = getCurrentSeries();
  const entry = market.candles[market.candles.length - 1].close;

  state.balance -= amount;
  state.activeTrade = {
    side,
    symbol: state.currentSymbol,
    amount,
    entry,
    remaining: durationSeconds,
    originalDuration: durationSeconds
  };

  $("activeTradeCard").classList.remove("hidden");
  $("tradeDirectionTag").textContent = side;
  $("activeTradeSymbol").textContent = state.activeTrade.symbol;
  $("entryPriceValue").textContent = fmtPrice(entry);
  $("countdownValue").textContent = formatCountdown(durationSeconds);

  refreshHeader();
  updateLivePnl();

  state.activeTrade.timer = setInterval(() => {
    if (!state.activeTrade) return;
    state.activeTrade.remaining -= 1;
    $("countdownValue").textContent = formatCountdown(state.activeTrade.remaining);
    updateLivePnl();

    if (state.activeTrade.remaining <= 0) {
      closeTrade();
    }
  }, 1000);
}

function closeTrade() {
  if (!state.activeTrade) return;

  clearInterval(state.activeTrade.timer);
  const trade = { ...state.activeTrade };
  const pnl = calculateTradePnl();
  const payout = Math.max(0, trade.amount + pnl);

  state.balance += payout;
  state.tradeCount += 1;
  state.history.unshift({ ...trade, pnl, closedAt: new Date() });

  state.activeTrade = null;
  $("activeTradeCard").classList.add("hidden");
  renderHistory();
  refreshHeader();
}

function renderHistory() {
  const list = $("positionsList");
  list.innerHTML = "";

  if (state.history.length === 0) {
    list.innerHTML = '<div class="empty-positions">עוד אין עסקאות</div>';
    return;
  }

  state.history.slice(0, 20).forEach(item => {
    const row = document.createElement("div");
    row.className = "position-item";
    row.innerHTML = `
      <div>
        <strong class="${item.side === "BUY" ? "up" : "down"}">${item.side}</strong>
        <span>${item.symbol}</span>
      </div>
      <div>
        <strong>${fmtPrice(item.entry)}</strong>
        <span>Entry</span>
      </div>
      <div>
        <strong>${formatBalance(item.amount)}</strong>
        <span>Amount</span>
      </div>
      <div>
        <strong>${formatCountdown(item.originalDuration)}</strong>
        <span>Duration</span>
      </div>
      <div>
        <strong class="${item.pnl >= 0 ? "up" : "down"}">${item.pnl >= 0 ? "+" : ""}${formatBalance(item.pnl)}</strong>
        <span>P/L</span>
      </div>
    `;
    list.appendChild(row);
  });
}

function clearHistory() {
  state.history = [];
  renderHistory();
}

function bindUi() {
  document.querySelectorAll(".tf-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tf-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.timeframe = btn.dataset.timeframe;
    });
  });

  document.querySelectorAll(".quick-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".quick-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      $("durationValue").value = btn.dataset.value;
      $("durationUnit").value = btn.dataset.unit;
    });
  });

  $("buyBtn").addEventListener("click", () => openTrade("BUY"));
  $("sellBtn").addEventListener("click", () => openTrade("SELL"));
  $("clearHistoryBtn").addEventListener("click", clearHistory);

  $("fullscreenBtn").addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {}
  });
}

function boot() {
  fillSymbolSelect();
  initChart();
  renderWatchlist();
  renderHistory();
  bindUi();
  refreshHeader();
  refreshQuotes();
  setInterval(tickMarket, 1200);
}

boot();
