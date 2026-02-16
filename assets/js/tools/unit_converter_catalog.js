export const unitCategories = [
  {
    key: "Network",
    name: { zh: "Network 類", en: "Network" },
    summary: { zh: "網路速度、頻寬與負載估算工具。", en: "Network speed and bandwidth estimators." },
    tools: ["network_speed_convert", "network_bandwidth_calculator"]
  },
  {
    key: "Engineering",
    name: { zh: "Engineering 類", en: "Engineering" },
    summary: { zh: "工程常用的力學與流體單位換算。", en: "Engineering conversion tools." },
    tools: [
      "engineering_torque",
      "engineering_pressure",
      "engineering_power",
      "engineering_force",
      "engineering_speed",
      "engineering_energy",
      "engineering_flow",
      "engineering_acceleration"
    ]
  },
  {
    key: "Electronics",
    name: { zh: "Electronics 類", en: "Electronics" },
    summary: { zh: "電子與訊號運算。", en: "Electronics and signal tools." },
    tools: ["electronics_dbm_mw", "electronics_db_ratio", "electronics_ohms_law"]
  },
  {
    key: "Power",
    name: { zh: "Power 類", en: "Power" },
    summary: { zh: "功率與用電成本估算。", en: "Power usage and cost tools." },
    tools: ["power_electric_cost"]
  },
  {
    key: "Time",
    name: { zh: "Time 類", en: "Time" },
    summary: { zh: "工時、會議與倒數相關工具。", en: "Time and scheduling tools." },
    tools: ["time_salary_calculator", "time_timezone_meeting", "time_countdown", "time_task_time_estimator"]
  },
  {
    key: "Finance",
    name: { zh: "Finance 類", en: "Finance" },
    summary: { zh: "利率與貸款試算工具。", en: "Finance and loan calculators." },
    tools: [
      "finance_apr_apy",
      "finance_interest_rate",
      "finance_loan_payment",
      "finance_early_payoff",
      "finance_percentage",
      "finance_discount_reverse"
    ]
  },
  {
    key: "Science",
    name: { zh: "Science 類", en: "Science" },
    summary: { zh: "科學領域換算。", en: "Science conversion tools." },
    tools: ["science_wavelength_frequency", "science_concentration"]
  },
  {
    key: "Media",
    name: { zh: "Media 類", en: "Media" },
    summary: { zh: "音量與錄音容量計算。", en: "Media and recording tools." },
    tools: ["media_db_volume", "media_recording_size"]
  },
  {
    key: "Health",
    name: { zh: "Health 類", en: "Health" },
    summary: { zh: "BMI 與 BMR 健康估算。", en: "Health calculators." },
    tools: ["health_bmi", "health_bmr"]
  },
  {
    key: "Developer",
    name: { zh: "Developer 類", en: "Developer" },
    summary: { zh: "開發常見長度與大小工具。", en: "Developer length and size tools." },
    tools: ["developer_json_size", "developer_base64_length", "developer_string_length"]
  }
];

const zones = [
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

function factorUnit(key, zh, en, factor) {
  return { key, label: { zh, en }, factor };
}

export const unitTools = {
  network_speed_convert: {
    key: "network_speed_convert",
    path: "/utility/unit_converter/Network/speed-convert/",
    category: "Network",
    slug: "speed-convert",
    title: { zh: "網速單位轉換", en: "Network Speed Converter" },
    lead: { zh: "Mbps、Gbps、MB/s 等網速單位即時互轉。", en: "Convert Mbps, Gbps, MB/s and more instantly." },
    type: "factor",
    precision: "general",
    units: [
      factorUnit("bps", "bps", "bps", 1),
      factorUnit("kbps", "Kbps", "Kbps", 1e3),
      factorUnit("mbps", "Mbps", "Mbps", 1e6),
      factorUnit("gbps", "Gbps", "Gbps", 1e9),
      factorUnit("Bps", "B/s", "B/s", 8),
      factorUnit("KBps", "KB/s", "KB/s", 8e3),
      factorUnit("MBps", "MB/s", "MB/s", 8e6),
      factorUnit("GBps", "GB/s", "GB/s", 8e9)
    ]
  },
  network_bandwidth_calculator: {
    key: "network_bandwidth_calculator",
    path: "/utility/unit_converter/Network/bandwidth-calculator/",
    category: "Network",
    slug: "bandwidth-calculator",
    title: { zh: "頻寬負載估算", en: "Bandwidth Calculator" },
    lead: { zh: "依人數與使用模式評估頻寬是否足夠。", en: "Estimate required bandwidth by user count and usage mode." },
    type: "bandwidth"
  },
  engineering_torque: {
    key: "engineering_torque",
    path: "/utility/unit_converter/Engineering/torque/",
    category: "Engineering",
    slug: "torque",
    title: { zh: "扭矩換算", en: "Torque Converter" },
    lead: { zh: "工程扭矩單位完整互轉。", en: "Convert torque units instantly." },
    type: "factor",
    precision: "engineering",
    units: [
      factorUnit("Nm", "N·m", "N·m", 1),
      factorUnit("kNm", "kN·m", "kN·m", 1000),
      factorUnit("lbft", "lb·ft", "lb·ft", 1.3558179483),
      factorUnit("lbin", "lb·in", "lb·in", 0.112984829)
    ]
  },
  engineering_pressure: {
    key: "engineering_pressure",
    path: "/utility/unit_converter/Engineering/pressure/",
    category: "Engineering",
    slug: "pressure",
    title: { zh: "壓力換算", en: "Pressure Converter" },
    lead: { zh: "Pa、bar、psi 等壓力單位互轉。", en: "Convert pressure units such as Pa/bar/psi." },
    type: "factor",
    precision: "engineering",
    units: [
      factorUnit("Pa", "Pa", "Pa", 1),
      factorUnit("kPa", "kPa", "kPa", 1000),
      factorUnit("MPa", "MPa", "MPa", 1e6),
      factorUnit("bar", "bar", "bar", 1e5),
      factorUnit("psi", "psi", "psi", 6894.757293),
      factorUnit("atm", "atm", "atm", 101325)
    ]
  },
  engineering_power: {
    key: "engineering_power",
    path: "/utility/unit_converter/Engineering/power/",
    category: "Engineering",
    slug: "power",
    title: { zh: "功率換算", en: "Power Converter" },
    lead: { zh: "W、kW、hp 等功率單位互轉。", en: "Convert W, kW, hp and more." },
    type: "factor",
    precision: "engineering",
    units: [
      factorUnit("W", "W", "W", 1),
      factorUnit("kW", "kW", "kW", 1000),
      factorUnit("MW", "MW", "MW", 1e6),
      factorUnit("hp", "hp", "hp", 745.699872)
    ]
  },
  engineering_force: {
    key: "engineering_force",
    path: "/utility/unit_converter/Engineering/force/",
    category: "Engineering",
    slug: "force",
    title: { zh: "力換算", en: "Force Converter" },
    lead: { zh: "N、kN、lbf 等力單位互轉。", en: "Convert force units instantly." },
    type: "factor",
    precision: "engineering",
    units: [
      factorUnit("N", "N", "N", 1),
      factorUnit("kN", "kN", "kN", 1000),
      factorUnit("lbf", "lbf", "lbf", 4.4482216153),
      factorUnit("kgf", "kgf", "kgf", 9.80665)
    ]
  },
  engineering_speed: {
    key: "engineering_speed",
    path: "/utility/unit_converter/Engineering/speed/",
    category: "Engineering",
    slug: "speed",
    title: { zh: "速度換算", en: "Speed Converter" },
    lead: { zh: "m/s、km/h、mph 等速度單位互轉。", en: "Convert m/s, km/h, mph, and knots." },
    type: "factor",
    precision: "engineering",
    units: [
      factorUnit("ms", "m/s", "m/s", 1),
      factorUnit("kmh", "km/h", "km/h", 0.2777777778),
      factorUnit("mph", "mph", "mph", 0.44704),
      factorUnit("knot", "knot", "knot", 0.514444)
    ]
  },
  engineering_energy: {
    key: "engineering_energy",
    path: "/utility/unit_converter/Engineering/energy/",
    category: "Engineering",
    slug: "energy",
    title: { zh: "能量換算", en: "Energy Converter" },
    lead: { zh: "J、kWh、cal 等能量單位互轉。", en: "Convert J, kWh, and calories." },
    type: "factor",
    precision: "engineering",
    units: [
      factorUnit("J", "J", "J", 1),
      factorUnit("kJ", "kJ", "kJ", 1000),
      factorUnit("MJ", "MJ", "MJ", 1e6),
      factorUnit("Wh", "Wh", "Wh", 3600),
      factorUnit("kWh", "kWh", "kWh", 3.6e6),
      factorUnit("cal", "cal", "cal", 4.184)
    ]
  },
  engineering_flow: {
    key: "engineering_flow",
    path: "/utility/unit_converter/Engineering/flow/",
    category: "Engineering",
    slug: "flow",
    title: { zh: "流量換算", en: "Flow Converter" },
    lead: { zh: "m3/s、L/min、gpm 等流量單位互轉。", en: "Convert flow units for fluids." },
    type: "factor",
    precision: "engineering",
    units: [
      factorUnit("m3s", "m3/s", "m3/s", 1),
      factorUnit("Ls", "L/s", "L/s", 0.001),
      factorUnit("Lmin", "L/min", "L/min", 0.001 / 60),
      factorUnit("m3h", "m3/h", "m3/h", 1 / 3600),
      factorUnit("gpm", "gpm(US)", "gpm(US)", 6.30901964e-5)
    ]
  },
  engineering_acceleration: {
    key: "engineering_acceleration",
    path: "/utility/unit_converter/Engineering/acceleration/",
    category: "Engineering",
    slug: "acceleration",
    title: { zh: "加速度換算", en: "Acceleration Converter" },
    lead: { zh: "m/s²、g、ft/s² 等加速度互轉。", en: "Convert acceleration units instantly." },
    type: "factor",
    precision: "engineering",
    units: [
      factorUnit("ms2", "m/s²", "m/s²", 1),
      factorUnit("g", "g", "g", 9.80665),
      factorUnit("fts2", "ft/s²", "ft/s²", 0.3048)
    ]
  },
  electronics_dbm_mw: {
    key: "electronics_dbm_mw",
    path: "/utility/unit_converter/Electronics/dbm-mw/",
    category: "Electronics",
    slug: "dbm-mw",
    title: { zh: "dBm / mW 轉換", en: "dBm / mW Converter" },
    lead: { zh: "dBm 與 mW 即時互轉。", en: "Convert dBm and mW values instantly." },
    type: "dbmMw"
  },
  electronics_db_ratio: {
    key: "electronics_db_ratio",
    path: "/utility/unit_converter/Electronics/db-ratio/",
    category: "Electronics",
    slug: "db-ratio",
    title: { zh: "dB 比率轉換", en: "dB Ratio Converter" },
    lead: { zh: "dB 與功率/振幅比互轉。", en: "Convert dB to power/amplitude ratios." },
    type: "dbRatio"
  },
  electronics_ohms_law: {
    key: "electronics_ohms_law",
    path: "/utility/unit_converter/Electronics/ohms-law/",
    category: "Electronics",
    slug: "ohms-law",
    title: { zh: "歐姆定律", en: "Ohm's Law Calculator" },
    lead: { zh: "輸入任兩項，計算電壓/電流/電阻/功率。", en: "Solve V/I/R/P by supplying any two values." },
    type: "ohmsLaw"
  },
  power_electric_cost: {
    key: "power_electric_cost",
    path: "/utility/unit_converter/Power/electric-cost/",
    category: "Power",
    slug: "electric-cost",
    title: { zh: "電費試算", en: "Electric Cost Calculator" },
    lead: { zh: "由功率、使用時數與電價估算電費。", en: "Estimate daily/monthly/yearly electricity cost." },
    type: "electricCost",
    precision: "finance"
  },
  time_salary_calculator: {
    key: "time_salary_calculator",
    path: "/utility/unit_converter/Time/salary-calculator/",
    category: "Time",
    slug: "salary-calculator",
    title: { zh: "薪資換算", en: "Salary Calculator" },
    lead: { zh: "時薪、日薪、月薪、年薪即時互轉。", en: "Convert hourly/daily/monthly/annual pay." },
    type: "salary",
    precision: "finance"
  },
  time_timezone_meeting: {
    key: "time_timezone_meeting",
    path: "/utility/unit_converter/Time/timezone-meeting/",
    category: "Time",
    slug: "timezone-meeting",
    title: { zh: "跨時區會議時間", en: "Timezone Meeting Planner" },
    lead: { zh: "比較多個時區會議時間是否在上班時段。", en: "Compare meeting times across time zones." },
    type: "timezoneMeeting",
    zones
  },
  time_countdown: {
    key: "time_countdown",
    path: "/utility/unit_converter/Time/countdown/",
    category: "Time",
    slug: "countdown",
    title: { zh: "倒數計時", en: "Countdown" },
    lead: { zh: "計算距離目標時間還有多久。", en: "Count down to a target datetime." },
    type: "countdown"
  },
  time_task_time_estimator: {
    key: "time_task_time_estimator",
    path: "/utility/unit_converter/Time/task-time-estimator/",
    category: "Time",
    slug: "task-time-estimator",
    title: { zh: "任務工時估算", en: "Task Time Estimator" },
    lead: { zh: "以任務數量與單項時長估算總工時。", en: "Estimate total time from task count and duration." },
    type: "taskTimeEstimator",
    precision: "general"
  },
  finance_apr_apy: {
    key: "finance_apr_apy",
    path: "/utility/unit_converter/Finance/apr-apy/",
    category: "Finance",
    slug: "apr-apy",
    title: { zh: "APR / APY 轉換", en: "APR / APY Converter" },
    lead: { zh: "依複利次數換算 APR 與 APY。", en: "Convert APR and APY by compounding periods." },
    type: "aprApy",
    precision: "finance"
  },
  finance_interest_rate: {
    key: "finance_interest_rate",
    path: "/utility/unit_converter/Finance/interest-rate/",
    category: "Finance",
    slug: "interest-rate",
    title: { zh: "利息試算", en: "Interest Calculator" },
    lead: { zh: "計算單利與複利最終金額。", en: "Calculate final amount with simple/compound interest." },
    type: "interestRate",
    precision: "finance"
  },
  finance_loan_payment: {
    key: "finance_loan_payment",
    path: "/utility/unit_converter/Finance/loan-payment/",
    category: "Finance",
    slug: "loan-payment",
    title: { zh: "貸款月付金", en: "Loan Payment Calculator" },
    lead: { zh: "依本金、利率、期數計算月付金。", en: "Estimate monthly payment for a loan." },
    type: "loanPayment",
    precision: "finance"
  },
  finance_early_payoff: {
    key: "finance_early_payoff",
    path: "/utility/unit_converter/Finance/early-payoff/",
    category: "Finance",
    slug: "early-payoff",
    title: { zh: "提前還款試算", en: "Early Payoff Calculator" },
    lead: { zh: "估算加碼還款可省下的利息與時間。", en: "Estimate savings from extra loan payments." },
    type: "earlyPayoff",
    precision: "finance"
  },
  finance_percentage: {
    key: "finance_percentage",
    path: "/utility/unit_converter/Finance/percentage/",
    category: "Finance",
    slug: "percentage",
    title: { zh: "百分比計算", en: "Percentage Calculator" },
    lead: { zh: "計算百分比值、增加值與減少值。", en: "Calculate percentage values and +/- changes." },
    type: "percentage",
    precision: "finance"
  },
  finance_discount_reverse: {
    key: "finance_discount_reverse",
    path: "/utility/unit_converter/Finance/discount-reverse/",
    category: "Finance",
    slug: "discount-reverse",
    title: { zh: "折扣回推原價", en: "Discount Reverse Calculator" },
    lead: { zh: "由折後價與折扣率回推原價。", en: "Recover original price from discounted price." },
    type: "discountReverse",
    precision: "finance"
  },
  science_wavelength_frequency: {
    key: "science_wavelength_frequency",
    path: "/utility/unit_converter/Science/wavelength-frequency/",
    category: "Science",
    slug: "wavelength-frequency",
    title: { zh: "波長 / 頻率換算", en: "Wavelength / Frequency Converter" },
    lead: { zh: "依光速公式換算波長與頻率。", en: "Convert wavelength and frequency via speed of light." },
    type: "wavelengthFrequency",
    precision: "engineering"
  },
  science_concentration: {
    key: "science_concentration",
    path: "/utility/unit_converter/Science/concentration/",
    category: "Science",
    slug: "concentration",
    title: { zh: "濃度換算", en: "Concentration Converter" },
    lead: { zh: "常見質量濃度單位互轉。", en: "Convert common mass-concentration units." },
    type: "factor",
    precision: "general",
    units: [
      factorUnit("gL", "g/L", "g/L", 1),
      factorUnit("mgL", "mg/L", "mg/L", 0.001),
      factorUnit("ugmL", "ug/mL", "ug/mL", 0.001),
      factorUnit("ppm", "ppm", "ppm", 0.001),
      factorUnit("percentwv", "% w/v", "% w/v", 10)
    ]
  },
  media_db_volume: {
    key: "media_db_volume",
    path: "/utility/unit_converter/Media/db-volume/",
    category: "Media",
    slug: "db-volume",
    title: { zh: "dB 音量比換算", en: "dB Volume Converter" },
    lead: { zh: "dB 與振幅倍率互轉。", en: "Convert dB and amplitude ratio." },
    type: "dbVolume",
    precision: "general"
  },
  media_recording_size: {
    key: "media_recording_size",
    path: "/utility/unit_converter/Media/recording-size/",
    category: "Media",
    slug: "recording-size",
    title: { zh: "錄音容量估算", en: "Recording Size Estimator" },
    lead: { zh: "依 bitrate 與時長估算檔案大小。", en: "Estimate recording size by bitrate and duration." },
    type: "recordingSize",
    precision: "general"
  },
  health_bmi: {
    key: "health_bmi",
    path: "/utility/unit_converter/Health/bmi/",
    category: "Health",
    slug: "bmi",
    title: { zh: "BMI 計算", en: "BMI Calculator" },
    lead: { zh: "輸入身高體重計算 BMI。", en: "Calculate BMI from height and weight." },
    type: "bmi",
    precision: "general"
  },
  health_bmr: {
    key: "health_bmr",
    path: "/utility/unit_converter/Health/bmr/",
    category: "Health",
    slug: "bmr",
    title: { zh: "BMR 計算", en: "BMR Calculator" },
    lead: { zh: "依年齡、性別、身高、體重估算 BMR。", en: "Estimate BMR by age, sex, height, and weight." },
    type: "bmr",
    precision: "general"
  },
  developer_json_size: {
    key: "developer_json_size",
    path: "/utility/unit_converter/Developer/json-size/",
    category: "Developer",
    slug: "json-size",
    title: { zh: "JSON 大小計算", en: "JSON Size Calculator" },
    lead: { zh: "計算 JSON 字元數與 UTF-8 位元組大小。", en: "Measure JSON character and UTF-8 byte size." },
    type: "jsonSize",
    precision: "general"
  },
  developer_base64_length: {
    key: "developer_base64_length",
    path: "/utility/unit_converter/Developer/base64-length/",
    category: "Developer",
    slug: "base64-length",
    title: { zh: "Base64 長度計算", en: "Base64 Length Calculator" },
    lead: { zh: "估算 Base64 編碼後長度與解碼大小。", en: "Estimate Base64 encoded and decoded lengths." },
    type: "base64Length",
    precision: "general"
  },
  developer_string_length: {
    key: "developer_string_length",
    path: "/utility/unit_converter/Developer/string-length/",
    category: "Developer",
    slug: "string-length",
    title: { zh: "字串長度計算", en: "String Length Calculator" },
    lead: { zh: "計算字元數、位元組、行數與單詞數。", en: "Count characters, bytes, lines, and words." },
    type: "stringLength",
    precision: "general"
  }
};

export function getCategoryByKey(key) {
  return unitCategories.find((item) => item.key === key) || null;
}

export function getToolsByCategory(categoryKey) {
  const category = getCategoryByKey(categoryKey);
  if (!category) {
    return [];
  }
  return category.tools.map((key) => unitTools[key]).filter((item) => Boolean(item));
}

export function getToolByKey(key) {
  return unitTools[key] || null;
}

