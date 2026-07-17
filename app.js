// Thesis dashboard v5 — aligned with the revised Google Sheets structure
const config = window.APP_CONFIG || {}

const state = {
  annual: [],
  weekly: [],
  sections: [],
  sources: [],
  files: [],
  calendar: [],
  history: [],
  versions: []
}

const COMPLETED_STATUSES = [
  "انجام شد",
  "انجام‌شده",
  "تکمیل شد",
  "تکمیل شده",
  "مطالعه شده",
  "استفاده شده در متن"
]

const CANCELLED_STATUSES = [
  "لغوشده",
  "لغو شده"
]

document.addEventListener("DOMContentLoaded", init)

async function init() {
  applyConfig()
  bindNavigation()
  bindActions()
  restoreTheme()
  initVault()
  await loadAllData()
}

function applyConfig() {
  document.title = config.appTitle || "داشبورد رساله دکتری"

  setText("brandTitle", config.appTitle || "سامانه رساله")
  setText("brandSubtitle", config.appSubtitle || "داشبورد پیشرفت پژوهش")
  setText(
    "heroTitle",
    config.researcherName
      ? `پیشرفت رساله ${config.researcherName}`
      : "پیشرفت رساله در یک نگاه"
  )
  setText(
    "heroDescription",
    config.thesisTitle || "برنامه، فصل‌ها، منابع و فایل‌های اصلی"
  )

  setLink("sheetLink", config.links?.googleSheet)
  setLink("driveLink", config.links?.googleDriveFolder)
  setLink("heroDriveLink", config.links?.googleDriveFolder)
}

function setText(id, value) {
  const element = document.getElementById(id)
  if (element) element.textContent = value
}

function setLink(id, url) {
  const element = document.getElementById(id)
  if (!element) return

  const cleanUrl = String(url || "").trim()

  if (!isConfiguredUrl(cleanUrl)) {
    element.style.display = "none"
    return
  }

  element.href = cleanUrl
  element.style.display = ""
}

function bindNavigation() {
  document.querySelectorAll("[data-view-target]").forEach(item => {
    item.addEventListener("click", () => {
      openView(item.dataset.viewTarget)
      document.getElementById("sidebar")?.classList.remove("open")
    })
  })

  document.querySelectorAll("[data-jump]").forEach(item => {
    item.addEventListener("click", () => openView(item.dataset.jump))
  })
}

function openView(viewName) {
  document.querySelectorAll(".view").forEach(view => {
    view.classList.toggle("active", view.dataset.view === viewName)
  })

  document.querySelectorAll("[data-view-target]").forEach(item => {
    item.classList.toggle("active", item.dataset.viewTarget === viewName)
  })

  const activeButton = document.querySelector(
    `[data-view-target="${viewName}"]`
  )

  setText(
    "pageTitle",
    activeButton?.querySelector("span:last-child")?.textContent || "داشبورد"
  )

  window.scrollTo({ top: 0, behavior: "smooth" })
}

function bindActions() {
  document.getElementById("menuButton")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.toggle("open")
  })

  document.getElementById("themeButton")?.addEventListener("click", toggleTheme)

  document.getElementById("refreshButton")?.addEventListener("click", async () => {
    showToast("در حال تازه‌سازی داده‌ها")
    await loadAllData(true)
  })

  document.getElementById("sourceSearch")?.addEventListener("input", event => {
    renderSources(event.target.value)
  })

  document.getElementById("versionSearch")?.addEventListener("input", event => {
    renderVersions(event.target.value)
  })

  document.getElementById("notificationButton")?.addEventListener("click", requestDeadlineNotifications)
  document.getElementById("reportButton")?.addEventListener("click", printProgressReport)
  window.addEventListener("afterprint", cleanupPrintReport)

  bindVaultActions()
}

async function loadAllData(force = false) {
  const cacheKey = force ? `refresh=${Date.now()}` : ""

  await Promise.all([
    loadDataset("annual", config.csv?.annual, cacheKey),
    loadDataset("weekly", config.csv?.weekly, cacheKey),
    loadDataset("sections", config.csv?.sections, cacheKey),
    loadDataset("sources", config.csv?.sources, cacheKey),
    loadDataset("files", config.csv?.files, cacheKey),
    loadDataset("calendar", config.csv?.calendar, cacheKey),
    loadDataset("history", config.csv?.history, cacheKey),
    loadDataset("versions", config.csv?.versions, cacheKey)
  ])

  renderAll()

  setText(
    "lastUpdated",
    `آخرین به‌روزرسانی: ${new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date())}`
  )

  if (force) showToast("داده‌ها تازه‌سازی شد")
}

async function loadDataset(key, url, cacheKey) {
  if (!isConfiguredUrl(url)) {
    state[key] = []
    return
  }

  try {
    const requestUrl = cacheKey
      ? `${url}${url.includes("?") ? "&" : "?"}${cacheKey}`
      : url

    const response = await fetch(requestUrl)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const text = await response.text()
    state[key] = parsePublishedSheet(text)
  } catch (error) {
    console.error(`خطا در دریافت ${key}`, error)
    state[key] = []
    showToast(`دریافت داده ${datasetLabel(key)} انجام نشد`)
  }
}

function datasetLabel(key) {
  const labels = {
    annual: "برنامه سالانه",
    weekly: "برنامه هفتگی",
    sections: "بخش‌ها",
    sources: "منابع",
    files: "فایل‌ها",
    calendar: "تقویم",
    history: "تاریخچه پیشرفت",
    versions: "نسخه‌های فصل‌ها"
  }

  return labels[key] || key
}

function isConfiguredUrl(url) {
  return Boolean(
    url &&
    /^https?:\/\//i.test(url) &&
    !String(url).includes("PASTE_") &&
    !String(url).includes("لینک ")
  )
}

function parsePublishedSheet(text) {
  const rows = parseCSV(text)
    .map(row => row.map(cell => String(cell ?? "").trim()))
    .filter(row => row.some(Boolean))

  if (!rows.length) return []

  const headerIndex = findHeaderRow(rows)
  const headers = rows[headerIndex].map(normalizeHeader)

  return rows
    .slice(headerIndex + 1)
    .filter(row => row.some(Boolean))
    .map(row => {
      const item = {}

      headers.forEach((header, index) => {
        if (header) item[header] = row[index] || ""
      })

      return item
    })
}

function findHeaderRow(rows) {
  const markers = [
    "هفته",
    "بازه زمانی",
    "عنوان منبع",
    "عنوان",
    "بخش",
    "تمرکز اصلی",
    "ردیف"
  ]

  const index = rows.findIndex(row => {
    const normalized = row.map(normalizeHeader)
    return markers.some(marker => normalized.includes(marker))
  })

  return index >= 0 ? index : 0
}

function normalizeHeader(value) {
  return String(value || "")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function parseCSV(text) {
  const rows = []
  let row = []
  let field = ""
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (char === "," && !quoted) {
      row.push(field)
      field = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      continue
    }

    field += char
  }

  row.push(field)
  rows.push(row)

  return rows
}

function renderAll() {
  renderDashboard()
  renderAnnual()
  renderWeekly()
  renderSections()
  renderSources()
  renderFiles()
  renderCalendar()
  renderHistory()
  renderVersions()
  renderDeadlineAlerts()
}


function getRegisteredSources() {
  return state.sources.filter(row =>
    Boolean(normalizeText(row["عنوان منبع"]))
  )
}

function rowHasActualWeeklyData(row) {
  if (!row) return false

  return Boolean(
    normalizeText(row["مهم‌ترین فعالیت انجام‌شده"]) ||
    normalizeText(row["فعالیت ناتمام یا منتقل‌شده"]) ||
    normalizeText(row["لینک گزارش هفتگی"]) ||
    numberValue(row["منابع کامل واقعی"]) > 0 ||
    numberValue(row["کلمات جدید فصل دوم"]) > 0 ||
    numberValue(row["کلمات جدید فصل سوم"]) > 0 ||
    ["انجام شد", "انجام‌شده", "بخشی انجام شد", "منتقل شد"].includes(
      normalizeText(row["وضعیت"])
    )
  )
}

function getCurrentWeeklyRow() {
  if (!state.weekly.length) return null

  const today = startOfDay(new Date())

  const byDate = state.weekly.find(row => {
    const start = parseEventDate(row["تاریخ شروع"])
    const end = parseEventDate(row["تاریخ پایان"])
    return start && end && today >= startOfDay(start) && today <= startOfDay(end)
  })

  if (byDate) return byDate

  const active = state.weekly.find(row =>
    ["در حال انجام", "بخشی انجام شد"].includes(normalizeText(row["وضعیت"]))
  )

  if (active) return active

  const firstIncomplete = state.weekly.find(row =>
    !isCompleted(row["وضعیت"]) &&
    !isCancelled(row["وضعیت"]) &&
    normalizeText(row["وضعیت"]) !== "منتقل شد"
  )

  return firstIncomplete || getLatestActualWeeklyRow() || state.weekly.at(-1)
}

function getLatestActualWeeklyRow() {
  return state.weekly
    .filter(rowHasActualWeeklyData)
    .sort((a, b) => numberValue(a["هفته"]) - numberValue(b["هفته"]))
    .at(-1) || null
}

function getReportWeek() {
  const current = getCurrentWeeklyRow()
  if (rowHasActualWeeklyData(current)) return current
  return getLatestActualWeeklyRow() || current || state.weekly[0] || {}
}

function formatDateRange(row) {
  const start = parseEventDate(row?.["تاریخ شروع"])
  const end = parseEventDate(row?.["تاریخ پایان"])

  if (start && end) {
    return `${formatPersianDate(start)} تا ${formatPersianDate(end)}`
  }

  return row?.["بازه زمانی"] || "بازه ثبت نشده"
}

function renderDashboard() {
  const metrics = calculateProgressMetrics()
  renderProgressRings(metrics)

  const currentWeek = getCurrentWeeklyRow() || {}
  const registeredSources = getRegisteredSources()

  const sourceCount = registeredSources.filter(row =>
    ["مطالعه شده", "استفاده شده در متن"].includes(
      normalizeText(row["وضعیت مطالعه"])
    )
  ).length

  const completedWeeks = state.weekly.filter(row =>
    isCompleted(row["وضعیت"])
  ).length

  const kpis = [
    {
      icon: "✎",
      label: "کلمات فصل دوم",
      value: faNumber(metrics.chapterTwoWords),
      note: `هدف ${faNumber(metrics.chapterTwoTarget)} کلمه`
    },
    {
      icon: "⌘",
      label: "کلمات فصل سوم",
      value: faNumber(metrics.chapterThreeWords),
      note: `هدف ${faNumber(metrics.chapterThreeTarget)} کلمه`
    },
    {
      icon: "▤",
      label: "منابع مطالعه‌شده",
      value: faNumber(sourceCount),
      note: `${faNumber(registeredSources.length)} منبع واقعی ثبت‌شده`
    },
    {
      icon: "✓",
      label: "هفته‌های تکمیل‌شده",
      value: faNumber(completedWeeks),
      note: `از ${faNumber(state.weekly.length)} هفته`
    }
  ]

  const container = document.getElementById("kpiGrid")

  if (container) {
    container.innerHTML = kpis.map(card => `
      <article class="kpi-card">
        <div class="kpi-top">
          <small>${escapeHTML(card.label)}</small>
          <span class="kpi-icon">${card.icon}</span>
        </div>
        <strong>${card.value}</strong>
        <span class="kpi-note">${escapeHTML(card.note)}</span>
      </article>
    `).join("")
  }

  renderCurrentWeek(currentWeek)
  renderTrend()
  renderHistoryChart("dashboardHistoryChart", getHistoryRows(), true)
  renderAnnualCurrent()
  renderSectionSummary()
}

function calculateProgressMetrics() {
  const chapterTwoWords = getLatestTotal(
    "مجموع واقعی فصل دوم",
    "کلمات جدید فصل دوم"
  )

  const chapterThreeWords = getLatestTotal(
    "مجموع واقعی فصل سوم",
    "کلمات جدید فصل سوم"
  )

  const chapterTwoTarget = positiveNumber(config.chapterTwoTarget) || 15000
  const chapterThreeTarget = positiveNumber(config.chapterThreeTarget) || 8000

  const groupAverages = getSectionGroupAverages()
  const chapterTwoWordPercent = percentage(chapterTwoWords, chapterTwoTarget)
  const chapterThreeWordPercent = percentage(chapterThreeWords, chapterThreeTarget)

  const chapterTwoPercent =
    groupAverages.literature !== null && groupAverages.literature > 0
      ? groupAverages.literature
      : chapterTwoWordPercent

  const chapterThreePercent =
    groupAverages.methodology !== null && groupAverages.methodology > 0
      ? groupAverages.methodology
      : chapterThreeWordPercent

  const annualProgressValues = explicitPercentValues(state.annual)
  let thesisPercent = 0

  if (state.sections.length) {
    thesisPercent = average([
      chapterTwoPercent,
      chapterThreePercent,
      groupAverages.fieldwork ?? 0,
      groupAverages.analysis ?? 0,
      groupAverages.final ?? 0
    ])
  } else if (annualProgressValues.length) {
    thesisPercent = average(annualProgressValues)
  }

  return {
    chapterTwoWords,
    chapterThreeWords,
    chapterTwoTarget,
    chapterThreeTarget,
    chapterTwoPercent: clamp(Math.round(chapterTwoPercent), 0, 100),
    chapterThreePercent: clamp(Math.round(chapterThreePercent), 0, 100),
    thesisPercent: clamp(Math.round(thesisPercent), 0, 100),
    chapterTwoBasis:
      groupAverages.literature !== null && groupAverages.literature > 0
        ? "درصد ثبت‌شده در شیت بخش‌ها"
        : "نسبت کلمات تجمعی به هدف فصل دوم",
    chapterThreeBasis:
      groupAverages.methodology !== null && groupAverages.methodology > 0
        ? "درصد ثبت‌شده در شیت بخش‌ها"
        : "نسبت کلمات تجمعی به هدف فصل سوم"
  }
}

function renderProgressRings(metrics) {
  setProgressRing("chapterTwoRing", metrics.chapterTwoPercent)
  setProgressRing("chapterThreeRing", metrics.chapterThreePercent)
  setProgressRing("thesisRing", metrics.thesisPercent)

  setText("chapterTwoPercent", `${faNumber(metrics.chapterTwoPercent)}٪`)
  setText("chapterThreePercent", `${faNumber(metrics.chapterThreePercent)}٪`)
  setText("thesisPercent", `${faNumber(metrics.thesisPercent)}٪`)
  setText("chapterTwoBasis", metrics.chapterTwoBasis)
  setText("chapterThreeBasis", metrics.chapterThreeBasis)
}

function setProgressRing(id, percent) {
  const ring = document.getElementById(id)
  if (ring) ring.style.setProperty("--progress", `${percent * 3.6}deg`)
}

function getLatestTotal(totalColumn, incrementColumn) {
  const totals = state.weekly
    .map(row => numberValue(row[totalColumn]))
    .filter(value => value > 0)

  if (totals.length) return totals.at(-1)

  return state.weekly.reduce(
    (sum, row) => sum + numberValue(row[incrementColumn]),
    0
  )
}

function getSectionGroupAverages() {
  const groups = {
    literature: [],
    methodology: [],
    fieldwork: [],
    analysis: [],
    final: []
  }

  state.sections.forEach(row => {
    const group = canonicalSectionGroup(row["بخش"])
    const percent = explicitPercent(row["درصد پیشرفت"])

    if (group && percent !== null) {
      groups[group].push(percent)
    }
  })

  return Object.fromEntries(
    Object.entries(groups).map(([key, values]) => [
      key,
      values.length ? average(values) : null
    ])
  )
}

function canonicalSectionGroup(value) {
  const text = normalizeText(value)

  if (
    text.includes("مرور ادبیات") ||
    text.includes("فصل دوم") ||
    text.includes("ادبیات")
  ) return "literature"

  if (
    text.includes("روش شناسی") ||
    text.includes("روش تحقیق") ||
    text.includes("فصل سوم")
  ) return "methodology"

  if (
    text.includes("میدان") ||
    text.includes("گردآوری داده") ||
    text.includes("مصاحبه")
  ) return "fieldwork"

  if (
    text.includes("تحلیل") ||
    text.includes("یافته") ||
    text.includes("فصل چهارم") ||
    text.includes("فصل پنجم") ||
    text.includes("نتیجه گیری") ||
    text.includes("مقاله")
  ) return "analysis"

  if (
    text.includes("نهایی") ||
    text.includes("یکپارچه") ||
    text.includes("دفاع")
  ) return "final"

  return ""
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\u200c/g, " ")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")
    .trim()
}

function explicitPercent(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null
  }

  return clamp(numberValue(value), 0, 100)
}

function explicitPercentValues(rows) {
  return rows
    .map(row => explicitPercent(row["درصد پیشرفت"]))
    .filter(value => value !== null)
}

function renderCurrentWeek(row) {
  const container = document.getElementById("currentWeekCard")
  if (!container) return

  if (!state.weekly.length) {
    container.className = "empty-state"
    container.innerHTML = setupMessage(
      "نشانی CSV شیت هفتگی را در config.js وارد کنید"
    )
    return
  }

  if (!row || !Object.keys(row).length) {
    container.className = "empty-state"
    container.textContent = "اطلاعات هفته جاری ثبت نشده است"
    return
  }

  const planned = row["فعالیت برنامه‌ریزی‌شده"] || "فعالیت برنامه‌ریزی‌شده ثبت نشده است"
  const done = row["مهم‌ترین فعالیت انجام‌شده"]
  const moved = row["فعالیت ناتمام یا منتقل‌شده"]
  const reportLink = row["لینک گزارش هفتگی"]

  container.className = "week-card"
  container.innerHTML = `
    <div class="week-title">
      <div>
        <span class="panel-kicker">${escapeHTML(formatDateRange(row))}</span>
        <h4>هفته ${faNumber(row["هفته"] || "")}، ${escapeHTML(row["بازه زمانی"] || "")}</h4>
      </div>
      ${statusBadge(row["وضعیت"] || "شروع نشده")}
    </div>

    <div class="week-planned">
      <strong>برنامه هفته</strong>
      <span>${escapeHTML(planned)}</span>
    </div>

    <div class="week-done ${done ? "" : "week-empty-value"}">
      <strong>مهم‌ترین فعالیت انجام‌شده</strong>
      <span>${escapeHTML(done || "هنوز ثبت نشده است")}</span>
    </div>

    <div class="week-metrics">
      ${metricChip(row["منابع کامل واقعی"], "منابع مطالعه‌شده")}
      ${metricChip(row["کلمات جدید فصل دوم"], "کلمات جدید فصل دوم")}
      ${metricChip(row["مجموع واقعی فصل دوم"], "مجموع فصل دوم")}
      ${metricChip(row["کلمات جدید فصل سوم"], "کلمات جدید فصل سوم")}
      ${metricChip(row["مجموع واقعی فصل سوم"], "مجموع فصل سوم")}
    </div>

    ${moved
      ? `<div class="week-output"><strong>فعالیت ناتمام یا منتقل‌شده:</strong> ${escapeHTML(moved)}</div>`
      : ""}

    ${isConfiguredUrl(reportLink)
      ? `<a class="card-link" href="${escapeAttribute(reportLink)}" target="_blank" rel="noopener">بازکردن گزارش هفتگی ↗</a>`
      : ""}
  `
}

function metricChip(value, label) {
  return `
    <div class="metric-chip">
      <strong>${faNumber(value || 0)}</strong>
      <span>${escapeHTML(label)}</span>
    </div>
  `
}

function renderTrend() {
  const container = document.getElementById("trendChart")
  if (!container) return

  if (!state.weekly.length) {
    container.innerHTML = setupMessage(
      "برای نمایش نمودار، شیت پیگیری ۱۴ هفته را متصل کنید"
    )
    return
  }

  const rows = state.weekly.slice(0, 14)
  const targetValues = rows.map(row =>
    numberValue(row["هدف تجمعی فصل دوم"])
  )

  let runningActual = 0
  const actualPoints = []

  rows.forEach((row, index) => {
    if (!rowHasActualWeeklyData(row)) return

    const totalText = String(row["مجموع واقعی فصل دوم"] ?? "").trim()
    if (totalText !== "") {
      runningActual = numberValue(totalText)
    } else {
      runningActual += numberValue(row["کلمات جدید فصل دوم"])
    }

    actualPoints.push({ index, value: runningActual })
  })

  const maxValue = Math.max(
    1,
    ...targetValues,
    ...actualPoints.map(point => point.value),
    positiveNumber(config.chapterTwoTarget) || 15000
  )

  const width = 640
  const height = 210
  const paddingX = 30
  const paddingY = 24
  const plotWidth = width - paddingX * 2
  const plotHeight = height - paddingY * 2
  const step = rows.length > 1 ? plotWidth / (rows.length - 1) : plotWidth

  const targetPoints = targetValues.map((value, index) => {
    const x = paddingX + index * step
    const y = height - paddingY - (value / maxValue) * plotHeight
    return `${x},${y}`
  }).join(" ")

  const actualPolyline = actualPoints.map(point => {
    const x = paddingX + point.index * step
    const y = height - paddingY - (point.value / maxValue) * plotHeight
    return `${x},${y}`
  }).join(" ")

  const labels = rows.map((row, index) => {
    const x = paddingX + index * step
    return `<text x="${x}" y="${height - 3}" text-anchor="middle" class="chart-label">${faNumber(row["هفته"] || index + 1)}</text>`
  }).join("")

  container.innerHTML = `
    <div class="chart-legend">
      <span><i class="legend-line target-line"></i>هدف تجمعی</span>
      <span><i class="legend-line actual-line"></i>عملکرد واقعی ثبت‌شده</span>
    </div>

    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="نمودار هدف و عملکرد فصل دوم">
      <polyline points="${targetPoints}" class="chart-target"></polyline>
      ${actualPoints.length
        ? `<polyline points="${actualPolyline}" class="chart-actual"></polyline>`
        : ""}
      ${labels}
    </svg>

    ${actualPoints.length
      ? ""
      : `<div class="chart-empty-note">عملکرد واقعی هنوز ثبت نشده است</div>`}
  `
}

function renderAnnualCurrent() {
  const container = document.getElementById("annualCurrentCard")
  if (!container) return

  if (!state.annual.length) {
    container.innerHTML = setupMessage(
      "نشانی CSV شیت برنامه سالانه را در config.js وارد کنید"
    )
    return
  }

  container.innerHTML = annualFocusCard(getCurrentAnnualRow())
}

function renderSectionSummary() {
  const container = document.getElementById("sectionSummary")
  if (!container) return

  if (!state.sections.length) {
    container.innerHTML = setupMessage(
      "در شیت «بخش‌ها» درصد پیشرفت قسمت‌های رساله را ثبت کنید"
    )
    return
  }

  const groups = [
    ["literature", "فصل دوم", "مرور ادبیات"],
    ["methodology", "فصل سوم", "روش‌شناسی"],
    ["fieldwork", "میدان پژوهش", "گردآوری و آماده‌سازی داده‌ها"],
    ["analysis", "تحلیل و یافته‌ها", "فصل چهارم و پنجم"],
    ["final", "نسخه نهایی", "یکپارچه‌سازی و دفاع"]
  ]

  const averages = getSectionGroupAverages()

  const available = groups.filter(([key]) => averages[key] !== null)

  if (!available.length) {
    container.innerHTML = `
      <div class="empty-state full-span">
        درصد پیشرفت بخش‌ها هنوز ثبت نشده است
      </div>
    `
    return
  }

  container.innerHTML = available.map(([key, title, subtitle]) => {
    const percent = averages[key]

    return `
      <article class="summary-card">
        <div class="summary-card-header">
          <div>
            <h4>${escapeHTML(title)}</h4>
            <p>${escapeHTML(subtitle)}</p>
          </div>
          <strong>${faNumber(percent)}٪</strong>
        </div>

        <div class="progress-track">
          <div class="progress-fill" style="width:${percent}%"></div>
        </div>
      </article>
    `
  }).join("")
}

function renderAnnual() {
  renderAnnualSummary()
  renderAnnualFocus()
  renderAnnualTable()
}

function renderAnnualSummary() {
  const container = document.getElementById("annualSummary")
  if (!container) return

  if (!state.annual.length) {
    container.innerHTML = ""
    return
  }

  const completed = state.annual.filter(row =>
    isCompleted(row["وضعیت"]) ||
    explicitPercent(row["درصد پیشرفت"]) === 100
  ).length

  const inProgress = state.annual.filter(row =>
    ["در حال انجام", "بخشی انجام شد"].includes(row["وضعیت"])
  ).length

  const percentages = explicitPercentValues(state.annual)
  const averageProgress = percentages.length ? average(percentages) : 0
  const current = getCurrentAnnualRow()

  const cards = [
    {
      icon: "▦",
      label: "کل مراحل",
      value: faNumber(state.annual.length)
    },
    {
      icon: "✓",
      label: "مراحل تکمیل‌شده",
      value: faNumber(completed)
    },
    {
      icon: "◉",
      label: "در حال انجام",
      value: faNumber(inProgress)
    },
    {
      icon: "⌁",
      label: "میانگین پیشرفت",
      value: `${faNumber(averageProgress)}٪`
    },
    {
      icon: "◷",
      label: "بازه جاری",
      value: current?.["بازه زمانی"] || "ثبت نشده"
    }
  ]

  container.innerHTML = cards.map(card => `
    <article class="annual-stat">
      <span class="annual-stat-icon">${card.icon}</span>
      <div>
        <small>${escapeHTML(card.label)}</small>
        <strong>${escapeHTML(card.value)}</strong>
      </div>
    </article>
  `).join("")
}

function renderAnnualFocus() {
  const container = document.getElementById("annualFocus")
  if (!container) return

  if (!state.annual.length) {
    container.innerHTML = setupMessage(
      "نشانی CSV شیت برنامه سالانه را در config.js وارد کنید"
    )
    return
  }

  container.innerHTML = annualFocusCard(getCurrentAnnualRow())
}

function getCurrentAnnualRow() {
  if (!state.annual.length) return null

  const today = startOfDay(new Date())

  const byDate = state.annual.find(row => {
    const start = parseEventDate(row["تاریخ شروع"])
    const end = parseEventDate(row["تاریخ پایان"])
    return start && end && today >= startOfDay(start) && today <= startOfDay(end)
  })

  if (byDate) return byDate

  const active = state.annual.find(row =>
    ["در حال انجام", "بخشی انجام شد"].includes(normalizeText(row["وضعیت"]))
  )

  if (active) return active

  const incomplete = state.annual.find(row => {
    const percent = explicitPercent(row["درصد پیشرفت"])
    return !isCompleted(row["وضعیت"]) && percent !== 100
  })

  return incomplete || state.annual.at(-1)
}

function annualFocusCard(row) {
  if (!row) {
    return `<div class="empty-state">مرحله‌ای ثبت نشده است</div>`
  }

  const percent = explicitPercent(row["درصد پیشرفت"]) ?? 0
  const dateRange = formatDateRange(row)

  return `
    <article class="annual-focus-card">
      <div class="annual-focus-top">
        <div>
          <span class="panel-kicker">${escapeHTML(dateRange)}</span>
          <h3>${escapeHTML(row["تمرکز اصلی"] || "تمرکز اصلی ثبت نشده است")}</h3>
        </div>
        ${statusBadge(row["وضعیت"] || "شروع نشده")}
      </div>

      <p>${escapeHTML(row["فعالیت‌های اصلی"] || "")}</p>

      <div class="annual-output">
        <strong>خروجی مورد انتظار</strong>
        <span>${escapeHTML(row["خروجی لازم در پایان بازه"] || "ثبت نشده است")}</span>
      </div>

      <div class="progress-track">
        <div class="progress-fill" style="width:${percent}%"></div>
      </div>

      <div class="progress-caption">
        <span>${escapeHTML(row["بازه زمانی"] || "")}</span>
        <strong>${faNumber(percent)}٪</strong>
      </div>
    </article>
  `
}

function renderAnnualTable() {
  const container = document.getElementById("annualTable")
  if (!container) return

  if (!state.annual.length) {
    container.innerHTML = setupMessage(
      "برای نمایش برنامه سالانه، لینک CSV آن را در config.js وارد کنید"
    )
    return
  }

  const columns = [
    ["ردیف", "ردیف"],
    ["تاریخ شروع", "شروع"],
    ["تاریخ پایان", "پایان"],
    ["بازه زمانی", "بازه زمانی"],
    ["تمرکز اصلی", "تمرکز اصلی"],
    ["خروجی لازم در پایان بازه", "خروجی لازم"],
    ["وضعیت", "وضعیت"],
    ["درصد پیشرفت", "پیشرفت"],
    ["یادداشت کوتاه", "یادداشت"]
  ]

  container.innerHTML = buildDataTable(
    columns,
    state.annual,
    (row, key) => {
      if (key === "وضعیت") return statusBadge(row[key] || "شروع نشده")
      if (key === "درصد پیشرفت") {
        const value = explicitPercent(row[key])
        return value === null ? "—" : `${faNumber(value)}٪`
      }
      if (["تاریخ شروع", "تاریخ پایان"].includes(key)) {
        const date = parseEventDate(row[key])
        return date ? formatPersianDate(date) : "—"
      }
      if (key === "ردیف") return faNumber(row[key] || "—")
      return escapeHTML(row[key] || "—")
    },
    "annual-table"
  )
}

function renderWeekly() {
  const container = document.getElementById("weeklyTable")
  if (!container) return

  if (!state.weekly.length) {
    container.innerHTML = setupMessage(
      "نشانی CSV شیت پیگیری ۱۴ هفته را در config.js وارد کنید"
    )
    return
  }

  const columns = [
    ["هفته", "هفته"],
    ["تاریخ شروع", "شروع"],
    ["تاریخ پایان", "پایان"],
    ["بازه زمانی", "بازه"],
    ["فعالیت برنامه‌ریزی‌شده", "فعالیت برنامه‌ریزی‌شده"],
    ["حداقل منابع کامل", "هدف منابع"],
    ["هدف تجمعی فصل دوم", "هدف تجمعی فصل دوم"],
    ["مهم‌ترین فعالیت انجام‌شده", "فعالیت انجام‌شده"],
    ["منابع کامل واقعی", "منابع واقعی"],
    ["کلمات جدید فصل دوم", "جدید فصل دوم"],
    ["مجموع واقعی فصل دوم", "مجموع فصل دوم"],
    ["کلمات جدید فصل سوم", "جدید فصل سوم"],
    ["مجموع واقعی فصل سوم", "مجموع فصل سوم"],
    ["فعالیت ناتمام یا منتقل‌شده", "ناتمام یا منتقل‌شده"],
    ["وضعیت", "وضعیت"],
    ["تاریخ گزارش شنبه", "تاریخ گزارش"],
    ["لینک گزارش هفتگی", "گزارش"]
  ]

  container.innerHTML = buildDataTable(
    columns,
    state.weekly,
    (row, key) => {
      if (key === "وضعیت") return statusBadge(row[key] || "شروع نشده")

      if (["تاریخ شروع", "تاریخ پایان", "تاریخ گزارش شنبه"].includes(key)) {
        const date = parseEventDate(row[key])
        return date ? formatPersianDate(date) : "—"
      }

      if (key === "لینک گزارش هفتگی") {
        return isConfiguredUrl(row[key])
          ? `<a class="table-link" href="${escapeAttribute(row[key])}" target="_blank" rel="noopener">بازکردن گزارش ↗</a>`
          : "—"
      }

      if ([
        "هفته",
        "حداقل منابع کامل",
        "هدف تجمعی فصل دوم",
        "منابع کامل واقعی",
        "کلمات جدید فصل دوم",
        "مجموع واقعی فصل دوم",
        "کلمات جدید فصل سوم",
        "مجموع واقعی فصل سوم"
      ].includes(key)) {
        const raw = String(row[key] ?? "").trim()
        return raw === "" ? "—" : faNumber(raw)
      }

      return escapeHTML(row[key] || "—")
    },
    "weekly-table"
  )
}

function buildDataTable(columns, rows, cellRenderer, extraClass = "") {
  return `
    <div class="table-wrap">
      <table class="data-table ${escapeHTML(extraClass)}">
        <thead>
          <tr>
            ${columns.map(([, label]) => `<th>${escapeHTML(label)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${columns.map(([key]) => `<td>${cellRenderer(row, key)}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `
}

function renderSections() {
  renderSectionCards("literatureCards", "literature")
  renderSectionCards("methodologyCards", "methodology")
  renderSectionCards("fieldworkCards", "fieldwork")
  renderSectionCards("analysisCards", "analysis")
  renderSectionCards("finalCards", "final")
}

function renderSectionCards(containerId, group) {
  const container = document.getElementById(containerId)
  if (!container) return

  if (!state.sections.length) {
    container.innerHTML = setupMessage(
      "شیت «بخش‌ها» را ایجاد و لینک CSV آن را در config.js وارد کنید"
    )
    return
  }

  const rows = state.sections.filter(row =>
    canonicalSectionGroup(row["بخش"]) === group
  )

  if (!rows.length) {
    container.innerHTML = `
      <div class="empty-state full-span">
        برای این قسمت هنوز ردیفی در شیت «بخش‌ها» ثبت نشده است
      </div>
    `
    return
  }

  container.innerHTML = rows.map(row => {
    const percent = explicitPercent(row["درصد پیشرفت"]) ?? 0
    const link = row["لینک فایل"]

    return `
      <article class="detail-card">
        <div class="detail-card-header">
          <div>
            <span class="file-category">${escapeHTML(row["بخش"] || "")}</span>
            <h3>${escapeHTML(row["عنوان"] || "بدون عنوان")}</h3>
          </div>
          ${statusBadge(row["وضعیت"] || "شروع نشده")}
        </div>

        <p>${escapeHTML(row["یادداشت"] || "یادداشتی ثبت نشده است")}</p>

        <div class="progress-track">
          <div class="progress-fill" style="width:${percent}%"></div>
        </div>

        <div class="progress-caption">
          <span>${faNumber(row["تعداد کلمات"] || 0)} کلمه</span>
          <strong>${faNumber(percent)}٪</strong>
        </div>

        ${isConfiguredUrl(link)
          ? `<a class="card-link" href="${escapeAttribute(link)}" target="_blank" rel="noopener">بازکردن فایل ↗</a>`
          : ""}
      </article>
    `
  }).join("")
}

function renderSources(query = "") {
  const container = document.getElementById("sourcesTable")
  if (!container) return

  const registeredSources = getRegisteredSources()

  if (!registeredSources.length) {
    container.innerHTML = setupMessage(
      "منبع واقعی ثبت نشده است یا نشانی CSV شیت مدیریت منابع تنظیم نشده است"
    )
    return
  }

  const normalizedQuery = normalizeText(query).toLowerCase()

  const rows = registeredSources.filter(row => {
    if (!normalizedQuery) return true

    return [
      row["عنوان منبع"],
      row["نویسنده یا سازمان"],
      row["محور فصل"],
      row["نوع منبع"]
    ].some(value =>
      normalizeText(value).toLowerCase().includes(normalizedQuery)
    )
  })

  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">منبعی با این عبارت پیدا نشد</div>`
    return
  }

  const columns = [
    ["عنوان منبع", "عنوان منبع"],
    ["نویسنده یا سازمان", "نویسنده یا سازمان"],
    ["سال", "سال"],
    ["نوع منبع", "نوع"],
    ["محور فصل", "محور"],
    ["وضعیت مطالعه", "وضعیت"],
    ["تاریخ مطالعه", "تاریخ مطالعه"],
    ["استفاده در بخش", "محل استفاده"]
  ]

  container.innerHTML = buildDataTable(
    columns,
    rows,
    (row, key) => {
      if (key === "عنوان منبع") return sourceTitle(row)
      if (key === "وضعیت مطالعه") {
        return statusBadge(row[key] || "انتخاب شده")
      }
      if (key === "تاریخ مطالعه") {
        const date = parseEventDate(row[key])
        return date ? formatPersianDate(date) : "—"
      }
      return escapeHTML(row[key] || "—")
    },
    "sources-table"
  )
}

function sourceTitle(row) {
  const title = escapeHTML(row["عنوان منبع"] || "بدون عنوان")
  const url = row["لینک یا شناسه"]

  return isConfiguredUrl(url)
    ? `<a class="table-link" href="${escapeAttribute(url)}" target="_blank" rel="noopener">${title} ↗</a>`
    : title
}

function renderFiles() {
  const container = document.getElementById("filesCards")
  if (!container) return

  const rows = state.files.filter(row => normalizeText(row["عنوان"]))

  if (!rows.length) {
    container.innerHTML = setupMessage(
      "در شیت «فایل‌ها» عنوان، دسته، لینک و توضیح فایل‌ها را وارد کنید"
    )
    return
  }

  container.innerHTML = rows.map(row => {
    const url = row["لینک"]

    return `
      <article class="file-card">
        <span class="file-category">${escapeHTML(row["دسته"] || "فایل پژوهش")}</span>
        <h3>${escapeHTML(row["عنوان"])}</h3>
        <p>${escapeHTML(row["توضیح"] || "")}</p>

        ${isConfiguredUrl(url)
          ? `<a class="card-link" href="${escapeAttribute(url)}" target="_blank" rel="noopener">بازکردن در Google Drive ↗</a>`
          : `<span class="meta-chip">لینک وارد نشده است</span>`}
      </article>
    `
  }).join("")
}

function renderCalendar() {
  const events = getSortedCalendarEvents()
  renderUpcomingEvents(events)
  renderCalendarSummary(events)
  renderTimeline(events)
}

function getSortedCalendarEvents() {
  return state.calendar
    .filter(row => row["عنوان"] && eventDateValue(row))
    .map(row => ({
      ...row,
      dateObject: parseEventDate(eventDateValue(row))
    }))
    .filter(row => row.dateObject)
    .sort((a, b) => a.dateObject - b.dateObject)
}

function eventDateValue(row) {
  return row["تاریخ"] || row["تاریخ شروع"] || row["موعد"] || ""
}

function parseEventDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return startOfDay(value)
  }

  const raw = String(value ?? "").trim()
  if (!raw) return null

  const normalizedDigits = raw
    .replace(/[۰-۹]/g, digit => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    .replace(/[٠-٩]/g, digit => "٠١٢٣٤٥٦٧٨٩".indexOf(digit))

  if (/^\d+(\.\d+)?$/.test(normalizedDigits)) {
    const serial = Number(normalizedDigits)

    if (serial > 20000 && serial < 100000) {
      const epoch = new Date(1899, 11, 30)
      epoch.setDate(epoch.getDate() + Math.floor(serial))
      return startOfDay(epoch)
    }
  }

  const normalized = normalizedDigits
    .split("T")[0]
    .replace(/\//g, "-")
    .replace(/\./g, "-")

  const parts = normalized.split("-").map(Number)

  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) {
    return null
  }

  let year
  let month
  let day

  if (parts[0] > 1900) {
    ;[year, month, day] = parts
  } else if (parts[2] > 1900) {
    ;[month, day, year] = parts
  } else {
    return null
  }

  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null

  return startOfDay(date)
}

function renderUpcomingEvents(events) {
  const container = document.getElementById("upcomingEvents")
  if (!container) return

  if (!isConfiguredUrl(config.csv?.calendar)) {
    container.innerHTML = setupMessage(
      "لینک CSV شیت «تقویم» را در config.js وارد کنید"
    )
    return
  }

  const today = startOfDay(new Date())

  const upcoming = events
    .filter(event =>
      event.dateObject >= today &&
      !isCompleted(event["وضعیت"]) &&
      !isCancelled(event["وضعیت"])
    )
    .slice(0, 3)

  if (!upcoming.length) {
    container.innerHTML = `
      <div class="empty-state full-span">
        موعد آینده‌ای ثبت نشده است
      </div>
    `
    return
  }

  container.innerHTML = upcoming.map(event => {
    const days = daysBetween(today, event.dateObject)
    const countdown = days === 0 ? "امروز" : `${faNumber(days)} روز مانده`

    return `
      <article class="upcoming-card">
        <div class="event-date">
          <strong>${formatPersianDay(event.dateObject)}</strong>
          <span>${formatPersianMonth(event.dateObject)}</span>
        </div>

        <div class="event-content">
          <span class="event-section">${escapeHTML(event["بخش"] || event["نوع"] || "نقطه عطف")}</span>
          <h4>${escapeHTML(event["عنوان"])}</h4>
          <p>${escapeHTML(event["توضیح"] || "")}</p>
        </div>

        <div class="days-left">${countdown}</div>
      </article>
    `
  }).join("")
}

function renderCalendarSummary(events) {
  const container = document.getElementById("calendarSummary")
  if (!container) return

  if (!isConfiguredUrl(config.csv?.calendar)) {
    container.innerHTML = ""
    return
  }

  const today = startOfDay(new Date())

  const completed = events.filter(event =>
    isCompleted(event["وضعیت"])
  ).length

  const delayed = events.filter(event =>
    event.dateObject < today &&
    !isCompleted(event["وضعیت"]) &&
    !isCancelled(event["وضعیت"])
  ).length

  const nextEvent = events.find(event =>
    event.dateObject >= today &&
    !isCompleted(event["وضعیت"]) &&
    !isCancelled(event["وضعیت"])
  )

  const cards = [
    {
      label: "کل نقاط عطف",
      value: faNumber(events.length),
      icon: "◉"
    },
    {
      label: "انجام‌شده",
      value: faNumber(completed),
      icon: "✓"
    },
    {
      label: "عقب‌افتاده",
      value: faNumber(delayed),
      icon: "!"
    },
    {
      label: "موعد بعدی",
      value: nextEvent
        ? formatPersianDate(nextEvent.dateObject)
        : "ثبت نشده",
      icon: "◷"
    }
  ]

  container.innerHTML = cards.map(card => `
    <article class="calendar-stat">
      <span class="calendar-stat-icon">${card.icon}</span>
      <div>
        <small>${escapeHTML(card.label)}</small>
        <strong>${escapeHTML(card.value)}</strong>
      </div>
    </article>
  `).join("")
}

function renderTimeline(events) {
  const container = document.getElementById("timeline")
  if (!container) return

  if (!isConfiguredUrl(config.csv?.calendar)) {
    container.innerHTML = setupMessage(
      "لینک CSV شیت «تقویم» را در config.js وارد کنید"
    )
    return
  }

  if (!events.length) {
    container.innerHTML = `
      <div class="empty-state">
        رویدادی در شیت تقویم ثبت نشده است
      </div>
    `
    return
  }

  const today = startOfDay(new Date())

  container.innerHTML = events.map(event => {
    const completed = isCompleted(event["وضعیت"])
    const delayed =
      event.dateObject < today &&
      !completed &&
      !isCancelled(event["وضعیت"])

    const timelineClass = completed
      ? "timeline-completed"
      : delayed
        ? "timeline-delayed"
        : "timeline-upcoming"

    const link = event["لینک"]

    return `
      <article class="timeline-item ${timelineClass}">
        <div class="timeline-marker"></div>

        <div class="timeline-card">
          <div class="timeline-top">
            <div>
              <span class="event-section">${escapeHTML(event["بخش"] || event["نوع"] || "نقطه عطف")}</span>
              <h3>${escapeHTML(event["عنوان"])}</h3>
            </div>

            ${delayed
              ? statusBadge("عقب‌افتاده")
              : statusBadge(event["وضعیت"] || "برنامه‌ریزی‌شده")}
          </div>

          <div class="timeline-date">
            ${formatPersianDate(event.dateObject)}
          </div>

          ${event["توضیح"]
            ? `<p>${escapeHTML(event["توضیح"])}</p>`
            : ""}

          ${isConfiguredUrl(link)
            ? `<a class="card-link" href="${escapeAttribute(link)}" target="_blank" rel="noopener">مشاهده خروجی ↗</a>`
            : ""}
        </div>
      </article>
    `
  }).join("")
}

function statusBadge(status) {
  const value = String(status || "شروع نشده")
  let className = "status-not-started"

  if (
    isCompleted(value) ||
    ["نسخه جاری", "جاری", "نهایی"].includes(value)
  ) {
    className = "status-done"
  } else if (["در حال انجام", "در حال مطالعه", "در دست ویرایش"].includes(value)) {
    className = "status-progress"
  } else if (
    ["بخشی انجام شد", "انتخاب شده", "برنامه‌ریزی‌شده", "نسخه قبلی"].includes(value)
  ) {
    className = "status-partial"
  } else if (
    [
      "منتقل شد",
      "کنار گذاشته شده",
      "به‌تعویق‌افتاده",
      "لغوشده",
      "عقب‌افتاده"
    ].includes(value)
  ) {
    className = "status-moved"
  }

  return `
    <span class="status-badge ${className}">
      ${escapeHTML(value)}
    </span>
  `
}

function isCompleted(status) {
  return COMPLETED_STATUSES.includes(String(status || "").trim())
}

function isCancelled(status) {
  return CANCELLED_STATUSES.includes(String(status || "").trim())
}

function setupMessage(message) {
  return `
    <div class="setup-state">
      <div>
        <strong>تنظیم اولیه لازم است</strong>
        <br>
        ${escapeHTML(message)}
      </div>
    </div>
  `
}

function numberValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  const converted = String(value || "")
    .replace(/[۰-۹]/g, digit => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    .replace(/[٠-٩]/g, digit => "٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    .replace(/[,٬\s]/g, "")
    .replace(/[^\d.-]/g, "")

  const result = Number(converted)
  return Number.isFinite(result) ? result : 0
}

function positiveNumber(value) {
  const result = numberValue(value)
  return result > 0 ? result : 0
}

function percentage(value, target) {
  if (!target) return 0
  return clamp(Math.round((value / target) * 100), 0, 100)
}

function faNumber(value) {
  if (value === "" || value === null || value === undefined) return "—"

  const numeric = numberValue(value)

  return Number.isFinite(numeric)
    ? new Intl.NumberFormat("fa-IR").format(numeric)
    : String(value)
}

function average(values) {
  const valid = values.filter(value =>
    typeof value === "number" && Number.isFinite(value)
  )

  if (!valid.length) return 0

  return Math.round(
    valid.reduce((sum, value) => sum + value, 0) / valid.length
  )
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function escapeAttribute(value) {
  return escapeHTML(value)
}

function startOfDay(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  )
}

function daysBetween(start, end) {
  return Math.ceil(
    (startOfDay(end) - startOfDay(start)) / 86400000
  )
}

function formatPersianDate(date) {
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date)
}

function formatPersianDay(date) {
  return new Intl.DateTimeFormat("fa-IR", {
    day: "numeric"
  }).format(date)
}

function formatPersianMonth(date) {
  return new Intl.DateTimeFormat("fa-IR", {
    month: "short"
  }).format(date)
}


function getHistoryRows() {
  const today = startOfDay(new Date())

  return state.history
    .map(row => {
      const dateValue = row["تاریخ"] || ""
      const dateObject = parseEventDate(dateValue)

      return {
        ...row,
        dateObject,
        chapterTwo: clamp(numberValue(row["فصل دوم"]), 0, 100),
        chapterThree: clamp(numberValue(row["فصل سوم"]), 0, 100),
        thesis: clamp(numberValue(row["کل رساله"]), 0, 100)
      }
    })
    .filter(row =>
      row.dateObject &&
      row.dateObject <= today &&
      (
        String(row["فصل دوم"] ?? "").trim() !== "" ||
        String(row["فصل سوم"] ?? "").trim() !== "" ||
        String(row["کل رساله"] ?? "").trim() !== "" ||
        normalizeText(row["یادداشت"])
      )
    )
    .sort((a, b) => a.dateObject - b.dateObject)
}

function renderHistory() {
  const rows = getHistoryRows()
  renderHistorySummary(rows)
  renderHistoryChart("thesisHistoryChart", rows, false)
  renderHistoryTable(rows)
}

function renderHistorySummary(rows) {
  const container = document.getElementById("historySummary")
  if (!container) return

  if (!isConfiguredUrl(config.csv?.history)) {
    container.innerHTML = ""
    return
  }

  if (!rows.length) {
    container.innerHTML = `
      <div class="empty-state full-span">
        سابقه‌ای در شیت «تاریخچه پیشرفت» ثبت نشده است
      </div>
    `
    return
  }

  const latest = rows.at(-1)
  const previous = rows.at(-2)
  const delta = previous ? latest.thesis - previous.thesis : 0

  const cards = [
    {
      label: "آخرین ثبت",
      value: formatPersianDate(latest.dateObject),
      icon: "◷"
    },
    {
      label: "فصل دوم",
      value: `${faNumber(latest.chapterTwo)}٪`,
      icon: "۲"
    },
    {
      label: "فصل سوم",
      value: `${faNumber(latest.chapterThree)}٪`,
      icon: "۳"
    },
    {
      label: "کل رساله",
      value: `${faNumber(latest.thesis)}٪`,
      icon: "ر"
    },
    {
      label: "تغییر از ثبت قبل",
      value: `${delta >= 0 ? "+" : ""}${faNumber(delta)}٪`,
      icon: "↗"
    }
  ]

  container.innerHTML = cards.map(card => `
    <article class="history-stat">
      <span class="history-stat-icon">${card.icon}</span>
      <div>
        <small>${escapeHTML(card.label)}</small>
        <strong>${escapeHTML(card.value)}</strong>
      </div>
    </article>
  `).join("")
}

function renderHistoryChart(containerId, rows, compact = false) {
  const container = document.getElementById(containerId)
  if (!container) return

  if (!isConfiguredUrl(config.csv?.history)) {
    container.innerHTML = setupMessage(
      "لینک CSV شیت «تاریخچه پیشرفت» را در config.js وارد کنید"
    )
    return
  }

  if (!rows.length) {
    container.innerHTML = `
      <div class="empty-state">
        برای نمایش روند، حداقل یک ردیف در شیت تاریخچه پیشرفت ثبت کنید
      </div>
    `
    return
  }

  const width = compact ? 720 : 920
  const height = compact ? 250 : 330
  const paddingX = compact ? 38 : 48
  const paddingTop = 30
  const paddingBottom = compact ? 42 : 54
  const plotWidth = width - paddingX * 2
  const plotHeight = height - paddingTop - paddingBottom
  const step = rows.length > 1 ? plotWidth / (rows.length - 1) : 0

  const point = (value, index) => {
    const x = paddingX + index * step
    const y = paddingTop + plotHeight - (value / 100) * plotHeight
    return { x, y }
  }

  const points = key => rows
    .map((row, index) => {
      const p = point(row[key], index)
      return `${p.x},${p.y}`
    })
    .join(" ")

  const grid = [0, 25, 50, 75, 100].map(value => {
    const y = paddingTop + plotHeight - (value / 100) * plotHeight

    return `
      <line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}" class="history-grid-line"></line>
      <text x="${paddingX - 9}" y="${y + 4}" text-anchor="end" class="history-axis-label">${faNumber(value)}٪</text>
    `
  }).join("")

  const maxLabels = compact ? 6 : 10
  const labelEvery = Math.max(1, Math.ceil(rows.length / maxLabels))

  const dateLabels = rows.map((row, index) => {
    if (index % labelEvery !== 0 && index !== rows.length - 1) return ""

    const p = point(0, index)
    const label = new Intl.DateTimeFormat("fa-IR", {
      month: "short",
      year: "2-digit"
    }).format(row.dateObject)

    return `
      <text x="${p.x}" y="${height - 12}" text-anchor="middle" class="history-axis-label">${escapeHTML(label)}</text>
    `
  }).join("")

  const last = rows.at(-1)
  const lastIndex = rows.length - 1

  const endDots = [
    ["chapterTwo", last.chapterTwo, "history-dot-two"],
    ["chapterThree", last.chapterThree, "history-dot-three"],
    ["thesis", last.thesis, "history-dot-thesis"]
  ].map(([key, value, className]) => {
    const p = point(value, lastIndex)
    return `<circle cx="${p.x}" cy="${p.y}" r="5" class="${className}"></circle>`
  }).join("")

  container.innerHTML = `
    <div class="history-legend">
      <span><i class="history-line history-two"></i>فصل دوم</span>
      <span><i class="history-line history-three"></i>فصل سوم</span>
      <span><i class="history-line history-thesis"></i>کل رساله</span>
    </div>

    <svg class="history-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="نمودار روند پیشرفت رساله">
      ${grid}
      <polyline points="${points("chapterTwo")}" class="history-path history-path-two"></polyline>
      <polyline points="${points("chapterThree")}" class="history-path history-path-three"></polyline>
      <polyline points="${points("thesis")}" class="history-path history-path-thesis"></polyline>
      ${endDots}
      ${dateLabels}
    </svg>
  `
}

function renderHistoryTable(rows) {
  const container = document.getElementById("historyTable")
  if (!container) return

  if (!isConfiguredUrl(config.csv?.history)) {
    container.innerHTML = setupMessage(
      "لینک CSV شیت «تاریخچه پیشرفت» را در config.js وارد کنید"
    )
    return
  }

  if (!rows.length) {
    container.innerHTML = `
      <div class="empty-state">
        داده تاریخی ثبت نشده است
      </div>
    `
    return
  }

  const columns = [
    ["تاریخ", "تاریخ"],
    ["فصل دوم", "فصل دوم"],
    ["فصل سوم", "فصل سوم"],
    ["کل رساله", "کل رساله"],
    ["یادداشت", "یادداشت"]
  ]

  container.innerHTML = buildDataTable(
    columns,
    rows,
    (row, key) => {
      if (key === "تاریخ") return formatPersianDate(row.dateObject)
      if (["فصل دوم", "فصل سوم", "کل رساله"].includes(key)) {
        return `${faNumber(row[key] || 0)}٪`
      }
      return escapeHTML(row[key] || "—")
    },
    "history-table"
  )
}

function renderVersions(query = "") {
  const summary = document.getElementById("versionSummary")
  const container = document.getElementById("versionsCards")
  if (!summary || !container) return

  if (!isConfiguredUrl(config.csv?.versions)) {
    summary.innerHTML = ""
    container.innerHTML = setupMessage(
      "لینک CSV شیت «نسخه‌های فصل‌ها» را در config.js وارد کنید"
    )
    return
  }

  const normalizedQuery = normalizeText(query).toLowerCase()

  const rows = state.versions
    .filter(row => row["عنوان"] || row["فصل"] || row["شماره نسخه"])
    .filter(row => {
      if (!normalizedQuery) return true

      return [
        row["فصل"],
        row["عنوان"],
        row["شماره نسخه"],
        row["توضیح"],
        row["وضعیت"]
      ].some(value =>
        normalizeText(value).toLowerCase().includes(normalizedQuery)
      )
    })
    .sort((a, b) => {
      const dateA = parseEventDate(a["تاریخ"])
      const dateB = parseEventDate(b["تاریخ"])
      return (dateB?.getTime() || 0) - (dateA?.getTime() || 0)
    })

  const allRows = state.versions.filter(row =>
    row["عنوان"] || row["فصل"] || row["شماره نسخه"]
  )

  const chapterCount = new Set(
    allRows.map(row => row["فصل"]).filter(Boolean)
  ).size

  const currentCount = allRows.filter(row =>
    ["نسخه جاری", "جاری", "نهایی"].includes(row["وضعیت"])
  ).length

  summary.innerHTML = [
    ["کل نسخه‌ها", allRows.length, "⧉"],
    ["فصل‌ها و خروجی‌ها", chapterCount, "▤"],
    ["نسخه‌های جاری", currentCount, "✓"]
  ].map(([label, value, icon]) => `
    <article class="version-stat">
      <span class="version-stat-icon">${icon}</span>
      <div>
        <small>${escapeHTML(label)}</small>
        <strong>${faNumber(value)}</strong>
      </div>
    </article>
  `).join("")

  if (!rows.length) {
    container.innerHTML = `
      <div class="empty-state full-span">
        نسخه‌ای با این عبارت پیدا نشد
      </div>
    `
    return
  }

  container.innerHTML = rows.map(row => {
    const url = row["لینک"]
    const date = parseEventDate(row["تاریخ"])
    const version = row["شماره نسخه"] || "بدون شماره"

    return `
      <article class="version-card">
        <div class="version-card-top">
          <div>
            <span class="file-category">${escapeHTML(row["فصل"] || "خروجی پژوهش")}</span>
            <h3>${escapeHTML(row["عنوان"] || "نسخه بدون عنوان")}</h3>
          </div>
          ${statusBadge(row["وضعیت"] || "نسخه قبلی")}
        </div>

        <div class="version-meta">
          <span>${escapeHTML(version)}</span>
          <span>${date ? formatPersianDate(date) : "تاریخ ثبت نشده"}</span>
        </div>

        <p>${escapeHTML(row["توضیح"] || "")}</p>

        ${isConfiguredUrl(url)
          ? `<a class="card-link" href="${escapeAttribute(url)}" target="_blank" rel="noopener">بازکردن نسخه در Drive ↗</a>`
          : `<span class="meta-chip">لینک نسخه ثبت نشده است</span>`}
      </article>
    `
  }).join("")
}

function getRelevantDeadlineEvents() {
  const today = startOfDay(new Date())
  const alertDays = positiveNumber(config.alertDays) || 7

  return getSortedCalendarEvents()
    .filter(event =>
      !isCompleted(event["وضعیت"]) &&
      !isCancelled(event["وضعیت"])
    )
    .map(event => ({
      ...event,
      days: daysBetween(today, event.dateObject)
    }))
    .filter(event => event.days <= alertDays)
}

function renderDeadlineAlerts() {
  const container = document.getElementById("deadlineAlerts")
  if (!container) return

  if (!isConfiguredUrl(config.csv?.calendar)) {
    container.hidden = true
    return
  }

  const events = getRelevantDeadlineEvents()

  if (!events.length) {
    container.hidden = true
    return
  }

  container.hidden = false
  container.innerHTML = `
    <div class="deadline-alert-icon">!</div>
    <div class="deadline-alert-copy">
      <strong>${faNumber(events.length)} موعد نیازمند توجه است</strong>
      <span>${events.slice(0, 3).map(event => {
        const timing = event.days < 0
          ? `${faNumber(Math.abs(event.days))} روز عقب‌افتاده`
          : event.days === 0
            ? "امروز"
            : `${faNumber(event.days)} روز مانده`

        return `${escapeHTML(event["عنوان"])}، ${timing}`
      }).join(" • ")}</span>
    </div>
    <button type="button" class="deadline-alert-button" id="openDeadlineView">مشاهده</button>
  `

  document.getElementById("openDeadlineView")?.addEventListener("click", () => {
    openView("calendar")
  })

  notifyDeadlineEvents(events, false)
}

async function requestDeadlineNotifications() {
  if (!("Notification" in window)) {
    showToast("مرورگر شما اعلان سیستمی را پشتیبانی نمی‌کند")
    return
  }

  if (Notification.permission === "granted") {
    notifyDeadlineEvents(getRelevantDeadlineEvents(), true)
    showToast("اعلان موعدها فعال است")
    return
  }

  if (Notification.permission === "denied") {
    showToast("اجازه اعلان در تنظیمات مرورگر مسدود شده است")
    return
  }

  const permission = await Notification.requestPermission()

  if (permission === "granted") {
    notifyDeadlineEvents(getRelevantDeadlineEvents(), true)
    showToast("اعلان موعدها فعال شد")
  } else {
    showToast("اجازه اعلان صادر نشد")
  }
}

function notifyDeadlineEvents(events, force) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return
  }

  const todayKey = new Date().toISOString().slice(0, 10)

  events.slice(0, 4).forEach(event => {
    const eventKey = `${todayKey}|${event["عنوان"]}|${eventDateValue(event)}`
    const storageKey = `thesis-deadline-notified:${eventKey}`

    if (!force && localStorage.getItem(storageKey)) return

    const timing = event.days < 0
      ? `${Math.abs(event.days)} روز از موعد گذشته است`
      : event.days === 0
        ? "موعد امروز است"
        : `${event.days} روز تا موعد باقی مانده است`

    try {
      new Notification(event["عنوان"], {
        body: timing,
        tag: eventKey
      })

      localStorage.setItem(storageKey, "1")
    } catch (error) {
      console.error("Notification error", error)
    }
  })
}

function printProgressReport() {
  const report = document.getElementById("printReport")
  if (!report) return

  const metrics = calculateProgressMetrics()
  const annual = getCurrentAnnualRow()
  const week = getReportWeek()
  const reportDate =
    parseEventDate(week["تاریخ گزارش شنبه"]) ||
    parseEventDate(week["تاریخ پایان"]) ||
    new Date()

  const importantActivity =
    week["مهم‌ترین فعالیت انجام‌شده"] || "هنوز ثبت نشده است"

  const movedActivity = normalizeText(
    week["فعالیت ناتمام یا منتقل‌شده"]
  )

  const nextDeadline = getSortedCalendarEvents().find(event =>
    event.dateObject >= startOfDay(new Date()) &&
    !isCompleted(event["وضعیت"]) &&
    !isCancelled(event["وضعیت"])
  )

  report.innerHTML = `
    <div class="print-report-header">
      <div>
        <span>گزارش هفتگی پیشرفت رساله دکتری</span>
        <h1>${escapeHTML(config.thesisTitle || "عنوان کامل رساله دکتری")}</h1>
        <p>${escapeHTML(config.researcherName || "نام پژوهشگر")}</p>
      </div>
      <div class="print-report-date">
        <strong>گزارش شنبه</strong>
        <span>${formatPersianDate(reportDate)}</span>
      </div>
    </div>

    <div class="print-week-meta">
      <span><strong>شماره هفته:</strong> ${faNumber(week["هفته"] || "—")}</span>
      <span><strong>بازه:</strong> ${escapeHTML(formatDateRange(week))}</span>
      <span><strong>وضعیت:</strong> ${escapeHTML(week["وضعیت"] || "ثبت نشده")}</span>
    </div>

    <div class="print-metrics">
      ${printMetric("پیشرفت فصل دوم", `${faNumber(metrics.chapterTwoPercent)}٪`, `${faNumber(metrics.chapterTwoWords)} کلمه تجمعی`)}
      ${printMetric("پیشرفت فصل سوم", `${faNumber(metrics.chapterThreePercent)}٪`, `${faNumber(metrics.chapterThreeWords)} کلمه تجمعی`)}
      ${printMetric("پیشرفت کل رساله", `${faNumber(metrics.thesisPercent)}٪`, "برآورد مراحل اصلی")}
    </div>

    <section class="report-core">
      <article class="report-block report-block-primary">
        <span class="report-number">۱</span>
        <div>
          <h2>مهم‌ترین فعالیت انجام‌شده</h2>
          <p>${escapeHTML(importantActivity)}</p>
        </div>
      </article>

      <article class="report-block">
        <span class="report-number">۲</span>
        <div class="report-block-wide">
          <h2>منابع مطالعه‌شده و وضعیت نگارش</h2>
          <div class="report-stats-grid">
            <div><small>منابع مطالعه‌شده</small><strong>${faNumber(week["منابع کامل واقعی"] || 0)}</strong></div>
            <div><small>کلمات جدید فصل دوم</small><strong>${faNumber(week["کلمات جدید فصل دوم"] || 0)}</strong></div>
            <div><small>مجموع فصل دوم</small><strong>${faNumber(week["مجموع واقعی فصل دوم"] || 0)}</strong></div>
            <div><small>کلمات جدید فصل سوم</small><strong>${faNumber(week["کلمات جدید فصل سوم"] || 0)}</strong></div>
            <div><small>مجموع فصل سوم</small><strong>${faNumber(week["مجموع واقعی فصل سوم"] || 0)}</strong></div>
          </div>
        </div>
      </article>

      ${movedActivity
        ? `<article class="report-block report-block-warning">
            <span class="report-number">۳</span>
            <div>
              <h2>فعالیت ناتمام یا منتقل‌شده</h2>
              <p>${escapeHTML(movedActivity)}</p>
            </div>
          </article>`
        : ""}
    </section>

    <section class="print-context">
      <div>
        <small>برنامه این هفته</small>
        <p>${escapeHTML(week["فعالیت برنامه‌ریزی‌شده"] || "ثبت نشده است")}</p>
      </div>
      <div>
        <small>مرحله جاری برنامه سالانه</small>
        <p><strong>${escapeHTML(annual?.["بازه زمانی"] || "ثبت نشده")}</strong> ـ ${escapeHTML(annual?.["تمرکز اصلی"] || "")}</p>
      </div>
      <div>
        <small>موعد بعدی</small>
        <p>${nextDeadline
          ? `${escapeHTML(nextDeadline["عنوان"])} ـ ${formatPersianDate(nextDeadline.dateObject)}`
          : "موعد آینده‌ای ثبت نشده است"}</p>
      </div>
    </section>

    <div class="print-report-footer">
      گزارش تولیدشده از سامانه مدیریت رساله
    </div>
  `

  report.setAttribute("aria-hidden", "false")
  document.body.classList.add("print-mode")

  setTimeout(() => {
    window.print()
  }, 120)
}

function printMetric(label, value, note) {
  return `
    <article>
      <small>${escapeHTML(label)}</small>
      <strong>${escapeHTML(value)}</strong>
      <span>${escapeHTML(note)}</span>
    </article>
  `
}

function cleanupPrintReport() {
  document.body.classList.remove("print-mode")
  document.getElementById("printReport")?.setAttribute("aria-hidden", "true")
}

const VAULT_STORAGE_KEY = "thesis-private-vault-v1"

const vaultSession = {
  key: null,
  salt: null,
  data: null
}

function initVault() {
  updateVaultLockMode()
}

function bindVaultActions() {
  document.getElementById("vaultUnlockForm")?.addEventListener("submit", unlockOrCreateVault)
  document.getElementById("vaultSaveButton")?.addEventListener("click", saveVault)
  document.getElementById("vaultLockButton")?.addEventListener("click", lockVault)
  document.getElementById("vaultExportButton")?.addEventListener("click", exportVaultBackup)
  document.getElementById("vaultImportButton")?.addEventListener("click", () => {
    document.getElementById("vaultImportInput")?.click()
  })
  document.getElementById("vaultImportInput")?.addEventListener("change", importVaultBackup)
  document.getElementById("vaultLinkForm")?.addEventListener("submit", addVaultLink)
}

function updateVaultLockMode() {
  const exists = Boolean(localStorage.getItem(VAULT_STORAGE_KEY))
  const confirmWrap = document.getElementById("vaultConfirmWrap")
  const confirmInput = document.getElementById("vaultPasswordConfirm")

  setText(
    "vaultLockTitle",
    exists ? "بازکردن مخزن محرمانه" : "ساخت مخزن محرمانه"
  )

  setText(
    "vaultLockDescription",
    exists
      ? "رمز عبور مخزن را وارد کنید"
      : "یک رمز عبور قوی با حداقل ۸ نویسه انتخاب کنید"
  )

  setText(
    "vaultUnlockButton",
    exists ? "بازکردن مخزن" : "ساخت مخزن"
  )

  if (confirmWrap) confirmWrap.hidden = exists
  if (confirmInput) confirmInput.required = !exists
}

async function unlockOrCreateVault(event) {
  event.preventDefault()

  if (!window.crypto?.subtle) {
    showToast("رمزگذاری در این مرورگر پشتیبانی نمی‌شود")
    return
  }

  const password = document.getElementById("vaultPassword")?.value || ""
  const confirm = document.getElementById("vaultPasswordConfirm")?.value || ""
  const stored = localStorage.getItem(VAULT_STORAGE_KEY)

  if (password.length < 8) {
    showToast("رمز عبور باید حداقل ۸ نویسه باشد")
    return
  }

  try {
    if (!stored) {
      if (password !== confirm) {
        showToast("تکرار رمز عبور یکسان نیست")
        return
      }

      const salt = crypto.getRandomValues(new Uint8Array(16))
      const key = await deriveVaultKey(password, salt)
      const data = {
        notes: "",
        links: [],
        updatedAt: new Date().toISOString()
      }

      const blob = await encryptVaultData(data, key, salt)
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(blob))

      vaultSession.key = key
      vaultSession.salt = salt
      vaultSession.data = data

      showUnlockedVault()
      showToast("مخزن محرمانه ساخته شد")
      return
    }

    const blob = JSON.parse(stored)
    const salt = base64ToBytes(blob.salt)
    const key = await deriveVaultKey(password, salt)
    const data = await decryptVaultData(blob, key)

    vaultSession.key = key
    vaultSession.salt = salt
    vaultSession.data = data

    showUnlockedVault()
    showToast("مخزن باز شد")
  } catch (error) {
    console.error("Vault unlock failed", error)
    showToast("رمز عبور نادرست است یا فایل مخزن آسیب دیده است")
  }
}

async function deriveVaultKey(password, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  )

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 250000,
      hash: "SHA-256"
    },
    material,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  )
}

async function encryptVaultData(data, key, salt) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(data))

  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv
    },
    key,
    plaintext
  )

  return {
    version: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    updatedAt: new Date().toISOString()
  }
}

async function decryptVaultData(blob, key) {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(blob.iv)
    },
    key,
    base64ToBytes(blob.ciphertext)
  )

  return JSON.parse(new TextDecoder().decode(decrypted))
}

function bytesToBase64(bytes) {
  let binary = ""
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function base64ToBytes(value) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function showUnlockedVault() {
  const locked = document.getElementById("vaultLocked")
  const unlocked = document.getElementById("vaultUnlocked")

  if (locked) locked.hidden = true
  if (unlocked) unlocked.hidden = false

  const passwordInput = document.getElementById("vaultPassword")
  const confirmInput = document.getElementById("vaultPasswordConfirm")

  if (passwordInput) passwordInput.value = ""
  if (confirmInput) confirmInput.value = ""

  renderVaultData()
}

function renderVaultData() {
  const data = vaultSession.data || {
    notes: "",
    links: [],
    updatedAt: ""
  }

  const notes = document.getElementById("vaultNotes")
  if (notes) notes.value = data.notes || ""

  setText(
    "vaultUpdatedAt",
    data.updatedAt
      ? `آخرین ذخیره: ${new Intl.DateTimeFormat("fa-IR", {
          dateStyle: "medium",
          timeStyle: "short"
        }).format(new Date(data.updatedAt))}`
      : "هنوز ذخیره نشده است"
  )

  renderVaultLinks()
}

function renderVaultLinks() {
  const container = document.getElementById("vaultLinks")
  if (!container) return

  const links = vaultSession.data?.links || []

  if (!links.length) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        پیوند محرمانه‌ای ثبت نشده است
      </div>
    `
    return
  }

  container.innerHTML = links.map((item, index) => `
    <article class="vault-link-item">
      <div>
        <strong>${escapeHTML(item.title || "بدون عنوان")}</strong>
        <span>${escapeHTML(item.note || "")}</span>
      </div>

      <div class="vault-link-actions">
        <a href="${escapeAttribute(item.url)}" target="_blank" rel="noopener">بازکردن</a>
        <button type="button" data-vault-delete="${index}">حذف</button>
      </div>
    </article>
  `).join("")

  container.querySelectorAll("[data-vault-delete]").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.vaultDelete)
      vaultSession.data.links.splice(index, 1)
      renderVaultLinks()
    })
  })
}

function addVaultLink(event) {
  event.preventDefault()

  if (!vaultSession.data) return

  const titleInput = document.getElementById("vaultLinkTitle")
  const urlInput = document.getElementById("vaultLinkUrl")
  const noteInput = document.getElementById("vaultLinkNote")

  const title = titleInput?.value.trim() || ""
  const url = urlInput?.value.trim() || ""
  const note = noteInput?.value.trim() || ""

  if (!title || !isConfiguredUrl(url)) {
    showToast("عنوان و لینک معتبر وارد کنید")
    return
  }

  vaultSession.data.links.push({
    title,
    url,
    note
  })

  if (titleInput) titleInput.value = ""
  if (urlInput) urlInput.value = ""
  if (noteInput) noteInput.value = ""

  renderVaultLinks()
}

async function saveVault() {
  if (!vaultSession.key || !vaultSession.salt || !vaultSession.data) {
    showToast("مخزن قفل است")
    return
  }

  try {
    vaultSession.data.notes = document.getElementById("vaultNotes")?.value || ""
    vaultSession.data.updatedAt = new Date().toISOString()

    const blob = await encryptVaultData(
      vaultSession.data,
      vaultSession.key,
      vaultSession.salt
    )

    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(blob))
    renderVaultData()
    showToast("اطلاعات به‌صورت رمزگذاری‌شده ذخیره شد")
  } catch (error) {
    console.error("Vault save failed", error)
    showToast("ذخیره مخزن انجام نشد")
  }
}

function lockVault() {
  vaultSession.key = null
  vaultSession.salt = null
  vaultSession.data = null

  const locked = document.getElementById("vaultLocked")
  const unlocked = document.getElementById("vaultUnlocked")

  if (locked) locked.hidden = false
  if (unlocked) unlocked.hidden = true

  updateVaultLockMode()
  showToast("مخزن قفل شد")
}

function exportVaultBackup() {
  const stored = localStorage.getItem(VAULT_STORAGE_KEY)

  if (!stored) {
    showToast("فایل پشتیبانی برای خروجی وجود ندارد")
    return
  }

  const blob = new Blob([stored], {
    type: "application/json"
  })

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `thesis-vault-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

async function importVaultBackup(event) {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const blob = JSON.parse(text)

    if (
      !blob ||
      blob.version !== 1 ||
      !blob.salt ||
      !blob.iv ||
      !blob.ciphertext
    ) {
      throw new Error("Invalid backup")
    }

    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(blob))
    lockVault()
    updateVaultLockMode()
    showToast("فایل پشتیبان وارد شد. رمز عبور را وارد کنید")
  } catch (error) {
    console.error("Vault import failed", error)
    showToast("فایل پشتیبان معتبر نیست")
  } finally {
    event.target.value = ""
  }
}

function restoreTheme() {
  const saved = localStorage.getItem("thesis-dashboard-theme")

  if (saved === "dark") {
    document.documentElement.dataset.theme = "dark"
  }
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme
  const next = current === "dark" ? "light" : "dark"

  if (next === "dark") {
    document.documentElement.dataset.theme = "dark"
  } else {
    delete document.documentElement.dataset.theme
  }

  localStorage.setItem("thesis-dashboard-theme", next)
}

let toastTimer

function showToast(message) {
  const toast = document.getElementById("toast")
  if (!toast) return

  toast.textContent = message
  toast.classList.add("show")

  clearTimeout(toastTimer)

  toastTimer = setTimeout(() => {
    toast.classList.remove("show")
  }, 2600)
}
