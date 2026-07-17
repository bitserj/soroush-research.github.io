const config = window.APP_CONFIG || {}

const state = {
  annual: [],
  weekly: [],
  sections: [],
  sources: [],
  files: [],
  calendar: []
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
}

async function loadAllData(force = false) {
  const cacheKey = force ? `refresh=${Date.now()}` : ""

  await Promise.all([
    loadDataset("annual", config.csv?.annual, cacheKey),
    loadDataset("weekly", config.csv?.weekly, cacheKey),
    loadDataset("sections", config.csv?.sections, cacheKey),
    loadDataset("sources", config.csv?.sources, cacheKey),
    loadDataset("files", config.csv?.files, cacheKey),
    loadDataset("calendar", config.csv?.calendar, cacheKey)
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
    calendar: "تقویم"
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
}

function renderDashboard() {
  const metrics = calculateProgressMetrics()
  renderProgressRings(metrics)

  const actualRows = state.weekly.filter(row =>
    numberValue(row["منابع کامل واقعی"]) > 0 ||
    numberValue(row["کلمات جدید فصل دوم"]) > 0 ||
    numberValue(row["کلمات جدید فصل سوم"]) > 0 ||
    Boolean(row["وضعیت"])
  )

  const latest = actualRows.at(-1) || state.weekly[0] || {}

  const sourceCount = state.sources.filter(row =>
    ["مطالعه شده", "استفاده شده در متن"].includes(row["وضعیت مطالعه"])
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
      note: `هدف پیش‌فرض ${faNumber(metrics.chapterThreeTarget)} کلمه`
    },
    {
      icon: "▤",
      label: "منابع مطالعه‌شده",
      value: faNumber(sourceCount),
      note: `${faNumber(state.sources.length)} منبع ثبت‌شده`
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

  renderCurrentWeek(latest)
  renderTrend()
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

  const chapterTwoPercent = groupAverages.literature !== null
    ? groupAverages.literature
    : chapterTwoWordPercent

  const chapterThreePercent = groupAverages.methodology !== null
    ? groupAverages.methodology
    : chapterThreeWordPercent

  const annualProgressValues = explicitPercentValues(state.annual)

  let thesisPercent = 0

  if (state.sections.length) {
    thesisPercent = average([
      groupAverages.literature ?? 0,
      groupAverages.methodology ?? 0,
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
    chapterTwoBasis: groupAverages.literature !== null
      ? "درصد ثبت‌شده در شیت بخش‌ها"
      : "نسبت کلمات به هدف فصل دوم",
    chapterThreeBasis: groupAverages.methodology !== null
      ? "درصد ثبت‌شده در شیت بخش‌ها"
      : "نسبت کلمات به هدف فصل سوم"
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

  if (!Object.keys(row).length) {
    container.className = "empty-state"
    container.textContent = "اطلاعات هفته جاری ثبت نشده است"
    return
  }

  container.className = "week-card"
  container.innerHTML = `
    <div class="week-title">
      <div>
        <span class="panel-kicker">${escapeHTML(row["بازه زمانی"] || "")}</span>
        <h4>هفته ${faNumber(row["هفته"] || "")}</h4>
      </div>
      ${statusBadge(row["وضعیت"] || "شروع نشده")}
    </div>

    <div class="week-activity">
      ${escapeHTML(row["فعالیت اصلی"] || "فعالیت اصلی ثبت نشده است")}
    </div>

    <div class="week-metrics">
      ${metricChip(row["منابع کامل واقعی"], "منابع کامل")}
      ${metricChip(row["کلمات جدید فصل دوم"], "کلمات فصل دوم")}
      ${metricChip(row["کلمات جدید فصل سوم"], "کلمات فصل سوم")}
    </div>

    ${row["خروجی یا بخش انجام‌شده"]
      ? `<div class="week-output"><strong>خروجی:</strong> ${escapeHTML(row["خروجی یا بخش انجام‌شده"])}</div>`
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

  const actualValues = rows.map(row => {
    const explicitTotal = numberValue(row["مجموع واقعی فصل دوم"])

    if (explicitTotal > 0) {
      runningActual = explicitTotal
    } else {
      runningActual += numberValue(row["کلمات جدید فصل دوم"])
    }

    return runningActual
  })

  const maxValue = Math.max(
    1,
    ...targetValues,
    ...actualValues,
    positiveNumber(config.chapterTwoTarget) || 15000
  )

  const width = 640
  const height = 210
  const paddingX = 30
  const paddingY = 24
  const plotWidth = width - paddingX * 2
  const plotHeight = height - paddingY * 2
  const step = rows.length > 1 ? plotWidth / (rows.length - 1) : plotWidth

  const points = values => values.map((value, index) => {
    const x = paddingX + index * step
    const y = height - paddingY - (value / maxValue) * plotHeight
    return `${x},${y}`
  }).join(" ")

  const labels = rows.map((row, index) => {
    const x = paddingX + index * step
    return `<text x="${x}" y="${height - 3}" text-anchor="middle" class="chart-label">${faNumber(row["هفته"] || index + 1)}</text>`
  }).join("")

  container.innerHTML = `
    <div class="chart-legend">
      <span><i class="legend-line target-line"></i>هدف تجمعی</span>
      <span><i class="legend-line actual-line"></i>عملکرد واقعی</span>
    </div>

    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="نمودار روند نگارش فصل دوم">
      <line x1="${paddingX}" y1="${height - paddingY}" x2="${width - paddingX}" y2="${height - paddingY}" class="chart-axis"></line>
      <line x1="${paddingX}" y1="${paddingY}" x2="${paddingX}" y2="${height - paddingY}" class="chart-axis"></line>
      <polyline points="${points(targetValues)}" class="chart-target"></polyline>
      <polyline points="${points(actualValues)}" class="chart-actual"></polyline>
      ${labels}
    </svg>
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

  const active = state.annual.find(row =>
    ["در حال انجام", "بخشی انجام شد"].includes(row["وضعیت"])
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

  return `
    <article class="annual-focus-card">
      <div class="annual-focus-top">
        <div>
          <span class="panel-kicker">${escapeHTML(row["بازه زمانی"] || "")}</span>
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
        <span>پیشرفت ثبت‌شده</span>
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
    ["بازه زمانی", "بازه زمانی"],
    ["تمرکز اصلی", "تمرکز اصلی"],
    ["فعالیت‌های اصلی", "فعالیت‌های اصلی"],
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
    ["بازه زمانی", "بازه زمانی"],
    ["فعالیت اصلی", "فعالیت اصلی"],
    ["حداقل منابع کامل", "هدف منابع"],
    ["هدف تجمعی فصل دوم", "هدف تجمعی فصل دوم"],
    ["منابع کامل واقعی", "منابع واقعی"],
    ["کلمات جدید فصل دوم", "کلمات فصل دوم"],
    ["کلمات جدید فصل سوم", "کلمات فصل سوم"],
    ["مجموع واقعی فصل دوم", "مجموع فصل دوم"],
    ["وضعیت", "وضعیت"],
    ["خروجی یا بخش انجام‌شده", "خروجی"],
    ["فعالیت منتقل‌شده", "منتقل‌شده"]
  ]

  container.innerHTML = buildDataTable(
    columns,
    state.weekly,
    (row, key) => {
      if (key === "وضعیت") return statusBadge(row[key] || "شروع نشده")

      if ([
        "هفته",
        "حداقل منابع کامل",
        "هدف تجمعی فصل دوم",
        "منابع کامل واقعی",
        "کلمات جدید فصل دوم",
        "کلمات جدید فصل سوم",
        "مجموع واقعی فصل دوم"
      ].includes(key)) {
        return faNumber(row[key] || 0)
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

  if (!state.sources.length) {
    container.innerHTML = setupMessage(
      "نشانی CSV شیت مدیریت منابع را در config.js وارد کنید"
    )
    return
  }

  const normalizedQuery = normalizeText(query).toLowerCase()

  const rows = state.sources.filter(row => {
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

  if (!state.files.length) {
    container.innerHTML = setupMessage(
      "در شیت «فایل‌ها» عنوان، دسته، لینک و توضیح فایل‌ها را وارد کنید"
    )
    return
  }

  container.innerHTML = state.files.map(row => {
    const url = row["لینک"]

    return `
      <article class="file-card">
        <span class="file-category">${escapeHTML(row["دسته"] || "فایل پژوهش")}</span>
        <h3>${escapeHTML(row["عنوان"] || "بدون عنوان")}</h3>
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
  const normalized = String(value || "")
    .trim()
    .replace(/[۰-۹]/g, digit => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    .replace(/[٠-٩]/g, digit => "٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    .replace(/\//g, "-")

  const parts = normalized.split("-").map(Number)

  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) {
    return null
  }

  const [year, month, day] = parts
  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null

  return date
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

  if (isCompleted(value)) {
    className = "status-done"
  } else if (["در حال انجام", "در حال مطالعه"].includes(value)) {
    className = "status-progress"
  } else if (
    ["بخشی انجام شد", "انتخاب شده", "برنامه‌ریزی‌شده"].includes(value)
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
