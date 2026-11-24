# ChatGPT Manager

ابزار مدیریت گفتگوها و پروژه‌های حساب ChatGPT؛ با رابط مشترک در حالت مستقل و پنجره‌ی Tampermonkey.

[English](#overview)

## شروع سریع

### نصب با Tampermonkey

1. افزونه [Tampermonkey](https://www.tampermonkey.net/) را روی مرورگر نصب و فعال کنید.
2. [فایل ChatGPTManager.user.js را باز کنید](https://raw.githubusercontent.com/libertyir/TamperMonkeyAddOns/main/ChatGPTManager/ChatGPTManager.user.js).
3. در صفحه‌ی نصب Tampermonkey گزینه‌ی **Install** را بزنید.
4. یک تب از [ChatGPT](https://chatgpt.com/) باز کنید و وارد حساب شوید.
5. از منوی Tampermonkey گزینه‌ی **ChatGPT Manager** را انتخاب کنید.

Userscript از طریق منوی Tampermonkey پنجره‌ی Manager را روی صفحه‌ی جاری باز می‌کند. برای عملیات حساب، حداقل یک تب ChatGPT با نشست معتبر و Userscript فعال باید باز باشد.

### اجرای مستقل

[بازکردن ChatGPT Manager](https://libertyir.github.io/TamperMonkeyAddOns/ChatGPTManager/Index.html)

صفحه‌ی مستقل برای رابط و قابلیت‌های محلی قابل استفاده است. عملیات روی گفتگوها و پروژه‌های حساب به Broker فعال در تب ChatGPT نیاز دارد.

## قابلیت‌ها

- مشاهده و جست‌وجوی گفتگوها
- نمایش گفتگوهای فعال و بایگانی‌شده
- بارگذاری تدریجی گفتگوهای قدیمی‌تر هنگام اسکرول (در صورت پشتیبانی endpoint)
- عملیات گروهی مانند بایگانی، بازیابی، حذف و انتقال گفتگو
- مشاهده و مدیریت پروژه‌ها، شامل ساخت، تغییر نام و حذف
- انتخاب پروژه مقصد برای انتقال گفتگو
- نمایش وضعیت عملیات، پیشرفت و خطاها
- رابط فارسی و انگلیسی، تنظیمات زبان و پوسته
- راهنمای نصب و استفاده درون برنامه

> توجه: پشتیبانی صفحه‌بندی گفتگوها و پروژه‌ها به قرارداد endpointهای داخلی ChatGPT وابسته است. این endpointها رسمی یا پایدار/مستند نیستند و ممکن است تغییر کنند.

## معماری

- Index.html نقطه‌ی ورود نسخه‌ی مستقل است و main.js برنامه را به‌صورت ES Modules بارگذاری می‌کند.
- منطق برنامه در پوشه‌های Core، API، Modules، Storage و UI سازمان‌دهی شده است.
- ChatGPTManager.user.js فقط نقطه‌ی ورود Tampermonkey و ثبت منوی اجراست.
- TamperBundle.js نسخه‌ی کلاسیک bundle شده‌ی برنامه برای اجرای داخل sandbox خود Tampermonkey است؛ این مسیر نباید برای اجرای برنامه از Blob، eval یا تزریق کد به Page Realm استفاده کند.
- TamperBootstrap.js پنجره‌ی Dialog، Shadow DOM، ارتباط Bridge و Broker را مدیریت می‌کند.
- تب ChatGPT نقش Broker را دارد و درخواست‌های مجاز را با نشست همان تب به backend وب ChatGPT می‌فرستد.
- توکن نشست نباید در GM Storage، localStorage یا DOM ذخیره یا به Manager منتقل شود.
- ارتباط بین تب‌ها از سازوکار GM Storage و heartbeat استفاده می‌کند.
- درخواست‌های احراز هویت ناموفق (401/403) باید مسیر درخواست‌های حساب را متوقف کنند؛ توکن نباید به‌صورت خودکار بازیابی یا در ذخیره‌سازی پایدار نگهداری شود.

## ساختار مهم

| مسیر | مسئولیت |
|---|---|
| Index.html | ورودی نسخه مستقل |
| main.js | ساخت و راه‌اندازی برنامه |
| ChatGPTManager.user.js | metadata و launcher تمپرمانکی |
| TamperBootstrap.js | Dialog، Bridge و Broker |
| TamperBundle.js | bundle کلاسیک برای sandbox تمپرمانکی |
| API/ChatGPTApi.js | facade درخواست‌های API |
| Modules/Conversations/ | منطق گفتگوها |
| Modules/Projects/ | منطق پروژه‌ها |
| Core/BridgeClient.js | ارتباط UI با Bridge |
| Storage/ | تنظیمات و ذخیره‌سازی محلی |
| UI/ و Assets/ | رابط کاربری و CSS |
| PROJECT_MEMORY.md | یادداشت فنی پایدار برای ادامه‌ی توسعه |

## محدودیت‌ها و ملاحظات امنیتی

- این پروژه به API عمومی OpenAI متصل نیست؛ از endpointهای داخلی وب ChatGPT استفاده می‌کند.
- APIهای داخلی ممکن است بدون اطلاع قبلی تغییر کنند. در صورت خطای ساختار پاسخ، ابتدا پاسخ واقعی endpoint بررسی شود؛ نام فیلدهای cursor یا شکل صفحه‌بندی نباید حدس زده شود.
- Manager نباید session token یا داده‌ی حساس نشست را log کند.
- هر عملیات تغییردهنده باید خطا و نتیجه‌ی واقعی backend را به کاربر گزارش کند.
- اجرای واقعی در مرورگر، تست حساب و تست endpoint با بررسی Syntax یا سورس جایگزین نمی‌شود.

---

## Overview

ChatGPT Manager is a client-side interface for managing ChatGPT conversations and Projects. It supports a standalone page and a Tampermonkey dialog using a shared application architecture.

### Install

1. Install and enable [Tampermonkey](https://www.tampermonkey.net/).
2. Open the [ChatGPTManager.user.js installation link](https://raw.githubusercontent.com/libertyir/TamperMonkeyAddOns/main/ChatGPTManager/ChatGPTManager.user.js).
3. Click **Install** in Tampermonkey.
4. Open a signed-in [ChatGPT](https://chatgpt.com/) tab.
5. Select **ChatGPT Manager** from the Tampermonkey menu.

### Standalone

Open the [standalone Manager page](https://libertyir.github.io/TamperMonkeyAddOns/ChatGPTManager/Index.html). Account operations still require an available ChatGPT-tab broker.

### Technical notes

The standalone app uses native ES modules. Tampermonkey uses a classic bundle executed in its own sandbox. A ChatGPT tab brokers allowlisted backend requests; session tokens must remain inside that tab and must never be persisted or exposed to the Manager UI. The project relies on undocumented ChatGPT web endpoints, so endpoint response shapes and pagination behavior must be verified against live responses before changing assumptions.

For development continuity, see [PROJECT_MEMORY.md](./PROJECT_MEMORY.md).
