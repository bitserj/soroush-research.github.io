const config = window.APP_CONFIG || {}

const state = {
  annual: [],
  weekly: [],
  sections: [],
  sources: [],
  files: []
}

const demoSections = [
  {
    "بخش": "مرور ادبیات",
    "عنوان": "مفاهیم اصلی",
    "وضعیت": "در حال انجام",
    "درصد پیشرفت": "40",
    "تعداد کلمات": "2400",
    "لینک فایل": "",
    "یادداشت": "تعاریف و ابعاد اصلی"
  },
  {
    "بخش": "مرور ادبیات",
    "عنوان": "چارچوب نظری",
    "وضعیت": "شروع نشده",
    "درصد پیشرفت": "0",
    "تعداد کلمات": "0",
    "لینک فایل": "",
    "یادداشت": "تبیین نظری روابط اصلی"
  },
  {
    "بخش": "روش‌شناسی",
    "عنوان": "طرح پژوهش",
    "وضعیت": "شروع نشده",
    "درصد پیشرفت": "0",
    "تعداد کلمات": "0",
    "لینک فایل": "",
    "یادداشت": "رویکرد و منطق طراحی پژوهش"
  },
  {
    "بخش": "تحلیل و یافته‌ها",
    "عنوان": "تحلیل توصیفی و تجربی",
    "وضعیت": "شروع نشده",
    "درصد پیشرفت": "0",
    "تعداد کلمات": "0",
    "لینک فایل": "",
    "یادداشت": "پس از تکمیل میدان"
  }
]

const demoFiles = [
  {
    "عنوان": "نسخه جاری فصل دوم",
    "دسته": "فصل‌ها",
    "لینک": "",
    "توضیح": "آخرین نسخه قابل ویرایش در Google Drive"
  },
  {
    "عنوان": "جدول مرور منابع",
    "دسته": "منابع",
    "لینک": "",
    "توضیح": "جدول ثبت و مقایسه منابع"
  },
  {
    "عنوان": "راهنمای مصاحبه",
    "دسته": "ابزار پژوهش",
    "لینک": "",
    "توضیح": "نسخه اجرایی راهنمای مصاحبه"
  }
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
  document.getElementById("brandTitle").textContent = config.appTitle || "سامانه رساله"
  document.getElementById("brandSubtitle").textContent = config.appSubtitle || "داشبورد پیشرفت پژوهش"
  document.getElementById("heroTitle").textContent = config.researcherName
    ? `پیشرفت رساله ${config.researcherName}`
    : "پیشرفت رساله در یک نگاه"
  document.getElementById("heroDescription").textContent = config.thesisTitle || "برنامه، فصل‌ها، منابع و فایل‌های اصلی"

  setLink("sheetLink", config.links?.googleSheet)
  setLink("driveLink", config.links?.googleDriveFolder)
  setLink("heroDriveLink", config.links?.googleDriveFolder)
}

function setLink(id, url) {
  const element = document.getElementById(id)
  if (!element) return
  if (!isConfiguredUrl(url)) {
    element.style.display = "none"
    return
  }
  element.href = url
}

function bindNavigation() {
  const items = document.querySelectorAll("[data-view-target]")
  items.forEach(item => {
    item.addEventListener("click", () => {
      openView(item.dataset.viewTarget)
      document.getElementById("sidebar").classList.remove("open")
    })
  })

  document.querySelectorAll("[data-jump]").forEach(button => {
    button.addEventListener("click", () => openView(button.dataset.jump))
  })
}

function openView(viewName) {
  document.querySelectorAll(".view").forEach(view => {
    view.classList.toggle("active", view.dataset.view === viewName)
  })

  document.querySelectorAll("[data-view-target]").forEach(item => {
    item.classList.toggle("active", item.dataset.viewTarget === viewName)
  })

  const activeButton = document.querySelector(`[data-view-target="${viewName}"]`)
  document.getElementById("pageTitle").textContent =
    activeButton?.querySelector("span:last-child")?.textContent || "داشبورد"

  window.scrollTo({ top: 0, behavior: "smooth" })
}

function bindActions() {
  document.getElementById("menuButton").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open")
  })

  document.getElementById("themeButton").addEventListener("click", toggleTheme)

  document.getElementById("refreshButton").addEventListener("click", async () => {
    showToast("در حال تازه‌سازی داده‌ها")
    await loadAllData(true)
  })

  document.getElementById("sourceSearch").addEventListener("input", event => {
    renderSources(event.target.value)
  })
}

async function loadAllData(force = false) {
  const cacheKey = force ? `?refresh=${Date.now()}` : ""

  const jobs = [
    loadDataset("annual", config.csv?.annual, cacheKey),
    loadDataset("weekly", config.csv?.weekly, cacheKey),
    loadDataset("sections", config.csv?.sections, cacheKey),
    loadDataset("sources", config.csv?.sources, cacheKey),
    loadDataset("files", config.csv?.files, cacheKey)
  ]

  await Promise.all(jobs)

  if (!state.sections.length) state.sections = demoSections
  if (!state.files.length) state.files = demoFiles

  renderAll()
  document.getElementById("lastUpdated").textContent =
    `آخرین به‌روزرسانی: ${new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date())}`

  if (force) showToast("داده‌ها تازه‌سازی شد")
}

async function loadDataset(key, url, cacheKey) {
  if (!isConfiguredUrl(url)) {
    state[key] = []
    return
  }

  try {
    const response = await fetch(url + cacheKey)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const text = await response.text()
    state[key] = parsePublishedSheet(text)
  } catch (error) {
    console.error(`خطا در دریافت ${key}`, error)
    state[key] = []
    showToast(`دریافت داده ${key} انجام نشد`)
  }
}

function isConfiguredUrl(url) {
  return Boolean(url && /^https?:\/\//i.test(url) && !url.includes("PASTE_"))
}

function parsePublishedSheet(text) {
  const rows = parseCSV(text)
    .map(row => row.map(cell => String(cell || "").trim()))
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
  renderWeekly()
  renderSections()
  renderSources()
  renderFiles()
}

function renderDashboard() {
  const actualRows = state.weekly.filter(row =>
    numberValue(row["منابع کامل واقعی"]) ||
    numberValue(row["کلمات جدید فصل دوم"]) ||
    row["وضعیت"]
  )

  const latest = actualRows.at(-1) || state.weekly[0] || {}
  const totalWords = getLatestChapterTwoTotal()
  const targetWords = numberValue(config.chapterTwoTarget) || 15000
  const percent = Math.min(100, Math.round((totalWords / targetWords) * 100)) || 0
  const sourceCount = state.sources.filter(row =>
    ["مطالعه شده", "استفاده شده در متن"].includes(row["وضعیت مطالعه"])
  ).length
  const completedWeeks = state.weekly.filter(row => row["وضعیت"] === "انجام شد").length
  const sectionsAverage = average(
    state.sections.map(row => numberValue(row["درصد پیشرفت"]))
  )

  const ring = document.getElementById("progressRing")
  ring.style.setProperty("--progress", `${percent * 3.6}deg`)
  document.getElementById("progressPercent").textContent = `${faNumber(percent)}٪`

  const cards = [
    { icon: "✎", label: "کلمات فصل دوم", value: faNumber(totalWords) },
    { icon: "▤", label: "منابع مطالعه‌شده", value: faNumber(sourceCount) },
    { icon: "✓", label: "هفته‌های تکمیل‌شده", value: faNumber(completedWeeks) },
    { icon: "◉", label: "میانگین پیشرفت بخش‌ها", value: `${faNumber(sectionsAverage)}٪` }
  ]

  document.getElementById("kpiGrid").innerHTML = cards.map(card => `
    <article class="kpi-card">
      <div class="kpi-top">
        <small>${escapeHTML(card.label)}</small>
        <span class="kpi-icon">${card.icon}</span>
      </div>
      <strong>${card.value}</strong>
    </article>
  `).join("")

  renderCurrentWeek(latest)
  renderTrend()
  renderSectionSummary()
}

function getLatestChapterTwoTotal() {
  const totals = state.weekly
    .map(row => numberValue(row["مجموع واقعی فصل دوم"]))
    .filter(value => value > 0)

  if (totals.length) return totals.at(-1)

  return state.weekly.reduce(
    (sum, row) => sum + numberValue(row["کلمات جدید فصل دوم"]),
    0
  )
}

function renderCurrentWeek(row) {
  const container = document.getElementById("currentWeekCard")

  if (!Object.keys(row).length) {
    container.innerHTML = setupMessage("نشانی CSV شیت هفتگی را در config.js وارد کنید")
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
    <div class="week-activity">${escapeHTML(row["فعالیت اصلی"] || "فعالیت اصلی ثبت نشده است")}</div>
    <div class="week-metrics">
      ${metricChip(row["منابع کامل واقعی"] || row["حداقل منابع کامل"] || "۰", "منبع کامل")}
      ${metricChip(row["کلمات جدید فصل دوم"] || row["حداقل کلمات فصل دوم"] || "۰", "کلمات این هفته")}
      ${metricChip(row["مجموع واقعی فصل دوم"] || row["هدف تجمعی فصل دوم"] || "۰", "مجموع فصل دوم")}
    </div>
  `
}

function metricChip(value, label) {
  return `
    <div class="metric-chip">
      <strong>${faNumber(value)}</strong>
      <span>${escapeHTML(label)}</span>
    </div>
  `
}

function renderTrend() {
  const container = document.getElementById("trendChart")
  const points = state.weekly
    .map((row, index) => ({
      week: index + 1,
      target: numberValue(row["هدف تجمعی فصل دوم"]),
      actual: numberValue(row["مجموع واقعی فصل دوم"])
    }))

  if (!points.length) {
    container.innerHTML = setupMessage("پس از اتصال شیت هفتگی، نمودار در این بخش نمایش داده می‌شود")
    return
  }

  const width = 620
  const height = 210
  const paddingX = 34
  const paddingY = 22
  const maxValue = Math.max(
    numberValue(config.chapterTwoTarget) || 15000,
    ...points.map(point => Math.max(point.target, point.actual))
  )

  const x = index =>
    paddingX + (index / Math.max(1, points.length - 1)) * (width - paddingX * 2)

  const y = value =>
    height - paddingY - (value / maxValue) * (height - paddingY * 2)

  const targetPath = points
    .map((point, index) => `${index ? "L" : "M"} ${x(index)} ${y(point.target)}`)
    .join(" ")

  const actualAvailable = points.filter(point => point.actual > 0)
  const actualPath = actualAvailable
    .map((point, index) => {
      const originalIndex = points.indexOf(point)
      return `${index ? "L" : "M"} ${x(originalIndex)} ${y(point.actual)}`
    })
    .join(" ")

  container.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="روند نگارش فصل دوم">
      <defs>
        <linearGradient id="actualGradient" x1="0" x2="1">
          <stop offset="0%" stop-color="#10b981"></stop>
          <stop offset="100%" stop-color="#175cd3"></stop>
        </linearGradient>
      </defs>
      ${[0, 0.5, 1].map(level => `
        <line x1="${paddingX}" y1="${y(maxValue * level)}" x2="${width - paddingX}" y2="${y(maxValue * level)}"
          stroke="currentColor" opacity="0.08"></line>
        <text x="${width - paddingX}" y="${y(maxValue * level) - 5}" text-anchor="end" class="chart-label">
          ${faNumber(Math.round(maxValue * level))}
        </text>
      `).join("")}
      <path d="${targetPath}" fill="none" stroke="#8aa0bd" stroke-width="2" stroke-dasharray="7 7"></path>
      ${actualPath ? `<path d="${actualPath}" fill="none" stroke="url(#actualGradient)" stroke-width="4" stroke-linecap="round"></path>` : ""}
      ${points.map((point, index) => `
        <text x="${x(index)}" y="${height - 3}" text-anchor="middle" class="chart-label">${faNumber(index + 1)}</text>
      `).join("")}
    </svg>
  `
}

function renderSectionSummary() {
  const container = document.getElementById("sectionSummary")
  const groups = ["مرور ادبیات", "روش‌شناسی", "میدان پژوهش", "تحلیل و یافته‌ها"]

  container.innerHTML = groups.map(group => {
    const rows = filterSectionGroup(group)
    const progress = rows.length
      ? average(rows.map(row => numberValue(row["درصد پیشرفت"])))
      : 0

    return `
      <article class="summary-card">
        <div class="summary-card-header">
          <h4>${escapeHTML(group)}</h4>
          <strong>${faNumber(progress)}٪</strong>
        </div>
        <p>${faNumber(rows.length)} بخش ثبت‌شده</p>
        <div class="progress-track">
          <div class="progress-fill" style="width:${progress}%"></div>
        </div>
        <div class="progress-caption">
          <span>پیشرفت</span>
          <span>${faNumber(progress)} از ۱۰۰</span>
        </div>
      </article>
    `
  }).join("")
}

function renderWeekly() {
  const container = document.getElementById("weeklyTable")

  if (!state.weekly.length) {
    container.innerHTML = setupMessage("نشانی CSV شیت «پیگیری ۱۴ هفته» را در config.js وارد کنید")
    return
  }

  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>هفته</th>
            <th>بازه</th>
            <th>فعالیت اصلی</th>
            <th>منابع واقعی</th>
            <th>کلمات جدید</th>
            <th>مجموع فصل دوم</th>
            <th>وضعیت</th>
            <th>خروجی انجام‌شده</th>
          </tr>
        </thead>
        <tbody>
          ${state.weekly.map(row => `
            <tr>
              <td>${faNumber(row["هفته"] || "")}</td>
              <td>${escapeHTML(row["بازه زمانی"] || "")}</td>
              <td>${escapeHTML(row["فعالیت اصلی"] || "")}</td>
              <td>${faNumber(row["منابع کامل واقعی"] || "")}</td>
              <td>${faNumber(row["کلمات جدید فصل دوم"] || "")}</td>
              <td>${faNumber(row["مجموع واقعی فصل دوم"] || "")}</td>
              <td>${statusBadge(row["وضعیت"] || "شروع نشده")}</td>
              <td>${escapeHTML(row["خروجی یا بخش انجام‌شده"] || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `
}

function renderSections() {
  renderSectionCards("literatureCards", "مرور ادبیات")
  renderSectionCards("methodologyCards", "روش‌شناسی")
  renderSectionCards("fieldworkCards", "میدان پژوهش")
  renderSectionCards("analysisCards", "تحلیل و یافته‌ها")
}

function renderSectionCards(containerId, group) {
  const container = document.getElementById(containerId)
  const rows = filterSectionGroup(group)

  if (!rows.length) {
    container.innerHTML = setupMessage(`در شیت «بخش‌ها» چند ردیف با بخش «${group}» اضافه کنید`)
    return
  }

  container.innerHTML = rows.map(row => {
    const progress = clamp(numberValue(row["درصد پیشرفت"]), 0, 100)
    const url = row["لینک فایل"]

    return `
      <article class="detail-card">
        <div class="detail-card-header">
          <h3>${escapeHTML(row["عنوان"] || "بدون عنوان")}</h3>
          ${statusBadge(row["وضعیت"] || "شروع نشده")}
        </div>
        <p>${escapeHTML(row["یادداشت"] || "یادداشتی ثبت نشده است")}</p>
        <div class="progress-track">
          <div class="progress-fill" style="width:${progress}%"></div>
        </div>
        <div class="progress-caption">
          <span>${faNumber(progress)}٪ پیشرفت</span>
          <span>${faNumber(row["تعداد کلمات"] || 0)} کلمه</span>
        </div>
        <div class="detail-meta">
          <span class="meta-chip">${escapeHTML(group)}</span>
        </div>
        ${isConfiguredUrl(url)
          ? `<a class="card-link" href="${escapeAttribute(url)}" target="_blank" rel="noopener">بازکردن فایل ↗</a>`
          : ""}
      </article>
    `
  }).join("")
}

function filterSectionGroup(group) {
  return state.sections.filter(row => {
    const section = String(row["بخش"] || "")
    return section.includes(group) ||
      (group === "مرور ادبیات" && section.includes("فصل دوم")) ||
      (group === "روش‌شناسی" && section.includes("فصل سوم")) ||
      (group === "تحلیل و یافته‌ها" && section.includes("فصل چهارم"))
  })
}

function renderSources(query = "") {
  const container = document.getElementById("sourcesTable")
  const normalizedQuery = String(query || "").trim().toLowerCase()

  const rows = state.sources.filter(row => {
    if (!normalizedQuery) return true
    return [
      row["عنوان منبع"],
      row["نویسنده یا سازمان"],
      row["محور فصل"],
      row["نوع منبع"],
      row["وضعیت مطالعه"]
    ].some(value => String(value || "").toLowerCase().includes(normalizedQuery))
  })

  if (!state.sources.length) {
    container.innerHTML = setupMessage("نشانی CSV شیت «مدیریت منابع» را در config.js وارد کنید")
    return
  }

  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>عنوان</th>
            <th>نویسنده</th>
            <th>سال</th>
            <th>نوع</th>
            <th>محور</th>
            <th>وضعیت</th>
            <th>استفاده در بخش</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${sourceTitle(row)}</td>
              <td>${escapeHTML(row["نویسنده یا سازمان"] || "")}</td>
              <td>${faNumber(row["سال"] || "")}</td>
              <td>${escapeHTML(row["نوع منبع"] || "")}</td>
              <td>${escapeHTML(row["محور فصل"] || "")}</td>
              <td>${statusBadge(row["وضعیت مطالعه"] || "انتخاب شده")}</td>
              <td>${escapeHTML(row["استفاده در بخش"] || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `
}

function sourceTitle(row) {
  const title = escapeHTML(row["عنوان منبع"] || "بدون عنوان")
  const url = row["لینک یا شناسه"]
  return isConfiguredUrl(url)
    ? `<a class="card-link" href="${escapeAttribute(url)}" target="_blank" rel="noopener">${title} ↗</a>`
    : title
}

function renderFiles() {
  const container = document.getElementById("filesCards")

  if (!state.files.length) {
    container.innerHTML = setupMessage("در شیت «فایل‌ها» عنوان، دسته، لینک و توضیح فایل‌ها را وارد کنید")
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
          ? `<a class="card-link" href="${escapeAttribute(url)}" target="_blank" rel="noopener">بازکردن در Drive ↗</a>`
          : `<span class="meta-chip">لینک وارد نشده است</span>`}
      </article>
    `
  }).join("")
}

function statusBadge(status) {
  const value = String(status || "شروع نشده")
  let className = "status-not-started"

  if (["انجام شد", "مطالعه شده", "استفاده شده در متن", "تکمیل شده"].includes(value)) {
    className = "status-done"
  } else if (["در حال انجام", "در حال مطالعه"].includes(value)) {
    className = "status-progress"
  } else if (["بخشی انجام شد", "انتخاب شده"].includes(value)) {
    className = "status-partial"
  } else if (["منتقل شد", "کنار گذاشته شده"].includes(value)) {
    className = "status-moved"
  }

  return `<span class="status-badge ${className}">${escapeHTML(value)}</span>`
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
  if (typeof value === "number") return Number.isFinite(value) ? value : 0

  const converted = String(value || "")
    .replace(/[۰-۹]/g, digit => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    .replace(/[٠-٩]/g, digit => "٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    .replace(/[,٬\s]/g, "")
    .replace(/[^\d.-]/g, "")

  const result = Number(converted)
  return Number.isFinite(result) ? result : 0
}

function faNumber(value) {
  if (value === "" || value === null || value === undefined) return "—"
  const numeric = numberValue(value)
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat("fa-IR").format(numeric)
    : String(value)
}

function average(values) {
  const valid = values.filter(value => Number.isFinite(value))
  if (!valid.length) return 0
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length)
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function escapeAttribute(value) {
  return escapeHTML(value)
}

function restoreTheme() {
  const saved = localStorage.getItem("thesis-dashboard-theme")
  if (saved === "dark") document.documentElement.dataset.theme = "dark"
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
  toast.textContent = message
  toast.classList.add("show")

  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600)
}
