const dictionaries = {
  fa: {
    chats:"گفتگوها", projects:"پروژه‌ها", archive:"بایگانی", settings:"تنظیمات", help:"راهنما",
    helpTitle:"راهنمای نصب و استفاده",helpIntro:"برای استفاده از امکانات مدیریت گفتگوها و پروژه‌های حساب ChatGPT، ابتدا Userscript را با Tampermonkey نصب کنید.",
    helpStep1Title:"۱. نصب Tampermonkey",helpStep1Text:"افزونه Tampermonkey را برای مرورگر خود نصب و فعال کنید.",
    helpTampermonkeyLink:"وب‌سایت رسمی Tampermonkey",
    helpStep2Title:"۲. دریافت فایل ChatGPTManager.user.js",helpStep2Text:"فایل Userscript را از لینک مرحله بعد باز کنید. Tampermonkey صفحه نصب اسکریپت را نمایش می‌دهد.",
    helpStep3Title:"۳. نصب ChatGPT Manager",helpStep3A:"روی لینک نصب اسکریپت کلیک کنید.",helpStep3B:"در صفحه Tampermonkey گزینه Install را بزنید.",helpStep3C:"مطمئن شوید اسکریپت در داشبورد Tampermonkey فعال است.",
    helpInstallLink:"نصب ChatGPT Manager در Tampermonkey",
    helpUsageTitle:"۴. اجرای برنامه",helpUsageA:"یک تب از chatgpt.com باز کنید و وارد حساب خود شوید.",helpUsageB:"روی آیکون Tampermonkey در نوار مرورگر کلیک کنید.",helpUsageC:"از منوی ChatGPT Manager، گزینه بازکردن Manager را انتخاب کنید. برای دسترسی به API حساب، تب ChatGPT باید باز باشد.",
    helpNoteTitle:"نکته مهم",helpNoteText:"صفحه مستقل Manager نیز برای مشاهده رابط و امکانات محلی قابل بازکردن است؛ اما عملیات مربوط به گفتگوها و پروژه‌های حساب به یک تب فعال ChatGPT با نشست معتبر و Userscript نصب‌شده نیاز دارد.",

    newChat:"گفتگوی جدید", refresh:"بروزرسانی", search:"جست‌وجو در گفتگوها",
    all:"همه", active:"فعال", archived:"بایگانی‌شده", title:"عنوان", project:"پروژه",
    updated:"آخرین تغییر", actions:"عملیات", selectAll:"انتخاب همه", clear:"پاک‌کردن انتخاب",
    archiveSelected:"بایگانی", restoreSelected:"بازیابی", deleteSelected:"حذف دائمی",
    moveTo:"انتقال به پروژه", createProject:"پروژه جدید", rename:"تغییر نام",
    delete:"حذف", save:"ذخیره", cancel:"انصراف", close:"بستن", send:"ارسال",
    message:"پیام خود را بنویسید...", loading:"در حال بارگذاری...", empty:"موردی برای نمایش نیست",
    selected:"انتخاب‌شده", confirmDelete:"حذف دائمی موارد انتخاب‌شده؟ این عملیات قابل بازگشت نیست.",
    confirmProjectDelete:"حذف پروژه؟ گفتگوهای آن حذف نمی‌شوند اما ممکن است از فهرست پروژه خارج شوند.",
    projectName:"نام پروژه", chatDetails:"جزئیات گفتگو", loadError:"خطا در دریافت اطلاعات",
    noProject:"بدون پروژه", allProjects:"همه پروژه‌ها", connection:"وضعیت اتصال",
    connected:"متصل به نشست ChatGPT", preview:"پیش‌نمایش مستقل", bridgeOffline:"پل Tampermonkey متصل نیست", brokerOffline:"تب فعال ChatGPT پیدا نشد", accountAuthenticated:"حساب ChatGPT وارد شده", accountUnauthenticated:"ورود به ChatGPT لازم است", apiAvailable:"اتصال API تأیید شد", apiUnavailable:"API پاسخ معتبر نداد", language:"زبان",
    theme:"پوسته", auto:"خودکار", dark:"تیره", light:"روشن", bulk:"عملیات گروهی",
    branches:"شاخه‌های گفتگو", searchHint:"عنوان گفتگو را جست‌وجو کنید",
    refreshDone:"فهرست بروزرسانی شد", operationDone:"عملیات انجام شد", apiError:"درخواست ناموفق بود",
    sendUnsupported:"ارسال پیام از محیط Manager هنوز به جریان بومی ارسال ChatGPT متصل نشده است.",
    selectProject:"یک پروژه انتخاب کنید", renameChat:"تغییر عنوان گفتگو",
    branchNote:"شاخه‌های گفتگو از اطلاعات ساختار گفتگو قابل بررسی‌اند.",
    closeManager:"بستن Manager", openChat:"بازکردن گفتگو", noMessages:"پیامی برای نمایش وجود ندارد",
    loadMore:"بارگذاری بیشتر", retry:"تلاش دوباره", confirm:"تأیید"
  },
  en: {
    chats:"Conversations", projects:"Projects", archive:"Archive", settings:"Settings", help:"Help",
    helpTitle:"Installation and usage",helpIntro:"To manage conversations and projects in your ChatGPT account, install the userscript with Tampermonkey first.",
    helpStep1Title:"1. Install Tampermonkey",helpStep1Text:"Install and enable the Tampermonkey extension for your browser.",
    helpTampermonkeyLink:"Official Tampermonkey website",
    helpStep2Title:"2. Get ChatGPTManager.user.js",helpStep2Text:"Open the userscript link in the next step. Tampermonkey will show its script installation page.",
    helpStep3Title:"3. Install ChatGPT Manager",helpStep3A:"Open the install script link.",helpStep3B:"Click Install on the Tampermonkey installation page.",helpStep3C:"Make sure the script is enabled in the Tampermonkey dashboard.",
    helpInstallLink:"Install ChatGPT Manager in Tampermonkey",
    helpUsageTitle:"4. Launch the app",helpUsageA:"Open a chatgpt.com tab and sign in.",helpUsageB:"Click the Tampermonkey icon in your browser toolbar.",helpUsageC:"Choose Open ChatGPT Manager from its menu. Keep the ChatGPT tab open for account API access.",
    helpNoteTitle:"Important",helpNoteText:"The standalone Manager page can also be opened for its interface and local features. Account conversation and project operations require an open ChatGPT tab with a valid session and the userscript installed.",

    newChat:"New chat", refresh:"Refresh", search:"Search conversations",
    all:"All", active:"Active", archived:"Archived", title:"Title", project:"Project",
    updated:"Updated", actions:"Actions", selectAll:"Select all", clear:"Clear selection",
    archiveSelected:"Archive", restoreSelected:"Restore", deleteSelected:"Delete permanently",
    moveTo:"Move to project", createProject:"New project", rename:"Rename",
    delete:"Delete", save:"Save", cancel:"Cancel", close:"Close", send:"Send",
    message:"Write a message...", loading:"Loading...", empty:"Nothing to show",
    selected:"selected", confirmDelete:"Permanently delete selected items? This cannot be undone.",
    confirmProjectDelete:"Delete project? Its conversations will not be deleted but may leave the project list.",
    projectName:"Project name", chatDetails:"Conversation details", loadError:"Could not load data",
    noProject:"No project", allProjects:"All projects", connection:"Connection",
    connected:"Connected to ChatGPT session", preview:"Standalone preview", bridgeOffline:"Tampermonkey bridge unavailable", brokerOffline:"No active ChatGPT tab found", accountAuthenticated:"ChatGPT account authenticated", accountUnauthenticated:"ChatGPT sign-in required", apiAvailable:"Backend API verified", apiUnavailable:"Backend API request failed", language:"Language",
    theme:"Theme", auto:"Auto", dark:"Dark", light:"Light", bulk:"Bulk actions",
    branches:"Conversation branches", searchHint:"Search conversation titles",
    refreshDone:"List refreshed", operationDone:"Operation completed", apiError:"Request failed",
    sendUnsupported:"Sending from Manager is not connected to ChatGPT's native send flow yet.",
    selectProject:"Select a project", renameChat:"Rename conversation",
    branchNote:"Conversation branches can be inspected from conversation structure.",
    closeManager:"Close Manager", openChat:"Open conversation", noMessages:"No messages to display",
    loadMore:"Load more", retry:"Retry", confirm:"Confirm"
  }
};
export class I18n {
  constructor(language="fa") { this.language = dictionaries[language] ? language : "fa"; }
  setLanguage(language) { if (dictionaries[language]) this.language = language; }
  t(key) { return dictionaries[this.language][key] || key; }
  get dir() { return this.language === "fa" ? "rtl" : "ltr"; }
}
