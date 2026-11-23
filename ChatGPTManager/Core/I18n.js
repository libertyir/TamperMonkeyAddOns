const dictionaries = {
  fa: {
    chats:"گفتگوها", projects:"پروژه‌ها", archive:"بایگانی", settings:"تنظیمات",
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
    connected:"متصل به نشست ChatGPT", preview:"پیش‌نمایش مستقل", bridgeOffline:"پل Tampermonkey متصل نیست", accountAuthenticated:"حساب ChatGPT وارد شده", accountUnauthenticated:"ورود به ChatGPT لازم است", language:"زبان",
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
    chats:"Conversations", projects:"Projects", archive:"Archive", settings:"Settings",
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
    connected:"Connected to ChatGPT session", preview:"Standalone preview", bridgeOffline:"Tampermonkey bridge unavailable", accountAuthenticated:"ChatGPT account authenticated", accountUnauthenticated:"ChatGPT sign-in required", language:"Language",
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
