import { toast } from "/assets/components/toast.js?v=1.6.26";
import { getLanguage, onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { getToolsByCategory, unitTools } from "/assets/js/tools/unit_converter_catalog.js?v=1.6.26";

const PRECISION = { general: 4, engineering: 6, finance: 2 };
const TIME_ZONES = [
  "UTC",
  "Asia/Taipei",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney"
];
const BANDWIDTH_MODES = [
  { value: "stream", zh: "串流影片", en: "Video streaming", perUser: 8 },
  { value: "game", zh: "線上遊戲", en: "Online gaming", perUser: 3 },
  { value: "meeting", zh: "視訊會議", en: "Video conference", perUser: 4 },
  { value: "live", zh: "直播", en: "Livestream", perUser: 15 },
  { value: "browse", zh: "一般瀏覽", en: "General browsing", perUser: 1.5 },
  { value: "server", zh: "伺服器", en: "Server workloads", perUser: 5 }
];

function isZh() {
  return getLanguage() === "zh";
}

function tx(zh, en) {
  return isZh() ? zh : en;
}

function normPath(path) {
  return String(path || "").replace(/\/+$/u, "") || "/";
}

function findTool(pathname) {
  const p = normPath(pathname);
  return Object.values(unitTools).find((tool) => normPath(tool.path) === p) || null;
}

function formatNumber(value, precision = "general") {
  if (!Number.isFinite(value)) {
    return "-";
  }
  const places = PRECISION[precision] ?? 4;
  if (precision === "finance") {
    return value.toFixed(places);
  }
  const abs = Math.abs(value);
  if (abs >= 1e12 || (abs > 0 && abs < 1e-8)) {
    return value.toExponential(Math.max(1, places - 1));
  }
  return value
    .toFixed(places)
    .replace(/\.0+$/u, "")
    .replace(/(\.\d*?)0+$/u, "$1");
}

function parseNum(value, allowZero = false) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return null;
  }
  if (allowZero) {
    return n < 0 ? null : n;
  }
  return n <= 0 ? null : n;
}

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  return node;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.append(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

function getOffsetMs(zone, epochMs) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(new Date(epochMs));
  const token = parts.find((item) => item.type === "timeZoneName")?.value || "GMT+00:00";
  const match = token.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/iu);
  if (!match) {
    return 0;
  }
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] || 0)) * 60000;
}

function wallParts(zone, epochMs) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const map = {};
  fmt.formatToParts(new Date(epochMs)).forEach((part) => {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  });
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second)
  };
}

function parseDatetime(text) {
  const match = String(text || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/u);
  if (!match) {
    return null;
  }
  const p = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0)
  };
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second));
  if (d.getUTCFullYear() !== p.year || d.getUTCMonth() + 1 !== p.month || d.getUTCDate() !== p.day) {
    return null;
  }
  return p;
}

function wallEq(a, b) {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.second === b.second
  );
}

function wallToEpoch(parts, zone) {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let epoch = target;
  for (let i = 0; i < 6; i += 1) {
    const next = target - getOffsetMs(zone, epoch);
    if (next === epoch) {
      break;
    }
    epoch = next;
  }
  for (const c of [epoch, epoch + 3600000, epoch - 3600000]) {
    if (wallEq(wallParts(zone, c), parts)) {
      return c;
    }
  }
  return null;
}

function fmtByZone(zone, epochMs) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short"
  }).format(new Date(epochMs));
}

function createUi(tool, nodes) {
  let outputText = "";
  const watch = [];

  const ui = {
    fmt: (value, precision) => formatNumber(value, precision || tool.precision || "general"),
    clearInputs() {
      nodes.inputs.replaceChildren();
    },
    setError(message) {
      nodes.error.textContent = message || "";
      nodes.error.hidden = !message;
    },
    setHint(message) {
      const p = el("p", "hint");
      p.textContent = message || "";
      nodes.output.replaceChildren(p);
      outputText = "";
    },
    setRows(rows) {
      const grid = el("div", "uc-result-grid");
      rows.forEach((row) => {
        const item = el("div", "uc-result-item");
        const k = el("div", "uc-result-label");
        const v = el("div", "uc-result-value");
        k.textContent = row.label;
        v.textContent = row.value;
        item.append(k, v);
        grid.append(item);
      });
      nodes.output.replaceChildren(grid);
      outputText = rows.map((row) => `${row.label}: ${row.value}`).join("\n");
    },
    setTable(headers, rows) {
      const table = el("table", "uc-table");
      const thead = document.createElement("thead");
      const trh = document.createElement("tr");
      headers.forEach((text) => {
        const th = document.createElement("th");
        th.textContent = text;
        trh.append(th);
      });
      thead.append(trh);
      const tbody = document.createElement("tbody");
      rows.forEach((row) => {
        const tr = document.createElement("tr");
        row.forEach((text) => {
          const td = document.createElement("td");
          td.textContent = text;
          tr.append(td);
        });
        tbody.append(tr);
      });
      table.append(thead, tbody);
      nodes.output.replaceChildren(table);
      outputText = rows.map((row) => row.join(": ")).join("\n");
    },
    numField(id, labelZh, labelEn, value = "", options = {}) {
      const wrap = el("div", "field");
      const label = document.createElement("label");
      label.setAttribute("for", id);
      label.textContent = tx(labelZh, labelEn);
      const input = document.createElement("input");
      input.type = "number";
      input.id = id;
      input.step = options.step || "any";
      if (options.min !== undefined) {
        input.min = String(options.min);
      }
      if (options.max !== undefined) {
        input.max = String(options.max);
      }
      input.value = String(value ?? "");
      wrap.append(label, input);
      nodes.inputs.append(wrap);
      return input;
    },
    textField(id, type, labelZh, labelEn, value = "") {
      const wrap = el("div", "field");
      const label = document.createElement("label");
      label.setAttribute("for", id);
      label.textContent = tx(labelZh, labelEn);
      const input = document.createElement("input");
      input.type = type;
      input.id = id;
      input.value = String(value ?? "");
      wrap.append(label, input);
      nodes.inputs.append(wrap);
      return input;
    },
    textArea(id, labelZh, labelEn, placeholderZh = "", placeholderEn = "") {
      const wrap = el("div", "field");
      const label = document.createElement("label");
      label.setAttribute("for", id);
      label.textContent = tx(labelZh, labelEn);
      const textarea = document.createElement("textarea");
      textarea.id = id;
      textarea.placeholder = tx(placeholderZh, placeholderEn);
      wrap.append(label, textarea);
      nodes.inputs.append(wrap);
      return textarea;
    },
    selectField(id, labelZh, labelEn, choices, value) {
      const wrap = el("div", "field");
      const label = document.createElement("label");
      label.setAttribute("for", id);
      label.textContent = tx(labelZh, labelEn);
      const select = document.createElement("select");
      select.id = id;
      choices.forEach((c) => {
        const option = document.createElement("option");
        option.value = c.value;
        option.textContent = tx(c.zh, c.en);
        if (c.value === value) {
          option.selected = true;
        }
        select.append(option);
      });
      wrap.append(label, select);
      nodes.inputs.append(wrap);
      return select;
    },
    watch(inputs, fn) {
      const refresh = () => {
        try {
          fn();
        } catch {
          ui.setError(tx("輸入格式錯誤", "Invalid input format"));
        }
      };
      inputs.forEach((input) => {
        input.addEventListener("input", refresh);
        input.addEventListener("change", refresh);
      });
      watch.push(refresh);
      refresh();
    },
    getOutputText() {
      return outputText;
    }
  };

  return ui;
}

function renderFactor(tool, ui) {
  const value = ui.numField("uc-value", "數值", "Value", "", { min: 0 });
  const unit = ui.selectField(
    "uc-unit",
    "單位",
    "Unit",
    tool.units.map((item) => ({ value: item.key, zh: item.label.zh, en: item.label.en })),
    tool.units[0]?.key
  );
  ui.watch([value, unit], () => {
    const n = parseNum(value.value, true);
    if (n === null) {
      ui.setError(tx("請輸入合法數值。", "Please enter a valid number."));
      ui.setHint(tx("輸入後會即時顯示完整轉換表。", "The full conversion table appears instantly."));
      return;
    }
    const src = tool.units.find((item) => item.key === unit.value);
    const base = n * src.factor;
    ui.setError("");
    ui.setTable(
      [tx("單位", "Unit"), tx("結果", "Converted")],
      tool.units.map((item) => [item.label[isZh() ? "zh" : "en"], `${ui.fmt(base / item.factor)} ${item.label.en}`])
    );
  });
}

function renderBandwidth(ui) {
  const total = ui.numField("uc-total", "總頻寬", "Total bandwidth", 100, { min: 0 });
  const unit = ui.selectField(
    "uc-bw-unit",
    "頻寬單位",
    "Bandwidth unit",
    [
      { value: "Mbps", zh: "Mbps", en: "Mbps" },
      { value: "Gbps", zh: "Gbps", en: "Gbps" }
    ],
    "Mbps"
  );
  const users = ui.numField("uc-users", "使用人數", "Users", 20, { min: 1, step: "1" });
  const mode = ui.selectField(
    "uc-mode",
    "使用模式",
    "Usage mode",
    BANDWIDTH_MODES.map((m) => ({ value: m.value, zh: m.zh, en: m.en })),
    "meeting"
  );
  ui.watch([total, unit, users, mode], () => {
    const totalValue = parseNum(total.value);
    const usersValue = parseNum(users.value);
    if (totalValue === null || usersValue === null) {
      ui.setError(tx("請輸入有效頻寬與人數。", "Please enter valid bandwidth and users."));
      ui.setHint("");
      return;
    }
    const modeData = BANDWIDTH_MODES.find((item) => item.value === mode.value);
    const totalMbps = unit.value === "Gbps" ? totalValue * 1000 : totalValue;
    const required = usersValue * modeData.perUser;
    const suggested = required * 1.25;
    const enough = totalMbps >= required;
    const analysis = enough
      ? totalMbps >= suggested
        ? tx("頻寬充足且有餘裕。", "Bandwidth is sufficient with headroom.")
        : tx("可使用，但高峰時段餘裕不足。", "Usable, but limited peak-time headroom.")
      : tx("頻寬不足，可能卡頓。", "Bandwidth is insufficient and may bottleneck.");
    ui.setError("");
    ui.setRows([
      { label: tx("是否足夠", "Sufficient"), value: enough ? tx("是", "Yes") : tx("否", "No") },
      { label: tx("目前總頻寬", "Total bandwidth"), value: `${ui.fmt(totalMbps)} Mbps` },
      { label: tx("需求頻寬", "Required bandwidth"), value: `${ui.fmt(required)} Mbps` },
      { label: tx("建議頻寬", "Suggested bandwidth"), value: `${ui.fmt(suggested)} Mbps` },
      { label: tx("瓶頸分析", "Bottleneck analysis"), value: analysis }
    ]);
  });
}

function renderDbmMw(ui) {
  const mode = ui.selectField(
    "uc-dbmmw-mode",
    "輸入類型",
    "Input type",
    [
      { value: "dbm", zh: "dBm", en: "dBm" },
      { value: "mw", zh: "mW", en: "mW" }
    ],
    "dbm"
  );
  const value = ui.numField("uc-dbmmw-value", "輸入值", "Input value", 20);
  ui.watch([mode, value], () => {
    const n = parseNum(value.value, true);
    if (n === null) {
      ui.setError(tx("請輸入合法數值。", "Please enter a valid number."));
      ui.setHint("");
      return;
    }
    let dbm;
    let mw;
    if (mode.value === "dbm") {
      dbm = n;
      mw = 10 ** (dbm / 10);
    } else {
      if (n <= 0) {
        ui.setError(tx("mW 必須大於 0。", "mW must be greater than 0."));
        ui.setHint("");
        return;
      }
      mw = n;
      dbm = 10 * Math.log10(mw);
    }
    ui.setError("");
    ui.setRows([
      { label: "dBm", value: ui.fmt(dbm, "engineering") },
      { label: "mW", value: ui.fmt(mw, "engineering") },
      { label: "W", value: ui.fmt(mw / 1000, "engineering") }
    ]);
  });
}

function renderDbRatio(ui, nameZh = "功率比", nameEn = "Power ratio") {
  const mode = ui.selectField(
    "uc-dbr-mode",
    "輸入模式",
    "Input mode",
    [
      { value: "db", zh: "dB", en: "dB" },
      { value: "power", zh: nameZh, en: nameEn },
      { value: "amplitude", zh: "振幅比", en: "Amplitude ratio" }
    ],
    "db"
  );
  const value = ui.numField("uc-dbr-value", "輸入值", "Input value", 10);
  ui.watch([mode, value], () => {
    const n = parseNum(value.value, true);
    if (n === null) {
      ui.setError(tx("請輸入合法數值。", "Please enter a valid number."));
      ui.setHint("");
      return;
    }
    let db;
    let power;
    let amp;
    if (mode.value === "db") {
      db = n;
      power = 10 ** (db / 10);
      amp = 10 ** (db / 20);
    } else if (mode.value === "power") {
      if (n <= 0) {
        ui.setError(tx("比值需大於 0。", "Ratio must be greater than 0."));
        ui.setHint("");
        return;
      }
      power = n;
      amp = Math.sqrt(power);
      db = 10 * Math.log10(power);
    } else {
      if (n <= 0) {
        ui.setError(tx("振幅比需大於 0。", "Amplitude ratio must be greater than 0."));
        ui.setHint("");
        return;
      }
      amp = n;
      power = amp ** 2;
      db = 20 * Math.log10(amp);
    }
    ui.setError("");
    ui.setRows([
      { label: "dB", value: ui.fmt(db, "engineering") },
      { label: tx(nameZh, nameEn), value: ui.fmt(power, "engineering") },
      { label: tx("振幅比", "Amplitude ratio"), value: ui.fmt(amp, "engineering") }
    ]);
  });
}

function renderOhmsLaw(ui) {
  const v = ui.numField("uc-ohm-v", "電壓 V", "Voltage V");
  const i = ui.numField("uc-ohm-i", "電流 A", "Current A");
  const r = ui.numField("uc-ohm-r", "電阻 Ω", "Resistance Ω");
  const p = ui.numField("uc-ohm-p", "功率 W", "Power W");
  const solve = (known) => {
    const has = (k) => Number.isFinite(known[k]);
    let V;
    let I;
    let R;
    let P;
    if (has("V") && has("I")) {
      V = known.V;
      I = known.I;
      if (I === 0) {
        return null;
      }
      R = V / I;
      P = V * I;
    } else if (has("V") && has("R")) {
      V = known.V;
      R = known.R;
      if (R === 0) {
        return null;
      }
      I = V / R;
      P = V * I;
    } else if (has("V") && has("P")) {
      V = known.V;
      P = known.P;
      if (V === 0) {
        return null;
      }
      I = P / V;
      R = V / I;
    } else if (has("I") && has("R")) {
      I = known.I;
      R = known.R;
      V = I * R;
      P = V * I;
    } else if (has("I") && has("P")) {
      I = known.I;
      P = known.P;
      if (I === 0) {
        return null;
      }
      V = P / I;
      R = V / I;
    } else if (has("R") && has("P")) {
      R = known.R;
      P = known.P;
      if (R <= 0 || P < 0) {
        return null;
      }
      I = Math.sqrt(P / R);
      V = I * R;
    } else {
      return null;
    }
    return { V, I, R, P };
  };
  ui.watch([v, i, r, p], () => {
    const known = {
      V: v.value.trim() === "" ? NaN : Number(v.value),
      I: i.value.trim() === "" ? NaN : Number(i.value),
      R: r.value.trim() === "" ? NaN : Number(r.value),
      P: p.value.trim() === "" ? NaN : Number(p.value)
    };
    if (Object.values(known).filter((value) => Number.isFinite(value)).length < 2) {
      ui.setError(tx("請至少輸入任兩項。", "Please enter at least two values."));
      ui.setHint(tx("系統會即時計算 V / I / R / P。", "V / I / R / P are calculated instantly."));
      return;
    }
    const result = solve(known);
    if (!result || Object.values(result).some((value) => !Number.isFinite(value))) {
      ui.setError(tx("輸入組合無法計算。", "Input combination cannot be solved."));
      ui.setHint("");
      return;
    }
    ui.setError("");
    ui.setRows([
      { label: tx("電壓", "Voltage"), value: `${ui.fmt(result.V, "engineering")} V` },
      { label: tx("電流", "Current"), value: `${ui.fmt(result.I, "engineering")} A` },
      { label: tx("電阻", "Resistance"), value: `${ui.fmt(result.R, "engineering")} Ω` },
      { label: tx("功率", "Power"), value: `${ui.fmt(result.P, "engineering")} W` }
    ]);
  });
}

function renderElectricCost(ui) {
  const power = ui.numField("uc-elec-power", "功率", "Power", 1200, { min: 0 });
  const unit = ui.selectField(
    "uc-elec-unit",
    "功率單位",
    "Power unit",
    [
      { value: "W", zh: "W", en: "W" },
      { value: "kW", zh: "kW", en: "kW" }
    ],
    "W"
  );
  const hours = ui.numField("uc-elec-hours", "每日使用時間 (小時)", "Hours per day", 4, { min: 0 });
  const rate = ui.numField("uc-elec-rate", "電價 (每 kWh)", "Rate (per kWh)", 3.5, { min: 0 });
  ui.watch([power, unit, hours, rate], () => {
    const p = parseNum(power.value);
    const h = parseNum(hours.value, true);
    const r = parseNum(rate.value, true);
    if (p === null || h === null || r === null) {
      ui.setError(tx("請輸入有效數值。", "Please enter valid values."));
      ui.setHint("");
      return;
    }
    const watts = unit.value === "kW" ? p * 1000 : p;
    const dailyKwh = (watts / 1000) * h;
    const daily = dailyKwh * r;
    ui.setError("");
    ui.setRows([
      { label: tx("每日耗電", "Daily energy"), value: `${ui.fmt(dailyKwh, "finance")} kWh` },
      { label: tx("每日電費", "Daily cost"), value: ui.fmt(daily, "finance") },
      { label: tx("每月電費", "Monthly cost"), value: ui.fmt(daily * 30, "finance") },
      { label: tx("每年電費", "Yearly cost"), value: ui.fmt(daily * 365, "finance") }
    ]);
  });
}

function renderSalary(ui) {
  const amount = ui.numField("uc-salary-amount", "薪資金額", "Salary amount", 60000, { min: 0 });
  const period = ui.selectField(
    "uc-salary-period",
    "輸入週期",
    "Input period",
    [
      { value: "hour", zh: "時薪", en: "Hourly" },
      { value: "day", zh: "日薪", en: "Daily" },
      { value: "month", zh: "月薪", en: "Monthly" },
      { value: "year", zh: "年薪", en: "Yearly" }
    ],
    "month"
  );
  const hours = ui.numField("uc-salary-hours", "每日工時", "Hours per day", 8, { min: 0 });
  const days = ui.numField("uc-salary-days", "每月工作天數", "Work days per month", 22, { min: 0 });
  ui.watch([amount, period, hours, days], () => {
    const a = parseNum(amount.value);
    const h = parseNum(hours.value);
    const d = parseNum(days.value);
    if (a === null || h === null || d === null) {
      ui.setError(tx("請輸入有效薪資與工時。", "Please enter valid salary and work schedule."));
      ui.setHint("");
      return;
    }
    let hourly;
    if (period.value === "hour") {
      hourly = a;
    } else if (period.value === "day") {
      hourly = a / h;
    } else if (period.value === "month") {
      hourly = a / (d * h);
    } else {
      hourly = a / (12 * d * h);
    }
    const daily = hourly * h;
    const monthly = daily * d;
    const yearly = monthly * 12;
    ui.setError("");
    ui.setRows([
      { label: tx("時薪", "Hourly"), value: ui.fmt(hourly, "finance") },
      { label: tx("日薪", "Daily"), value: ui.fmt(daily, "finance") },
      { label: tx("月薪", "Monthly"), value: ui.fmt(monthly, "finance") },
      { label: tx("年薪", "Yearly"), value: ui.fmt(yearly, "finance") }
    ]);
  });
}

function renderTimezoneMeeting(ui) {
  const date = ui.textField(
    "uc-meet-date",
    "datetime-local",
    "會議時間",
    "Meeting time",
    new Date(Date.now() + 3600000).toISOString().slice(0, 16)
  );
  const from = ui.selectField(
    "uc-meet-from",
    "基準時區",
    "Base timezone",
    TIME_ZONES.map((zone) => ({ value: zone, zh: zone, en: zone })),
    "Asia/Taipei"
  );
  const a = ui.selectField(
    "uc-meet-a",
    "參與時區 A",
    "Participant zone A",
    TIME_ZONES.map((zone) => ({ value: zone, zh: zone, en: zone })),
    "UTC"
  );
  const b = ui.selectField(
    "uc-meet-b",
    "參與時區 B",
    "Participant zone B",
    TIME_ZONES.map((zone) => ({ value: zone, zh: zone, en: zone })),
    "America/New_York"
  );
  const c = ui.selectField(
    "uc-meet-c",
    "參與時區 C",
    "Participant zone C",
    TIME_ZONES.map((zone) => ({ value: zone, zh: zone, en: zone })),
    "Europe/London"
  );
  ui.watch([date, from, a, b, c], () => {
    const parsed = parseDatetime(date.value);
    if (!parsed) {
      ui.setError(tx("請輸入合法日期時間。", "Please enter a valid datetime."));
      ui.setHint("");
      return;
    }
    const epoch = wallToEpoch(parsed, from.value);
    if (!Number.isFinite(epoch)) {
      ui.setError(tx("無法解析該時區時間。", "Cannot resolve this wall time in timezone."));
      ui.setHint("");
      return;
    }
    const zones = Array.from(new Set([from.value, a.value, b.value, c.value]));
    const rows = zones.map((zone) => {
      const part = wallParts(zone, epoch);
      const inHours = part.hour >= 9 && part.hour < 18;
      return [zone, fmtByZone(zone, epoch), inHours ? tx("上班時段", "Business hours") : tx("非上班時段", "Off hours")];
    });
    ui.setError("");
    ui.setTable([tx("時區", "Timezone"), tx("當地時間", "Local time"), tx("狀態", "Status")], rows);
  });
}

function renderCountdown(ui) {
  const target = ui.textField(
    "uc-countdown-target",
    "datetime-local",
    "目標時間",
    "Target datetime",
    new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  );
  const tick = () => {
    const targetEpoch = new Date(target.value).getTime();
    if (!Number.isFinite(targetEpoch)) {
      ui.setError(tx("請輸入合法日期時間。", "Please enter a valid datetime."));
      ui.setHint("");
      return;
    }
    const diffMs = targetEpoch - Date.now();
    const s = Math.floor(Math.abs(diffMs) / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    ui.setError("");
    ui.setRows([
      { label: tx("狀態", "Status"), value: diffMs >= 0 ? tx("倒數中", "Counting down") : tx("已超過", "Elapsed") },
      { label: tx("天", "Days"), value: String(d) },
      { label: tx("時", "Hours"), value: String(h) },
      { label: tx("分", "Minutes"), value: String(m) },
      { label: tx("秒", "Seconds"), value: String(sec) }
    ]);
  };
  ui.watch([target], tick);
  const timer = window.setInterval(tick, 1000);
  return () => window.clearInterval(timer);
}

function renderTaskTimeEstimator(ui) {
  const count = ui.numField("uc-task-count", "任務數量", "Task count", 12, { min: 0, step: "1" });
  const minute = ui.numField("uc-task-minute", "每項任務分鐘", "Minutes per task", 30, { min: 0 });
  const overhead = ui.numField("uc-task-overhead", "緩衝百分比", "Overhead percentage", 20, { min: 0 });
  ui.watch([count, minute, overhead], () => {
    const c = parseNum(count.value, true);
    const m = parseNum(minute.value, true);
    const o = parseNum(overhead.value, true);
    if (c === null || m === null || o === null) {
      ui.setError(tx("請輸入有效數值。", "Please enter valid values."));
      ui.setHint("");
      return;
    }
    const totalMinutes = c * m * (1 + o / 100);
    const totalHours = totalMinutes / 60;
    ui.setError("");
    ui.setRows([
      { label: tx("總分鐘", "Total minutes"), value: ui.fmt(totalMinutes) },
      { label: tx("總工時", "Total hours"), value: ui.fmt(totalHours) },
      { label: tx("約工作天", "Estimated work days"), value: ui.fmt(totalHours / 8) },
      { label: tx("含緩衝倍率", "Overhead factor"), value: `${ui.fmt(1 + o / 100)}x` }
    ]);
  });
}

function renderAprApy(ui) {
  const rate = ui.numField("uc-apr-rate", "利率 (%)", "Rate (%)", 6, { min: 0 });
  const type = ui.selectField(
    "uc-apr-type",
    "輸入類型",
    "Input type",
    [
      { value: "apr", zh: "APR", en: "APR" },
      { value: "apy", zh: "APY", en: "APY" }
    ],
    "apr"
  );
  const n = ui.numField("uc-apr-n", "每年複利次數", "Compounds per year", 12, { min: 1, step: "1" });
  ui.watch([rate, type, n], () => {
    const r = parseNum(rate.value, true);
    const p = parseNum(n.value);
    if (r === null || p === null) {
      ui.setError(tx("請輸入有效利率與次數。", "Please enter valid rate and periods."));
      ui.setHint("");
      return;
    }
    let apr;
    let apy;
    if (type.value === "apr") {
      apr = r / 100;
      apy = (1 + apr / p) ** p - 1;
    } else {
      apy = r / 100;
      apr = p * ((1 + apy) ** (1 / p) - 1);
    }
    ui.setError("");
    ui.setRows([
      { label: "APR", value: `${ui.fmt(apr * 100, "finance")}%` },
      { label: "APY", value: `${ui.fmt(apy * 100, "finance")}%` },
      { label: tx("等效月報酬", "Effective monthly"), value: `${ui.fmt(((1 + apr / p) ** (p / 12) - 1) * 100, "finance")}%` }
    ]);
  });
}

function renderInterestRate(ui) {
  const principal = ui.numField("uc-int-principal", "本金", "Principal", 100000, { min: 0 });
  const rate = ui.numField("uc-int-rate", "年利率 (%)", "Annual rate (%)", 5, { min: 0 });
  const years = ui.numField("uc-int-years", "年數", "Years", 5, { min: 0 });
  const n = ui.numField("uc-int-n", "每年複利次數", "Compounds per year", 12, { min: 1, step: "1" });
  ui.watch([principal, rate, years, n], () => {
    const p = parseNum(principal.value);
    const r = parseNum(rate.value, true);
    const y = parseNum(years.value, true);
    const c = parseNum(n.value);
    if (p === null || r === null || y === null || c === null) {
      ui.setError(tx("請輸入有效參數。", "Please enter valid parameters."));
      ui.setHint("");
      return;
    }
    const rr = r / 100;
    const simple = p * (1 + rr * y);
    const compound = p * (1 + rr / c) ** (c * y);
    ui.setError("");
    ui.setRows([
      { label: tx("單利最終金額", "Simple final amount"), value: ui.fmt(simple, "finance") },
      { label: tx("複利最終金額", "Compound final amount"), value: ui.fmt(compound, "finance") },
      { label: tx("單利利息", "Simple interest"), value: ui.fmt(simple - p, "finance") },
      { label: tx("複利利息", "Compound interest"), value: ui.fmt(compound - p, "finance") }
    ]);
  });
}

function renderLoanPayment(ui) {
  const principal = ui.numField("uc-loan-principal", "貸款本金", "Loan principal", 1000000, { min: 0 });
  const rate = ui.numField("uc-loan-rate", "年利率 (%)", "Annual rate (%)", 2.5, { min: 0 });
  const years = ui.numField("uc-loan-years", "貸款年限", "Loan years", 30, { min: 0 });
  ui.watch([principal, rate, years], () => {
    const p = parseNum(principal.value);
    const r = parseNum(rate.value, true);
    const y = parseNum(years.value);
    if (p === null || r === null || y === null) {
      ui.setError(tx("請輸入有效貸款參數。", "Please enter valid loan parameters."));
      ui.setHint("");
      return;
    }
    const m = Math.round(y * 12);
    const mr = r / 1200;
    const pay =
      mr === 0 ? p / m : (p * mr * (1 + mr) ** m) / ((1 + mr) ** m - 1);
    ui.setError("");
    ui.setRows([
      { label: tx("月付金", "Monthly payment"), value: ui.fmt(pay, "finance") },
      { label: tx("總還款", "Total payment"), value: ui.fmt(pay * m, "finance") },
      { label: tx("總利息", "Total interest"), value: ui.fmt(pay * m - p, "finance") },
      { label: tx("期數", "Total months"), value: String(m) }
    ]);
  });
}

function renderEarlyPayoff(ui) {
  const principal = ui.numField("uc-early-principal", "貸款本金", "Loan principal", 1000000, { min: 0 });
  const rate = ui.numField("uc-early-rate", "年利率 (%)", "Annual rate (%)", 2.5, { min: 0 });
  const years = ui.numField("uc-early-years", "貸款年限", "Loan years", 30, { min: 0 });
  const extra = ui.numField("uc-early-extra", "每月加碼還款", "Extra monthly payment", 5000, { min: 0 });
  ui.watch([principal, rate, years, extra], () => {
    const p = parseNum(principal.value);
    const r = parseNum(rate.value, true);
    const y = parseNum(years.value);
    const ex = parseNum(extra.value, true);
    if (p === null || r === null || y === null || ex === null) {
      ui.setError(tx("請輸入有效參數。", "Please enter valid parameters."));
      ui.setHint("");
      return;
    }
    const m = Math.round(y * 12);
    const mr = r / 1200;
    const base = mr === 0 ? p / m : (p * mr * (1 + mr) ** m) / ((1 + mr) ** m - 1);
    let bal = p;
    let k = 0;
    let newInterest = 0;
    const pay = base + ex;
    while (bal > 1e-8 && k < 6000) {
      const interest = bal * mr;
      let principalPay = pay - interest;
      if (principalPay <= 0) {
        ui.setError(tx("加碼金額過低，無法提前還清。", "Extra payment is too low to amortize early."));
        ui.setHint("");
        return;
      }
      if (principalPay > bal) {
        principalPay = bal;
      }
      bal -= principalPay;
      newInterest += interest;
      k += 1;
    }
    const baseInterest = base * m - p;
    ui.setError("");
    ui.setRows([
      { label: tx("原本月付金", "Original monthly payment"), value: ui.fmt(base, "finance") },
      { label: tx("新月付金", "New monthly payment"), value: ui.fmt(pay, "finance") },
      { label: tx("原本總期數", "Original months"), value: String(m) },
      { label: tx("提前後期數", "Payoff months"), value: String(k) },
      { label: tx("縮短期數", "Months saved"), value: String(Math.max(0, m - k)) },
      { label: tx("節省利息", "Interest saved"), value: ui.fmt(Math.max(0, baseInterest - newInterest), "finance") }
    ]);
  });
}

function renderPercentage(ui) {
  const mode = ui.selectField(
    "uc-percent-mode",
    "模式",
    "Mode",
    [
      { value: "basePercent", zh: "基礎值 ± 百分比", en: "Base value ± percentage" },
      { value: "partOfTotal", zh: "值佔總量百分比", en: "Value as percent of total" },
      { value: "fromTo", zh: "由舊值到新值", en: "Change from old to new" }
    ],
    "basePercent"
  );
  const a = ui.numField("uc-percent-a", "數值 A", "Value A", 100, { min: 0 });
  const b = ui.numField("uc-percent-b", "數值 B", "Value B", 20, { min: 0 });
  const labelA = () => document.querySelector('label[for="uc-percent-a"]');
  const labelB = () => document.querySelector('label[for="uc-percent-b"]');
  const syncLabel = () => {
    const la = labelA();
    const lb = labelB();
    if (!la || !lb) {
      return;
    }
    if (mode.value === "basePercent") {
      la.textContent = tx("基礎值", "Base value");
      lb.textContent = tx("百分比 (%)", "Percent (%)");
    } else if (mode.value === "partOfTotal") {
      la.textContent = tx("部分值", "Part value");
      lb.textContent = tx("總量", "Total value");
    } else {
      la.textContent = tx("舊值", "Old value");
      lb.textContent = tx("新值", "New value");
    }
  };
  ui.watch([mode, a, b], () => {
    syncLabel();
    const x = parseNum(a.value, true);
    const y = parseNum(b.value, true);
    if (x === null || y === null) {
      ui.setError(tx("請輸入有效數值。", "Please enter valid values."));
      ui.setHint("");
      return;
    }
    if (mode.value === "basePercent") {
      const v = x * (y / 100);
      ui.setError("");
      ui.setRows([
        { label: tx("百分比值", "Percentage value"), value: ui.fmt(v, "finance") },
        { label: tx("增加後", "After increase"), value: ui.fmt(x + v, "finance") },
        { label: tx("減少後", "After decrease"), value: ui.fmt(x - v, "finance") }
      ]);
      return;
    }
    if (mode.value === "partOfTotal") {
      if (y === 0) {
        ui.setError(tx("總量不可為 0。", "Total cannot be 0."));
        ui.setHint("");
        return;
      }
      ui.setError("");
      ui.setRows([
        { label: tx("佔比", "Percentage"), value: `${ui.fmt((x / y) * 100, "finance")}%` },
        { label: tx("差值", "Difference"), value: ui.fmt(y - x, "finance") }
      ]);
      return;
    }
    if (x === 0) {
      ui.setError(tx("舊值不可為 0。", "Old value cannot be 0."));
      ui.setHint("");
      return;
    }
    ui.setError("");
    ui.setRows([
      { label: tx("變動百分比", "Change (%)"), value: `${ui.fmt(((y - x) / x) * 100, "finance")}%` },
      { label: tx("差值", "Difference"), value: ui.fmt(y - x, "finance") },
      { label: tx("倍率", "Multiplier"), value: `${ui.fmt(y / x)}x` }
    ]);
  });
}

function renderDiscountReverse(ui) {
  const final = ui.numField("uc-discount-final", "折後價", "Discounted price", 799, { min: 0 });
  const discount = ui.numField("uc-discount-percent", "折扣率 (%)", "Discount (%)", 20, { min: 0 });
  ui.watch([final, discount], () => {
    const f = parseNum(final.value, true);
    const d = parseNum(discount.value, true);
    if (f === null || d === null) {
      ui.setError(tx("請輸入有效數值。", "Please enter valid values."));
      ui.setHint("");
      return;
    }
    if (d >= 100) {
      ui.setError(tx("折扣率需小於 100%。", "Discount must be below 100%."));
      ui.setHint("");
      return;
    }
    const origin = f / (1 - d / 100);
    ui.setError("");
    ui.setRows([
      { label: tx("原價", "Original price"), value: ui.fmt(origin, "finance") },
      { label: tx("折扣金額", "Saved amount"), value: ui.fmt(origin - f, "finance") },
      { label: tx("折後價", "Final price"), value: ui.fmt(f, "finance") }
    ]);
  });
}

function renderWavelengthFrequency(ui) {
  const C = 299792458;
  const wlUnits = [
    { value: "m", zh: "m", en: "m", factor: 1 },
    { value: "cm", zh: "cm", en: "cm", factor: 0.01 },
    { value: "mm", zh: "mm", en: "mm", factor: 0.001 },
    { value: "um", zh: "um", en: "um", factor: 1e-6 },
    { value: "nm", zh: "nm", en: "nm", factor: 1e-9 }
  ];
  const frUnits = [
    { value: "Hz", zh: "Hz", en: "Hz", factor: 1 },
    { value: "kHz", zh: "kHz", en: "kHz", factor: 1e3 },
    { value: "MHz", zh: "MHz", en: "MHz", factor: 1e6 },
    { value: "GHz", zh: "GHz", en: "GHz", factor: 1e9 },
    { value: "THz", zh: "THz", en: "THz", factor: 1e12 }
  ];
  const mode = ui.selectField(
    "uc-wave-mode",
    "輸入模式",
    "Input mode",
    [
      { value: "wavelength", zh: "波長", en: "Wavelength" },
      { value: "frequency", zh: "頻率", en: "Frequency" }
    ],
    "wavelength"
  );
  const value = ui.numField("uc-wave-value", "輸入值", "Input value", 532);
  const unit = ui.selectField(
    "uc-wave-unit",
    "單位",
    "Unit",
    wlUnits.map((u) => ({ value: u.value, zh: u.zh, en: u.en })),
    "nm"
  );
  const syncUnits = () => {
    const source = mode.value === "wavelength" ? wlUnits : frUnits;
    const fallback = mode.value === "wavelength" ? "nm" : "MHz";
    unit.replaceChildren();
    source.forEach((u) => {
      const option = document.createElement("option");
      option.value = u.value;
      option.textContent = u.value;
      unit.append(option);
    });
    unit.value = source.some((u) => u.value === fallback) ? fallback : source[0].value;
  };
  ui.watch([mode, value, unit], () => {
    const n = parseNum(value.value);
    if (n === null) {
      ui.setError(tx("請輸入大於 0 的數值。", "Please enter a value greater than 0."));
      ui.setHint("");
      return;
    }
    let lambda;
    let freq;
    if (mode.value === "wavelength") {
      const u = wlUnits.find((item) => item.value === unit.value);
      if (!u) {
        syncUnits();
        return;
      }
      lambda = n * u.factor;
      freq = C / lambda;
    } else {
      const u = frUnits.find((item) => item.value === unit.value);
      if (!u) {
        syncUnits();
        return;
      }
      freq = n * u.factor;
      lambda = C / freq;
    }
    ui.setError("");
    ui.setRows([
      ...wlUnits.map((u) => ({ label: `${tx("波長", "Wavelength")} (${u.value})`, value: ui.fmt(lambda / u.factor, "engineering") })),
      ...frUnits.map((u) => ({ label: `${tx("頻率", "Frequency")} (${u.value})`, value: ui.fmt(freq / u.factor, "engineering") }))
    ]);
  });
  mode.addEventListener("change", () => {
    syncUnits();
    value.dispatchEvent(new Event("input"));
  });
}

function renderRecordingSize(ui) {
  const bitrate = ui.numField("uc-record-bitrate", "Bitrate (kbps)", "Bitrate (kbps)", 256, { min: 0 });
  const duration = ui.numField("uc-record-duration", "時長 (分鐘)", "Duration (minutes)", 30, { min: 0 });
  ui.watch([bitrate, duration], () => {
    const b = parseNum(bitrate.value);
    const d = parseNum(duration.value);
    if (b === null || d === null) {
      ui.setError(tx("請輸入有效 bitrate 與時長。", "Please enter valid bitrate and duration."));
      ui.setHint("");
      return;
    }
    const bytes = (b * 1000 * d * 60) / 8;
    ui.setError("");
    ui.setRows([
      { label: tx("大小 (MB)", "Size (MB)"), value: ui.fmt(bytes / 1e6) },
      { label: tx("大小 (MiB)", "Size (MiB)"), value: ui.fmt(bytes / (1024 * 1024)) },
      { label: tx("總位元組", "Total bytes"), value: ui.fmt(bytes) }
    ]);
  });
}

function renderBmi(ui) {
  const h = ui.numField("uc-bmi-height", "身高 (cm)", "Height (cm)", 170, { min: 0 });
  const w = ui.numField("uc-bmi-weight", "體重 (kg)", "Weight (kg)", 65, { min: 0 });
  ui.watch([h, w], () => {
    const height = parseNum(h.value);
    const weight = parseNum(w.value);
    if (height === null || weight === null) {
      ui.setError(tx("請輸入有效身高與體重。", "Please enter valid height and weight."));
      ui.setHint("");
      return;
    }
    const bmi = weight / ((height / 100) ** 2);
    const level =
      bmi < 18.5 ? tx("體重過輕", "Underweight") : bmi < 25 ? tx("正常", "Normal") : bmi < 30 ? tx("過重", "Overweight") : tx("肥胖", "Obesity");
    ui.setError("");
    ui.setRows([
      { label: "BMI", value: ui.fmt(bmi) },
      { label: tx("分類", "Category"), value: level }
    ]);
  });
}

function renderBmr(ui) {
  const sex = ui.selectField(
    "uc-bmr-sex",
    "性別",
    "Sex",
    [
      { value: "male", zh: "男性", en: "Male" },
      { value: "female", zh: "女性", en: "Female" }
    ],
    "male"
  );
  const age = ui.numField("uc-bmr-age", "年齡", "Age", 30, { min: 0 });
  const height = ui.numField("uc-bmr-height", "身高 (cm)", "Height (cm)", 170, { min: 0 });
  const weight = ui.numField("uc-bmr-weight", "體重 (kg)", "Weight (kg)", 65, { min: 0 });
  ui.watch([sex, age, height, weight], () => {
    const a = parseNum(age.value);
    const h = parseNum(height.value);
    const w = parseNum(weight.value);
    if (a === null || h === null || w === null) {
      ui.setError(tx("請輸入有效身體資料。", "Please enter valid body metrics."));
      ui.setHint("");
      return;
    }
    const bmr = sex.value === "male" ? 10 * w + 6.25 * h - 5 * a + 5 : 10 * w + 6.25 * h - 5 * a - 161;
    ui.setError("");
    ui.setRows([
      { label: "BMR", value: `${ui.fmt(bmr)} kcal/day` },
      { label: `${tx("維持熱量", "Maintenance")} - ${tx("久坐", "Sedentary")}`, value: `${ui.fmt(bmr * 1.2)} kcal/day` },
      { label: `${tx("維持熱量", "Maintenance")} - ${tx("輕度活動", "Light activity")}`, value: `${ui.fmt(bmr * 1.375)} kcal/day` },
      { label: `${tx("維持熱量", "Maintenance")} - ${tx("中度活動", "Moderate activity")}`, value: `${ui.fmt(bmr * 1.55)} kcal/day` },
      { label: `${tx("維持熱量", "Maintenance")} - ${tx("高活動", "High activity")}`, value: `${ui.fmt(bmr * 1.725)} kcal/day` }
    ]);
  });
}

function renderJsonSize(ui) {
  const text = ui.textArea("uc-json-size", "JSON 內容", "JSON content", "貼上 JSON 文字", "Paste JSON text");
  ui.watch([text], () => {
    if (!text.value.trim()) {
      ui.setError("");
      ui.setHint(tx("請輸入 JSON 內容。", "Please input JSON content."));
      return;
    }
    try {
      const encoder = new TextEncoder();
      const parsed = JSON.parse(text.value);
      const min = JSON.stringify(parsed);
      const pretty = JSON.stringify(parsed, null, 2);
      ui.setError("");
      ui.setRows([
        { label: tx("輸入字元", "Input chars"), value: String(text.value.length) },
        { label: tx("輸入位元組", "Input bytes"), value: String(encoder.encode(text.value).length) },
        { label: tx("最小化字元", "Minified chars"), value: String(min.length) },
        { label: tx("最小化位元組", "Minified bytes"), value: String(encoder.encode(min).length) },
        { label: tx("格式化字元", "Pretty chars"), value: String(pretty.length) },
        { label: tx("格式化位元組", "Pretty bytes"), value: String(encoder.encode(pretty).length) }
      ]);
    } catch (error) {
      ui.setError(tx("JSON 格式錯誤。", "Invalid JSON format."));
      ui.setRows([{ label: tx("錯誤訊息", "Error message"), value: error instanceof Error ? error.message : String(error) }]);
    }
  });
}

function renderBase64Length(ui) {
  const mode = ui.selectField(
    "uc-b64-mode",
    "模式",
    "Mode",
    [
      { value: "bytesToBase64", zh: "位元組 → Base64", en: "Bytes -> Base64" },
      { value: "base64ToBytes", zh: "Base64 → 位元組", en: "Base64 -> Bytes" }
    ],
    "bytesToBase64"
  );
  const bytes = ui.numField("uc-b64-bytes", "位元組長度", "Byte length", 1024, { min: 0, step: "1" });
  const base64 = ui.textArea("uc-b64-text", "Base64 字串", "Base64 string", "貼上 Base64", "Paste Base64 text");
  const sync = () => {
    const bytesWrap = bytes.closest(".field");
    const textWrap = base64.closest(".field");
    const bytesMode = mode.value === "bytesToBase64";
    if (bytesWrap) {
      bytesWrap.hidden = !bytesMode;
    }
    if (textWrap) {
      textWrap.hidden = bytesMode;
    }
  };
  ui.watch([mode, bytes, base64], () => {
    sync();
    if (mode.value === "bytesToBase64") {
      const n = parseNum(bytes.value, true);
      if (n === null) {
        ui.setError(tx("請輸入有效位元組數。", "Please enter a valid byte length."));
        ui.setHint("");
        return;
      }
      const len = Math.ceil(n / 3) * 4;
      const pad = n % 3 === 0 ? 0 : n % 3 === 1 ? 2 : 1;
      ui.setError("");
      ui.setRows([
        { label: tx("原始位元組", "Raw bytes"), value: String(n) },
        { label: tx("Base64 長度", "Base64 length"), value: String(len) },
        { label: tx("補齊字元 =", "Padding ="), value: String(pad) }
      ]);
      return;
    }
    const raw = base64.value.replace(/\s+/gu, "");
    if (!raw) {
      ui.setError("");
      ui.setHint(tx("請輸入 Base64 字串。", "Please input Base64 string."));
      return;
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(raw) || raw.length % 4 !== 0) {
      ui.setError(tx("Base64 字串格式錯誤。", "Invalid Base64 string."));
      ui.setHint("");
      return;
    }
    const pad = raw.endsWith("==") ? 2 : raw.endsWith("=") ? 1 : 0;
    const decoded = (raw.length / 4) * 3 - pad;
    ui.setError("");
    ui.setRows([
      { label: tx("Base64 長度", "Base64 length"), value: String(raw.length) },
      { label: tx("解碼位元組", "Decoded bytes"), value: String(decoded) },
      { label: tx("補齊字元 =", "Padding ="), value: String(pad) }
    ]);
  });
}

function renderStringLength(ui) {
  const text = ui.textArea("uc-string-len", "文字內容", "Text content", "輸入或貼上文字", "Type or paste text");
  ui.watch([text], () => {
    const value = text.value;
    ui.setError("");
    ui.setRows([
      { label: tx("字元數 (UTF-16)", "Characters (UTF-16)"), value: String(value.length) },
      { label: tx("字元數 (Code Point)", "Characters (Code points)"), value: String(Array.from(value).length) },
      { label: tx("UTF-8 位元組", "UTF-8 bytes"), value: String(new TextEncoder().encode(value).length) },
      { label: tx("行數", "Lines"), value: String(value ? value.split(/\r\n|\r|\n/u).length : 0) },
      { label: tx("單詞數", "Words"), value: String(value.trim() ? value.trim().split(/\s+/u).length : 0) }
    ]);
  });
}

const RENDERERS = {
  factor: renderFactor,
  bandwidth: (_tool, ui) => renderBandwidth(ui),
  dbmMw: (_tool, ui) => renderDbmMw(ui),
  dbRatio: (tool, ui) => renderDbRatio(ui, "功率比", "Power ratio"),
  ohmsLaw: (_tool, ui) => renderOhmsLaw(ui),
  electricCost: (_tool, ui) => renderElectricCost(ui),
  salary: (_tool, ui) => renderSalary(ui),
  timezoneMeeting: (_tool, ui) => renderTimezoneMeeting(ui),
  countdown: (_tool, ui) => renderCountdown(ui),
  taskTimeEstimator: (_tool, ui) => renderTaskTimeEstimator(ui),
  aprApy: (_tool, ui) => renderAprApy(ui),
  interestRate: (_tool, ui) => renderInterestRate(ui),
  loanPayment: (_tool, ui) => renderLoanPayment(ui),
  earlyPayoff: (_tool, ui) => renderEarlyPayoff(ui),
  percentage: (_tool, ui) => renderPercentage(ui),
  discountReverse: (_tool, ui) => renderDiscountReverse(ui),
  wavelengthFrequency: (_tool, ui) => renderWavelengthFrequency(ui),
  dbVolume: (_tool, ui) => renderDbRatio(ui, "音量比", "Volume ratio"),
  recordingSize: (_tool, ui) => renderRecordingSize(ui),
  bmi: (_tool, ui) => renderBmi(ui),
  bmr: (_tool, ui) => renderBmr(ui),
  jsonSize: (_tool, ui) => renderJsonSize(ui),
  base64Length: (_tool, ui) => renderBase64Length(ui),
  stringLength: (_tool, ui) => renderStringLength(ui)
};

function applyPageText(tool, nodes) {
  const language = isZh() ? "zh" : "en";
  const title = tool.title[language] || tool.title.en;
  const lead = tool.lead[language] || tool.lead.en;
  document.title = `ToolNestTW ${title}`;
  nodes.title.textContent = title;
  nodes.lead.textContent = lead;
  nodes.inputTitle.textContent = tx("輸入", "Input");
  nodes.outputTitle.textContent = tx("輸出", "Output");
  nodes.copyBtn.textContent = tx("複製輸出", "Copy Output");
  nodes.howTitle.textContent = tx("使用方式", "How to use");
  nodes.howText.textContent = tx("輸入欄位後即時輸出結果，無需點擊計算按鈕。", "Results update instantly as you type without a calculate button.");
  nodes.faqTitle.textContent = tx("常見問題", "FAQ");
  nodes.faq1.textContent = tx("資料會上傳嗎？不會，全部在本機完成。", "Is data uploaded? No, everything runs locally.");
  nodes.faq2.textContent = tx("精度規則：一般 4 位、工程 6 位、金融 2 位小數。", "Precision: General 4, Engineering 6, Finance 2 decimals.");
  nodes.recommendedTitle.textContent = tx("同類工具", "Related tools");
}

function renderRecommended(tool, host) {
  const language = isZh() ? "zh" : "en";
  const related = getToolsByCategory(tool.category).filter((item) => item.key !== tool.key).slice(0, 3);
  host.replaceChildren();
  related.forEach((item) => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = item.path;
    link.textContent = item.title[language] || item.title.en;
    li.append(link);
    host.append(li);
  });
}

export default function initUnitConverterToolPage() {
  const tool = findTool(window.location.pathname);
  if (!tool) {
    return;
  }

  const nodes = {
    title: document.querySelector("#uc-title"),
    lead: document.querySelector("#uc-lead"),
    inputTitle: document.querySelector("#uc-input-title"),
    outputTitle: document.querySelector("#uc-output-title"),
    howTitle: document.querySelector("#uc-how-title"),
    howText: document.querySelector("#uc-how-text"),
    faqTitle: document.querySelector("#uc-faq-title"),
    faq1: document.querySelector("#uc-faq-1"),
    faq2: document.querySelector("#uc-faq-2"),
    recommendedTitle: document.querySelector("#uc-recommended-title"),
    recommendedList: document.querySelector("#uc-recommended-list"),
    inputs: document.querySelector("#uc-inputs"),
    output: document.querySelector("#uc-output"),
    error: document.querySelector("#uc-error"),
    copyBtn: document.querySelector("#uc-copy-btn")
  };
  if (Object.values(nodes).some((node) => !node)) {
    return;
  }

  applyPageText(tool, nodes);
  renderRecommended(tool, nodes.recommendedList);
  const ui = createUi(tool, nodes);
  ui.clearInputs();
  const render = RENDERERS[tool.type];
  if (!render) {
    ui.setError(tx("工具尚未完成。", "Tool is not ready."));
    ui.setHint(tx("請稍後再試。", "Please try again later."));
    return;
  }
  let cleanup = render(tool, ui);

  nodes.copyBtn.addEventListener("click", async () => {
    const text = ui.getOutputText();
    if (!text.trim()) {
      toast(tx("目前沒有可複製的結果。", "No output to copy."));
      return;
    }
    try {
      await copyText(text);
      toast(tx("已複製到剪貼簿。", "Copied to clipboard."), "success");
    } catch {
      toast(tx("複製失敗。", "Copy failed."));
    }
  });

  onLanguageChange(() => {
    if (typeof cleanup === "function") {
      cleanup();
    }
    applyPageText(tool, nodes);
    renderRecommended(tool, nodes.recommendedList);
    ui.clearInputs();
    cleanup = RENDERERS[tool.type](tool, ui);
  });
}

