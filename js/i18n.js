/* =====================================================
   i18n.js — Khmer ⇄ English translator
   -----------------------------------------------------
   How it works:
   - The app is written in Khmer by default (unchanged).
   - This file walks the DOM, finds text nodes / placeholders /
     titles that match an entry in DICT (Khmer -> English),
     remembers the ORIGINAL Khmer text the first time it sees
     a node, then swaps the visible text between Khmer and
     English whenever the language is switched.
   - A MutationObserver keeps watching the app, so tables that
     get re-rendered by app.js (Stock, Stock In, Stock Out,
     Departments, Reports, Audit Log, etc.) get re-translated
     automatically — no changes needed inside app.js.
   - Add more phrases any time by adding a new line to DICT.
===================================================== */

(function () {

    // Khmer (key, exactly as it appears in the app) -> English (value)
    const DICT = {
        // ---------- Brand / sidebar ----------
        "Brochure Stock": "Brochure Stock",
        "ប្រព័ន្ធគ្រប់គ្រងស្តុក": "Stock Management System",
        "ប្រព័ន្ធគ្រប់គ្រងស្តុក Brochure": "Brochure Stock Management System",
        "MAIN MENU": "MAIN MENU",
        "SYSTEM": "SYSTEM",
        "ស្តុក Brochure": "Brochure Stock",
        "តាមឆ្នាំ": "By Year",
        "របាយការណ៍": "Reports",
        "ការកំណត់": "Settings",
        "Brochure Stock Management": "Brochure Stock Management",

        // ---------- Login ----------
        "ចូលប្រើប្រព័ន្ធ": "Sign In",
        "សូម Login ដើម្បីមើល និងគ្រប់គ្រងទិន្នន័យ": "Please log in to view and manage data",
        "អ៊ីមែល": "Email",
        "ពាក្យសម្ងាត់": "Password",
        "ភ្លេចពាក្យសម្ងាត់?": "Forgot password?",
        "ចូលប្រើ (Email)": "Sign In (Email)",
        "ចូលជាមួយ Google": "Sign in with Google",
        "ឬ": "or",
        "បង្ហាញ / លាក់ ពាក្យសម្ងាត់": "Show / hide password",

        // ---------- Topbar ----------
        "អ្នកកំពុងប្រើ": "Current user",
        "ចាកចេញ": "Log out",
        "ជូនដំណឹងស្តុកជិតអស់": "Low-stock notifications",
        "ស្តុកជិតអស់ (តិចជាង 50 ក្បាល)": "Low stock (fewer than 50 units)",
        "តិចជាង 50 ក្បាល": "fewer than 50 units",
        "គ្មានស្តុកជិតអស់ទេ 🎉": "No low stock 🎉",

        // ---------- Common table headers / buttons ----------
        "N°": "No.",
        "ល.រ": "No.",
        "រូបភាព": "Image",
        "រូបភាព Brochure": "Brochure Image",
        "សកម្មភាព": "Action",
        "ឈ្មោះ Brochure": "Brochure Name",
        "ឈ្មោះ Brochure ថ្មី": "New Brochure Name",
        "ឆ្នាំ": "Year",
        "ឆ្នាំបោះពុម្ព": "Print Year",
        "ចំនួន": "Quantity",
        "ចំនួនស្តុក": "Stock Qty",
        "ចំនួនបញ្ចូល": "Qty In",
        "ចំនួនបញ្ចូលសរុប": "Total Qty In",
        "ចំនួនយកចេញ": "Qty Out",
        "ចំនួនយកចេញសរុប": "Total Qty Out",
        "ចំនួនយកចេញសរុប (ក្បាល)": "Total Qty Out (units)",
        "ថ្ងៃបញ្ចូល": "Date In",
        "ថ្ងៃយកចេញ": "Date Out",
        "ថ្ងៃស្នើ": "Request Date",
        "ស្នើដោយ": "Requested By",
        "ចំណាំ": "Note",
        "ចំណាំ / មូលហេតុ": "Note / Reason",
        "ចំណាំ / ផ្សេងៗ": "Note / Other",
        "ផ្សេងៗ": "Other",
        "ផ្នែក": "Department",
        "ឈ្មោះផ្នែក": "Department Name",
        "ឈ្មោះបុគ្គលិក": "Employee Name",
        "ឈ្មោះអ្នកយក": "Taken By",
        "ប្រភេទ": "Type",
        "ប្រភេទ Brochure": "Brochure Type",
        "ស្ថានភាព": "Status",
        "ក្បាល": "units",
        "កែ": "Edit",
        "លុប": "Delete",
        "កែប្រែ": "Edit",
        "បង្កើត": "Create",
        "បិទ": "Close",
        "រក្សាទុក": "Save",
        "បោះបង់": "Cancel",
        "រក្សាទុក Stock Out": "Save Stock Out",
        "រក្សាទុក Stock In": "Save Stock In",
        "បញ្ចូលស្តុក": "Stock In",
        "ដកស្តុក": "Stock Out",
        "ស្នើសុំ Stock Out": "Request Stock Out",
        "បន្ថែម Stock Out": "Add Stock Out",
        "បន្ថែម Stock In": "Add Stock In",
        "បន្ថែមផ្នែក": "Add Department",
        "បន្ថែមបុគ្គលិក": "Add Employee",
        "អនុម័ត": "Approve",
        "បដិសេធ": "Reject",
        "បានអនុម័ត": "Approved",
        "បានបដិសេធ": "Rejected",
        "កំពុងរង់ចាំ": "Pending",
        "គ្រប់ស្ថានភាព": "All statuses",
        "គ្រប់សកម្មភាព": "All actions",
        "គ្រប់ប្រភេទ": "All types",
        "ប្រតិបត្តិការសរុប": "Total Transactions",
        "សំណើសរុប": "Total Requests",
        "បង្ហាញ": "Showing",
        "កំពុងផ្ទុក...": "Loading...",
        "កំពុងផ្ទុកទិន្នន័យ...": "Loading data...",
        "(ស្រេចចិត្ត)": "(optional)",
        "ស្រេចចិត្ត": "optional",

        // ---------- Search / export ----------
        "ស្វែងរក Brochure...": "Search Brochure...",
        "ស្វែងរក Stock Out...": "Search Stock Out...",
        "ស្វែងរក Stock In...": "Search Stock In...",
        "ស្វែងរកសំណើ...": "Search requests...",
        "ស្វែងរក...": "Search...",
        "Export": "Export",
        "នាំចេញទិន្នន័យស្តុក": "Export stock data",
        "នាំចេញទិន្នន័យ Stock Out": "Export Stock Out data",
        "នាំចេញទិន្នន័យ Stock In": "Export Stock In data",
        "បោះពុម្ពស្តុក": "Print Stock",
        "-- ជ្រើសរើស Brochure --": "-- Select Brochure --",
        "-- ជ្រើសរើសផ្នែក --": "-- Select Department --",
        "-- ជ្រើសរើសអ្នកយក --": "-- Select Taker --",
        "វាយឈ្មោះ Brochure ថ្មី...": "Type new Brochure name...",
        "ឆ្នាំនឹងបង្ហាញដោយស្វ័យប្រវត្តិ": "Year fills in automatically",
        "ចុចដើម្បីមើលរូប Full Size": "Click to view full size",
        "ចុចមើល Full Size": "View full size",
        "មិនទាន់មានរូបភាព": "No image yet",
        "ស្តុកជិតអស់": "Low stock",

        // ---------- Empty states ----------
        "មិនទាន់មានស្តុក": "No stock yet",
        "ចុច \"បន្ថែម\" ដើម្បីបង្កើតទិន្នន័យ": "Click \"Add\" to create data",
        "រកមិនឃើញ": "No results",
        "មិនទាន់មានទិន្នន័យ Stock Out": "No Stock Out data yet",
        "មិនទាន់មាន Stock Out": "No Stock Out yet",
        "មិនទាន់មានសំណើ": "No requests yet",
        "មិនទាន់មាន Stock In": "No Stock In yet",
        "មិនទាន់មានផ្នែក": "No departments yet",
        "ចុច \"បន្ថែមផ្នែក\" ដើម្បីបង្កើត Department។": "Click \"Add Department\" to create one.",
        "មិនទាន់មានបុគ្គលិកក្នុងផ្នែកនេះ": "No employees in this department yet",
        "មិនទាន់មាន Audit Log": "No Audit Log yet",
        "នៅពេលមានការកែ/លុប នឹងបង្ហាញនៅទីនេះ": "Edits and deletions will appear here",
        "មិនមានទិន្នន័យសម្រាប់បោះពុម្ព": "No data to print",

        // ---------- Departments page ----------
        "គ្រប់គ្រង Department និងបុគ្គលិក": "Manage Departments and Employees",
        "បញ្ចូលផ្នែក និងឈ្មោះបុគ្គលិកសម្រាប់ប្រើពេលដក Brochure": "Add departments and employee names used when taking Brochures",

        // ---------- Stock In / Out headers ----------
        "ប្រវត្តិការបញ្ចូលស្តុក (Stock In)": "Stock In History",
        "ថ្ងៃបញ្ចូល • Brochure • ឆ្នាំ • ចំនួនបញ្ចូល • ចំណាំ": "Date In • Brochure • Year • Qty In • Note",
        "គ្រប់គ្រងការដកស្តុក Brochure ចេញ និងសំណើស្នើសុំពី Staff": "Manage Brochure Stock Out and staff requests",
        "បញ្ជីស្តុក Brochure": "Brochure Stock List",
        "សូមជ្រើសរើស Brochure ដើម្បីមើលស្តុកបច្ចុប្បន្ន។": "Select a Brochure to see current stock.",
        "រូបភាពនៃ Brochure ដែលបានជ្រើស (ចុចរូបដើម្បីមើល Full Size)": "Image of the selected Brochure (click to view full size)",

        // ---------- Reports ----------
        "ចំនួន Stock Out សរុប": "Total Stock Out Qty",
        "ផ្នែកយកច្រើនបំផុត": "Top Department",
        "តាមចំនួនក្បាល": "by units taken",
        "និយោជិតយកញឹកញាប់": "Most Frequent Employee",
        "តាមចំនួនដង + ក្បាល": "by count + units",
        "ល.រ": "No.",
        "មុខទំនិញសរុប៖": "Total items:",
        "ចំនួនក្បាលសរុប៖": "Total units:",
        "ប្រព័ន្ធ៖": "System:",
        "អ្នករៀបចំ (Prepared By)": "Prepared By",
        "អ្នកពិនិត្យ (Approved By)": "Approved By",
        "របាយការណ៍ស្តុក BROCHURE": "BROCHURE STOCK REPORT",
        "កាលបរិច្ឆេទបោះពុម្ព៖": "Print date:",
        "ម៉ោង៖": "Time:",

        // ---------- Audit Log ----------
        "Audit Log — ប្រវត្តិសកម្មភាព": "Audit Log — Activity History",
        "ពេលវេលា": "Time",
        "អ្នកប្រើ": "User",
        "ឈ្មោះ / វត្ថុ": "Name / Item",
        "ព័ត៌មានលម្អិត": "Details",

        // ---------- Settings ----------
        "កម្រិតស្តុកជិតអស់": "Low-stock threshold",
        "បើចំនួនស្តុកតិចជាងលេខនេះ → Alert + ផ្ញើ email": "If stock is below this number → Alert + send email",
        "Email Admin (ជូនដំណឹងស្តុក)": "Admin Email (stock alerts)",
        "អនុញ្ញាតឲ្យកម្មវិធីជូនដំណឹងនៅលើកុំព្យូទ័រ/ទូរសព្ទ": "Allow browser/device notifications",
        "Backup ទិន្នន័យ (JSON)": "Backup data (JSON)",
        "ឧ. សុខ ដារ៉ា": "e.g. Sok Dara",
    };

    // Reverse dictionary (English -> Khmer) built automatically
    const REV = {};
    Object.keys(DICT).forEach(km => { REV[DICT[km]] = km; });

    // Page titles used by app.js (goPage). Exposed globally so app.js
    // (or this file) can look up the right title in the active language.
    window.PAGE_TITLES = {
        dashboard: { km: "Dashboard", en: "Dashboard" },
        stock: { km: "ស្តុក Brochure", en: "Brochure Stock" },
        stockout: { km: "Stock Out", en: "Stock Out" },
        stockin: { km: "Stock In", en: "Stock In" },
        departments: { km: "Department", en: "Department" },
        years: { km: "តាមឆ្នាំ", en: "By Year" },
        reports: { km: "របាយការណ៍", en: "Reports" },
        audit: { km: "Audit Log", en: "Audit Log" },
        settings: { km: "ការកំណត់", en: "Settings" }
    };

    let currentLang = localStorage.getItem("appLang") || "km";
    const origTextMap = new WeakMap();   // text node -> original km text
    const origAttrMap = new WeakMap();   // element -> {placeholder, title}
    let translating = false;

    function translateOne(km) {
        if (currentLang === "en" && DICT[km]) return DICT[km];
        return km; // km, or no translation available -> leave as-is
    }

    function walkTextNodes(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                const p = node.parentElement;
                if (!p) return NodeFilter.FILTER_REJECT;
                if (p.closest("script,style,textarea")) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        const nodes = [];
        let n;
        while ((n = walker.nextNode())) nodes.push(n);
        return nodes;
    }

    function applyToRoot(root) {
        // Text nodes
        walkTextNodes(root).forEach(node => {
            const raw = node.nodeValue;
            const trimmed = raw.trim();
            if (!trimmed) return;

            let original = origTextMap.get(node);
            if (original === undefined) {
                // First time seeing this node: figure out its "true" Khmer original,
                // even if the DOM currently shows English (e.g. re-render happened
                // while lang=en).
                original = REV[trimmed] || trimmed;
                origTextMap.set(node, original);
            }

            if (!DICT[original]) return; // nothing to translate, leave untouched

            const translated = currentLang === "en" ? DICT[original] : original;
            // preserve surrounding whitespace
            const leading = raw.match(/^\s*/)[0];
            const trailing = raw.match(/\s*$/)[0];
            const next = leading + translated + trailing;
            if (node.nodeValue !== next) node.nodeValue = next;
        });

        // placeholder / title attributes
        root.querySelectorAll("[placeholder],[title]").forEach(el => {
            let cache = origAttrMap.get(el);
            if (!cache) {
                cache = {
                    placeholder: el.hasAttribute("placeholder")
                        ? (REV[el.getAttribute("placeholder")] || el.getAttribute("placeholder"))
                        : null,
                    title: el.hasAttribute("title")
                        ? (REV[el.getAttribute("title")] || el.getAttribute("title"))
                        : null
                };
                origAttrMap.set(el, cache);
            }
            if (cache.placeholder && DICT[cache.placeholder]) {
                el.setAttribute("placeholder", currentLang === "en" ? DICT[cache.placeholder] : cache.placeholder);
            }
            if (cache.title && DICT[cache.title]) {
                el.setAttribute("title", currentLang === "en" ? DICT[cache.title] : cache.title);
            }
        });
    }

    function applyLanguage() {
        translating = true;
        try {
            applyToRoot(document.body);
        } finally {
            translating = false;
        }
        document.documentElement.setAttribute("lang", currentLang);
        const btn = document.getElementById("langToggleBtn");
        if (btn) {
            btn.querySelector(".lang-code").textContent = currentLang === "km" ? "EN" : "ខ្មែរ";
            btn.title = currentLang === "km" ? "Switch to English" : "ប្តូរទៅភាសាខ្មែរ";
        }
        // Keep the page title (set by app.js's goPage) in sync with the language
        const activeMenu = document.querySelector(".menu-item.active");
        const pageTitleEl = document.getElementById("pageTitle");
        if (activeMenu && pageTitleEl && window.PAGE_TITLES) {
            const key = activeMenu.dataset.page;
            const cfg = window.PAGE_TITLES[key];
            if (cfg) pageTitleEl.textContent = cfg[currentLang] || cfg.km;
        }
    }

    function setLanguage(lang) {
        currentLang = lang === "en" ? "en" : "km";
        localStorage.setItem("appLang", currentLang);
        applyLanguage();
    }

    function toggleLanguage() {
        setLanguage(currentLang === "km" ? "en" : "km");
    }

    // Re-translate automatically whenever app.js re-renders a table/page
    function startObserver() {
        const target = document.getElementById("appRoot") || document.body;
        const observer = new MutationObserver(muts => {
            if (translating) return;
            // Debounce a tick so a whole render batch is captured at once
            clearTimeout(startObserver._t);
            startObserver._t = setTimeout(applyLanguage, 0);
        });
        observer.observe(target, { childList: true, subtree: true, characterData: true });
    }

    window.i18n = { setLanguage, toggleLanguage, getLanguage: () => currentLang };

    document.addEventListener("DOMContentLoaded", () => {
        applyLanguage();
        startObserver();
    });
})();