# راه‌اندازی داشبورد رساله در GitHub Pages

این پروژه یک وب‌سایت ایستا و راست‌چین برای نمایش برنامه هفتگی، فصل‌ها، منابع و لینک‌های Google Drive است.

## فایل‌های پروژه

- `index.html` ساختار صفحه
- `styles.css` طراحی ظاهری
- `app.js` دریافت و نمایش داده‌ها
- `config.js` محل واردکردن لینک‌ها
- `sections-template.csv` الگوی شیت بخش‌ها
- `files-template.csv` الگوی شیت فایل‌ها

## مرحله ۱ ـ آماده‌سازی Google Sheets

فایل اکسل برنامه رساله را در Google Drive بارگذاری و با Google Sheets باز کنید.

شیت‌های زیر را نگه دارید:

- برنامه سالانه
- پیگیری ۱۴ هفته
- مدیریت منابع

دو شیت جدید بسازید:

- بخش‌ها
- فایل‌ها

محتوای فایل‌های `sections-template.csv` و `files-template.csv` را در این دو شیت وارد کنید.

## مرحله ۲ ـ انتشار هر شیت به صورت CSV

برای هر شیت:

1. از منوی File وارد Share شوید
2. Publish to web را انتخاب کنید
3. از فهرست اول نام همان شیت را انتخاب کنید
4. از فهرست نوع خروجی، Comma-separated values یا CSV را انتخاب کنید
5. Publish را بزنید
6. لینک ایجادشده را کپی کنید

این کار را برای شیت‌های زیر انجام دهید:

- برنامه سالانه
- پیگیری ۱۴ هفته
- مدیریت منابع
- بخش‌ها
- فایل‌ها

## مرحله ۳ ـ تنظیم Google Drive

یک پوشه اصلی برای رساله بسازید.

ساختار پیشنهادی:

- 01 فصل دوم
- 02 فصل سوم
- 03 مصاحبه‌ها
- 04 تحلیل
- 05 مقاله
- 06 نسخه‌های نهایی

برای فایل‌هایی که قرار است از سایت باز شوند، لینک مشاهده را در شیت «فایل‌ها» ثبت کنید.

اطلاعات محرمانه، نام مشارکت‌کننده، فایل صوتی و متن مصاحبه را عمومی نکنید.

## مرحله ۴ ـ ویرایش config.js

فایل `config.js` را باز کنید.

موارد زیر را تغییر دهید:

- نام پژوهشگر
- عنوان رساله
- لینک اصلی Google Sheet
- لینک پوشه Google Drive
- پنج لینک CSV منتشرشده

نمونه:

```js
window.APP_CONFIG = {
  appTitle: "سامانه رساله دکتری",
  appSubtitle: "داشبورد پیشرفت پژوهش",
  researcherName: "علی",
  thesisTitle: "عنوان کامل رساله",
  chapterTwoTarget: 15000,

  links: {
    googleSheet: "https://docs.google.com/spreadsheets/d/...",
    googleDriveFolder: "https://drive.google.com/drive/folders/..."
  },

  csv: {
    annual: "https://docs.google.com/spreadsheets/d/e/.../pub?output=csv",
    weekly: "https://docs.google.com/spreadsheets/d/e/.../pub?output=csv",
    sections: "https://docs.google.com/spreadsheets/d/e/.../pub?output=csv",
    sources: "https://docs.google.com/spreadsheets/d/e/.../pub?output=csv",
    files: "https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
  }
}
```

## مرحله ۵ ـ ایجاد مخزن GitHub

1. وارد GitHub شوید
2. روی New repository بزنید
3. نام مخزن را `USERNAME.github.io` قرار دهید
4. USERNAME را با نام کاربری GitHub خود جایگزین کنید
5. مخزن را Public بسازید
6. Create repository را بزنید

## مرحله ۶ ـ بارگذاری فایل‌ها

در صفحه مخزن:

1. Add file را بزنید
2. Upload files را انتخاب کنید
3. فایل‌های داخل پوشه پروژه را بارگذاری کنید
4. Commit changes را بزنید

فایل zip را داخل مخزن بارگذاری نکنید. فقط فایل‌های استخراج‌شده را بارگذاری کنید.

## مرحله ۷ ـ فعال‌کردن GitHub Pages

1. وارد Settings مخزن شوید
2. Pages را باز کنید
3. در بخش Build and deployment گزینه Deploy from a branch را انتخاب کنید
4. Branch را روی `main` و Folder را روی `/root` قرار دهید
5. Save را بزنید

نشانی سایت:

```text
https://USERNAME.github.io
```

## به‌روزرسانی سایت

اطلاعات روزانه و هفتگی را فقط در Google Sheets تغییر دهید.

صفحه در هر بار بازشدن، داده منتشرشده را از شیت می‌خواند.

برای تغییر ظاهر یا منو، فایل‌های مخزن را ویرایش کنید.

## مدل دسترسی

این نسخه برای نمایش اطلاعات طراحی شده است.

ثبت و ویرایش داده داخل خود سایت انجام نمی‌شود.

برای ویرایش، Google Sheets و Google Drive باز می‌شوند.

این ساختار ساده‌تر، امن‌تر و کم‌هزینه‌تر از ساخت ورود کاربر و بک‌اند است.
