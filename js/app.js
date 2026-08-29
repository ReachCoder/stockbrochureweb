/* =====================================================
   FIREBASE CONFIG
===================================================== */

const firebaseConfig = {

    apiKey:
    "AIzaSyD8nzoqs1dqZHc7lrA_FBAVk_1T9gITeAE",

    authDomain:
    "dareach-1ce50.firebaseapp.com",

    projectId:
    "dareach-1ce50",

    storageBucket:
    "dareach-1ce50.firebasestorage.app",

    messagingSenderId:
    "676314588384",

    appId:
    "1:676314588384:web:052ce88f6f2a920f1dc85",

    measurementId:
    "G-XP3M1KH8GE"
};


firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();

const COLLECTION = "brochureItems";
const USERS_COLLECTION = "users";

/* =====================================================
   AUTH STATE
===================================================== */
let currentUser = null;          // Firebase User
let currentUserProfile = null;   // { role, displayName, email, ... }
let authReady = false;
let dataListenersStarted = false;

function isAdmin(){
    return currentUserProfile?.role === "admin";
}
function isStaff(){
    return currentUserProfile?.role === "staff";
}
function requireAdmin(actionLabel){
    if(!isAdmin()){
        alert("អ្នកមិនមានសិទ្ធិ" + (actionLabel ? " " + actionLabel : "") + "។\nត្រូវការ role Admin។");
        return false;
    }
    return true;
}

function showLoginError(msg, isOk){
    const el = document.getElementById("loginErr");
    if(!el) return;
    if(msg){
        el.textContent = msg;
        el.classList.add("show");
        el.classList.toggle("ok", !!isOk);
    }else{
        el.textContent = "";
        el.classList.remove("show", "ok");
    }
}

function toggleLoginPassword(){
    const input = document.getElementById("loginPassword");
    const icon = document.getElementById("passwordToggleIcon");
    if(!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    if(icon){
        icon.classList.toggle("fa-eye", !show);
        icon.classList.toggle("fa-eye-slash", show);
    }
}

async function forgotPassword(){
    showLoginError("");
    const email = document.getElementById("loginEmail")?.value.trim();
    if(!email){
        showLoginError("សូមបញ្ចូលអ៊ីមែលជាមុន រួចចុច «ភ្លេចពាក្យសម្ងាត់?» ម្តងទៀត។");
        document.getElementById("loginEmail")?.focus();
        return;
    }
    const btn = document.getElementById("btnForgotPassword");
    if(btn){ btn.disabled = true; btn.textContent = "កំពុងផ្ញើ..."; }
    try{
        await auth.sendPasswordResetEmail(email);
        showLoginError("បានផ្ញើតំណកំណត់ពាក្យសម្ងាត់ថ្មីទៅ " + email + "។ សូមពិនិត្យ Inbox / Spam។", true);
    }catch(e){
        console.error(e);
        const code = e.code || "";
        if(code === "auth/user-not-found" || code === "auth/invalid-credential"){
            showLoginError("រកមិនឃើញគណនីជាមួយអ៊ីមែលនេះ។");
        }else if(code === "auth/invalid-email"){
            showLoginError("ទម្រង់អ៊ីមែលមិនត្រឹមត្រូវ។");
        }else if(code === "auth/too-many-requests"){
            showLoginError("ព្យាយាមច្រើនពេក។ សូមរង់ចាំបន្តិច។");
        }else{
            showLoginError("មិនអាចផ្ញើបានទេ៖ " + (e.message || code));
        }
    }finally{
        if(btn){ btn.disabled = false; btn.textContent = "ភ្លេចពាក្យសម្ងាត់?"; }
    }
}

function setLoginLoading(loading){
    const b1 = document.getElementById("btnLoginEmail");
    const b2 = document.getElementById("btnLoginGoogle");
    if(b1){ b1.disabled = !!loading; b1.innerHTML = loading ? '<i class="fa-solid fa-spinner fa-spin"></i> កំពុងចូល...' : '<i class="fa-solid fa-right-to-bracket"></i> ចូលប្រើ (Email)'; }
    if(b2){ b2.disabled = !!loading; }
}

async function ensureUserProfile(user){
    const ref = db.collection(USERS_COLLECTION).doc(user.uid);
    const snap = await ref.get();
    if(snap.exists){
        return { id: user.uid, ...snap.data() };
    }
    // អ្នកប្រើថ្មី — បង្កើតជា staff (Admin ត្រូវកែ role ក្នុង Firestore)
    const profile = {
        email: user.email || "",
        displayName: user.displayName || (user.email ? user.email.split("@")[0] : "User"),
        role: "staff",
        createdAt: Date.now()
    };
    try{
        await ref.set(profile, { merge: true });
    }catch(e){
        console.warn("Could not create user profile (check Firestore rules):", e);
        // បើ rules មិនអនុញ្ញាត នៅតែប្រើ profile មូលដ្ឋានក្នុង memory
    }
    return { id: user.uid, ...profile };
}

function applyRoleUI(){
    document.body.classList.toggle("role-staff", isStaff());
    document.body.classList.toggle("role-admin", isAdmin());

    const badge = document.getElementById("userRoleBadge");
    const nameEl = document.getElementById("userChipName");
    if(nameEl){
        nameEl.textContent = currentUserProfile?.displayName
            || currentUser?.displayName
            || currentUser?.email
            || "—";
    }
    if(badge){
        const role = currentUserProfile?.role || "staff";
        badge.textContent = role === "admin" ? "Admin" : "Staff";
        badge.className = "role-badge " + (role === "admin" ? "admin" : "staff");
    }

    // sync operator name for audit
    const opName = currentUserProfile?.displayName
        || currentUser?.displayName
        || currentUser?.email
        || "";
    if(opName){
        try{ localStorage.setItem("operatorName", opName); }catch(_){}
        const opInput = document.getElementById("operatorNameInput");
        if(opInput && !opInput.value) opInput.value = opName;
    }
}

function showApp(){
    document.getElementById("loginScreen")?.classList.add("hidden");
    document.getElementById("appRoot")?.classList.remove("auth-locked");
}

function showLogin(){
    document.getElementById("loginScreen")?.classList.remove("hidden");
    document.getElementById("appRoot")?.classList.add("auth-locked");
}

async function loginWithEmail(){
    showLoginError("");
    const email = document.getElementById("loginEmail")?.value.trim();
    const password = document.getElementById("loginPassword")?.value || "";
    if(!email || !password){
        showLoginError("សូមបញ្ចូលអ៊ីមែល និងពាក្យសម្ងាត់។");
        return;
    }
    setLoginLoading(true);
    try{
        await auth.signInWithEmailAndPassword(email, password);
    }catch(e){
        console.error(e);
        const code = e.code || "";
        if(code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found"){
            showLoginError("អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ។");
        }else if(code === "auth/too-many-requests"){
            showLoginError("ព្យាយាមច្រើនពេក។ សូមរង់ចាំបន្តិច។");
        }else if(code === "auth/invalid-email"){
            showLoginError("ទម្រង់អ៊ីមែលមិនត្រឹមត្រូវ។");
        }else{
            showLoginError("Login មិនជោគជ័យ៖ " + (e.message || code));
        }
        setLoginLoading(false);
    }
}

async function loginWithGoogle(){
    showLoginError("");
    setLoginLoading(true);
    try{
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
    }catch(e){
        console.error(e);
        if(e.code === "auth/popup-closed-by-user"){
            showLoginError("បានបិទหน้าต่าง Google Login។");
        }else if(e.code === "auth/unauthorized-domain"){
            showLoginError("Domain នេះមិនទាន់អនុញ្ញាតក្នុង Firebase Auth។ សូមបន្ថែម domain ក្នុង Firebase Console។");
        }else{
            showLoginError("Google Login មិនជោគជ័យ៖ " + (e.message || e.code || ""));
        }
        setLoginLoading(false);
    }
}

async function logoutUser(){
    try{
        await auth.signOut();
    }catch(e){
        console.error(e);
        alert("មិនអាចចាកចេញបានទេ។");
    }
}

function startDataListenersOnce(){
    if(dataListenersStarted) return;
    dataListenersStarted = true;

    // Listen ភ្លាមៗ (ត្រូវការ Dashboard + badge)
    listenItems();
    listenDepartments();
    listenStockOutRequests();   // សម្រាប់ badge

    // ទុក Stock Out / Stock In / Audit ឲ្យ listen ពេលចូល page
}

function stopDataListeners() {

    console.log("Stopping Firebase listeners...");

    if (_unsubItems) {
        _unsubItems();
        _unsubItems = null;
    }

    if (_unsubDepartments) {
        _unsubDepartments();
        _unsubDepartments = null;
    }

    if (window._unsubStockOutRequests) {
        window._unsubStockOutRequests();
        window._unsubStockOutRequests = null;
    }
    if (_unsubStockOuts) {
        _unsubStockOuts();
        _unsubStockOuts = null;
    }
    if (_unsubStockIns) {
        _unsubStockIns();
        _unsubStockIns = null;
    }
    if (_unsubAuditLogs) {
        _unsubAuditLogs();
        _unsubAuditLogs = null;
    }

    // Reset page listener flags
    window._stockOutsListening = false;
    window._stockInsListening = false;
    window._auditListening = false;

    dataListenersStarted = false;

    console.log("All Firebase listeners stopped.");
}

function initAuth(){
    document.getElementById("btnLoginEmail")?.addEventListener("click", loginWithEmail);
    document.getElementById("btnLoginGoogle")?.addEventListener("click", loginWithGoogle);
    document.getElementById("btnTogglePassword")?.addEventListener("click", toggleLoginPassword);
    document.getElementById("btnForgotPassword")?.addEventListener("click", forgotPassword);
    document.getElementById("logoutBtn")?.addEventListener("click", () => {
        if(confirm("តើអ្នកចង់ចាកចេញពីប្រព័ន្ធមែនទេ?")) logoutUser();
    });
    document.getElementById("loginPassword")?.addEventListener("keydown", e => {
        if(e.key === "Enter") loginWithEmail();
    });
    document.getElementById("loginEmail")?.addEventListener("keydown", e => {
        if(e.key === "Enter") document.getElementById("loginPassword")?.focus();
    });

    auth.onAuthStateChanged(async (user) => {
        authReady = true;
        if(!user){

            // IMPORTANT: unsubscribe Firestore listeners
            stopDataListeners();

            currentUser = null;
            currentUserProfile = null;

            document.body.classList.remove(
                "role-staff",
                "role-admin"
            );

            showLogin();
            setLoginLoading(false);

            return;
        }
        currentUser = user;
        try{
            currentUserProfile = await ensureUserProfile(user);
        }catch(e){
            console.error(e);
            currentUserProfile = {
                id: user.uid,
                email: user.email || "",
                displayName: user.displayName || user.email || "User",
                role: "staff"
            };
        }
        applyRoleUI();
        showApp();
        setLoginLoading(false);
        startDataListenersOnce();
    });
}

/* =====================================================
   GLOBAL
===================================================== */

let items = [];

let editingId = null;

let yearChart = null;

let pieChart = null;

let departments = [];
let stockOuts = [];
let stockOutEditingId = null;
let stockOutModalMode = "direct"; // "direct" | "request"
let stockOutRequests = [];
let stockOutActiveTab = "transactions"; // "transactions" | "requests"
let stockIns = [];
let stockInEditingId = null;
let siMode = "existing";
const DEFAULT_LOW_STOCK_THRESHOLD = 50;
function getLowStockThreshold(){
    const n = Number(localStorage.getItem("lowStockThreshold"));
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_LOW_STOCK_THRESHOLD;
}
let LOW_STOCK_THRESHOLD = getLowStockThreshold();
let departmentModalMode = "department";
let lowStockNotifyBusy = false;

/* Sort + Pagination state */
const tableState = {
    stock:    { sortKey: "name", sortDir: "asc",  page: 1, pageSize: 25 },
    stockOut: { sortKey: "date", sortDir: "desc", page: 1, pageSize: 20 },
    stockIn:  { sortKey: "date", sortDir: "desc", page: 1, pageSize: 20 },
    stockOutRequests: { sortKey: "requestedAt", sortDir: "desc", page: 1, pageSize: 20 }
};

function sortList(list, key, dir, type){
    const m = dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
        let va = a[key];
        let vb = b[key];
        if(type === "number" || key === "unit" || key === "quantity"){
            return (Number(va || 0) - Number(vb || 0)) * m;
        }
        if(key === "year"){
            const ya = Number(extractYear(va) || va || 0);
            const yb = Number(extractYear(vb) || vb || 0);
            return (ya - yb) * m;
        }
        if(key === "date"){
            return String(va || "").localeCompare(String(vb || "")) * m;
        }
        return String(va || "").localeCompare(String(vb || ""), "km") * m;
    });
}

function paginateList(list, page, pageSize){
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
    const p = Math.min(Math.max(1, page), pages);
    const start = (p - 1) * pageSize;
    return {
        page: p,
        pages,
        total,
        start,
        end: Math.min(start + pageSize, total),
        slice: list.slice(start, start + pageSize)
    };
}

function sortHeaderHtml(table, key, label){
    const st = tableState[table];
    const active = st.sortKey === key;
    const icon = !active ? "fa-sort" : (st.sortDir === "asc" ? "fa-sort-up" : "fa-sort-down");
    return `<th class="sortable ${active ? "active" : ""}" onclick="setTableSort('${table}','${key}')">${label}<i class="fa-solid ${icon} sort-icon"></i></th>`;
}

function setTableSort(table, key){
    const st = tableState[table];
    if(!st) return;
    if(st.sortKey === key){
        st.sortDir = st.sortDir === "asc" ? "desc" : "asc";
    }else{
        st.sortKey = key;
        st.sortDir = (key === "date" || key === "unit" || key === "quantity" || key === "requestedAt") ? "desc" : "asc";
    }
    st.page = 1;
    if(table === "stock") renderStock();
    else if(table === "stockOut") renderStockOut();
    else if(table === "stockIn") renderStockIn();
    else if(table === "stockOutRequests") renderStockOutRequests();
}

function setTablePage(table, page){
    const st = tableState[table];
    if(!st) return;
    st.page = page;
    if(table === "stock") renderStock();
    else if(table === "stockOut") renderStockOut();
    else if(table === "stockIn") renderStockIn();
    else if(table === "stockOutRequests") renderStockOutRequests();
}

function setTablePageSize(table, size){
    const st = tableState[table];
    if(!st) return;
    st.pageSize = Number(size) || 20;
    st.page = 1;
    if(table === "stock") renderStock();
    else if(table === "stockOut") renderStockOut();
    else if(table === "stockIn") renderStockIn();
    else if(table === "stockOutRequests") renderStockOutRequests();
}

function buildPagerHtml(table, pg){
    const st = tableState[table];
    const pages = pg.pages;
    let buttons = "";
    const windowSize = 5;
    let startP = Math.max(1, pg.page - 2);
    let endP = Math.min(pages, startP + windowSize - 1);
    startP = Math.max(1, endP - windowSize + 1);

    buttons += `<button type="button" class="pager-btn" ${pg.page <= 1 ? "disabled" : ""} onclick="setTablePage('${table}',${pg.page - 1})"><i class="fa-solid fa-chevron-left"></i></button>`;
    for(let i = startP; i <= endP; i++){
        buttons += `<button type="button" class="pager-btn ${i === pg.page ? "active" : ""}" onclick="setTablePage('${table}',${i})">${i}</button>`;
    }
    buttons += `<button type="button" class="pager-btn" ${pg.page >= pages ? "disabled" : ""} onclick="setTablePage('${table}',${pg.page + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;

    const from = pg.total ? pg.start + 1 : 0;
    const to = pg.end;
    return `
        <div class="pager">
            <div class="pager-info">
                បង្ហាញ ${from.toLocaleString()}–${to.toLocaleString()} / ${pg.total.toLocaleString()}
            </div>
            <div class="pager-controls">
                <select onchange="setTablePageSize('${table}', this.value)">
                    ${[10,20,25,50,100].map(n => `<option value="${n}" ${st.pageSize === n ? "selected" : ""}>${n} / ទំព័រ</option>`).join("")}
                </select>
                ${buttons}
            </div>
        </div>
    `;
}


/* =====================================================
   PAGE NAVIGATION
===================================================== */

const menuItems =
document.querySelectorAll(".menu-item");

const pages =
document.querySelectorAll(".page");

const pageTitle =
document.getElementById("pageTitle");


const titles = {

    dashboard:"Dashboard",

    stock:"ស្តុក Brochure",
    stockout:"Stock Out",
    stockin:"Stock In",
    departments:"Department",

    years:"តាមឆ្នាំ",

    reports:"របាយការណ៍",

    audit:"Audit Log",

    settings:"ការកំណត់"

};


function goPage(page){

    pages.forEach(p => {

        p.classList.remove("active");

    });


    menuItems.forEach(m => {

        m.classList.remove("active");

    });


    document.getElementById(page)
        .classList.add("active");


    const menu =
        document.querySelector(
            `.menu-item[data-page="${page}"]`
        );


    if(menu){

        menu.classList.add("active");

    }


    pageTitle.textContent =
        titles[page];


    if(typeof setSidebarOpen === "function"){
        setSidebarOpen(false);
    }else{
        document.getElementById("sidebar")?.classList.remove("open");
        document.getElementById("sidebarBackdrop")?.classList.remove("show");
    }


    if(page === "dashboard"){

        updateDashboard();

    }

    if(page === "stockout"){
    if(!window._stockOutsListening){
        listenStockOuts();
        window._stockOutsListening = true;
    }
    renderStockOut();
    }
    if(page === "stockin"){
        if(!window._stockInsListening){
            listenStockIns();
            window._stockInsListening = true;
        }
        renderStockIn();
    }
    if(page === "audit"){
        if(!window._auditListening){
            listenAuditLogs();
            window._auditListening = true;
        }
        renderAuditLog();
    }

}


menuItems.forEach(item => {

    item.addEventListener("click", () => {

        goPage(item.dataset.page);

    });

});


/* =====================================================
   MOBILE SIDEBAR
===================================================== */

function setSidebarOpen(open){
    const side = document.getElementById("sidebar");
    const back = document.getElementById("sidebarBackdrop");
    if(!side) return;
    side.classList.toggle("open", !!open);
    if(back){
        back.classList.toggle("show", !!open);
        back.setAttribute("aria-hidden", open ? "false" : "true");
    }
    document.body.style.overflow = open ? "hidden" : "";
}

document.getElementById("mobileMenu")?.addEventListener("click", () => {
    const side = document.getElementById("sidebar");
    setSidebarOpen(!side?.classList.contains("open"));
});

document.getElementById("sidebarBackdrop")?.addEventListener("click", () => {
    setSidebarOpen(false);
});

/* បិទ sidebar ពេលជ្រើសម៉ឺនុយ — goPage ក៏បិទរួច */


/* =====================================================
   DARK MODE
===================================================== */

const darkModeBtn =
document.getElementById("darkModeBtn");

const darkSwitch =
document.getElementById("darkSwitch");


function setDarkMode(enabled){

    document.body.classList.toggle(
        "dark",
        enabled
    );


    darkSwitch.checked = enabled;


    localStorage.setItem(
        "darkMode",
        enabled ? "1" : "0"
    );


    darkModeBtn.innerHTML =
        enabled

        ? `<i class="fa-solid fa-sun"></i>`

        : `<i class="fa-solid fa-moon"></i>`;


    setTimeout(() => {

        updateCharts();

    },100);

}


const savedDark =
localStorage.getItem("darkMode") === "1";


setDarkMode(savedDark);


darkModeBtn.addEventListener("click", () => {

    setDarkMode(
        !document.body.classList.contains("dark")
    );

});


darkSwitch.addEventListener("change", e => {

    setDarkMode(e.target.checked);

});


/* =====================================================
   YEAR EXTRACTION
===================================================== */

function extractYear(value){

    const match =
        String(value || "")
        .match(/\d{4}/);

    return match
        ? parseInt(match[0])
        : 0;

}


/* =====================================================
   FIREBASE LISTENER
===================================================== */

let _unsubItems = null;

function listenItems() {

    // Stop previous listener
    if (_unsubItems) {
        _unsubItems();
        _unsubItems = null;
    }

    console.log("Starting Items listener...");

    _unsubItems = db.collection(COLLECTION)
        .orderBy("createdAt", "asc")
        .limit(500)
        .onSnapshot(snapshot => {

            items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            renderStock();
            updateDashboard();
            renderYears();
            updateReports();
            populateStockOutBrochures();
            populateStockInBrochures();
            updateLowStockAlerts();

        }, error => {

            console.error("Items listener error:", error);

        });
}


/* =====================================================
   DEPARTMENTS + STOCK OUT LISTENERS
===================================================== */
let _unsubDepartments = null;

function listenDepartments() {

    // Stop previous listener
    if (_unsubDepartments) {
        _unsubDepartments();
        _unsubDepartments = null;
    }

    console.log("Starting Departments listener...");

    _unsubDepartments = db.collection("departments")
        .orderBy("createdAt", "asc")
        .limit(200)
        .onSnapshot(snapshot => {

            departments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            renderDepartments();
            populateDepartmentSelects();

        }, error => {

            console.error(
                "Department listener error:",
                error
            );

        });
}
let _unsubStockOuts = null;

function listenStockOuts() {

    if (_unsubStockOuts) {
        _unsubStockOuts();
        _unsubStockOuts = null;
    }

    _unsubStockOuts = db.collection("stockOuts")
        .orderBy("createdAt", "desc")
        .limit(200)
        .onSnapshot(snapshot => {

            stockOuts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            renderStockOut();

            if (
                document
                    .getElementById("reports")
                    ?.classList.contains("active")
            ) {
                updateReports();
            }

        }, error => {
            console.error(
                "Stock Out listener error:",
                error
            );
        });
}
function listenStockOutRequests() {

    // Remove previous listener first
    if (window._unsubStockOutRequests) {
        window._unsubStockOutRequests();
        window._unsubStockOutRequests = null;
    }

    console.log("Starting Stock Out Requests listener...");

    window._unsubStockOutRequests =
        db.collection("stockOutRequests")
          .where("status", "==", "pending")
          .orderBy("requestedAt", "desc")
          .limit(50)
          .onSnapshot(

            snapshot => {

                stockOutRequests = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                console.log(
                    "Stock Out Requests:",
                    stockOutRequests.length
                );

                updateStockOutRequestBadges();

                if (
                    document
                        .getElementById("stockout")
                        ?.classList
                        .contains("active") &&
                    stockOutActiveTab === "requests"
                ) {
                    renderStockOutRequests();
                }
            },

            error => {

                console.error(
                    "Stock Out Requests listener error:",
                    error
                );

                // Firebase quota exceeded
                if (
                    error.code === "resource-exhausted" ||
                    error.code === "quota-exceeded"
                ) {
                    console.error(
                        "Firestore quota exceeded. Stop realtime listener."
                    );

                    // IMPORTANT:
                    // Stop retrying this listener
                    if (window._unsubStockOutRequests) {
                        window._unsubStockOutRequests();
                        window._unsubStockOutRequests = null;
                    }

                    return;
                }

                // Missing composite index
                if (error.code === "failed-precondition") {

                    console.warn(
                        "Firestore composite index is required."
                    );

                    return;
                }

                console.error(
                    "Unknown Firestore error:",
                    error.code,
                    error.message
                );
            }
          );
}
function updateStockOutRequestBadges(){
    const pendingAll = stockOutRequests.filter(r=>r.status==="pending").length;
    const pendingMine = stockOutRequests.filter(r=>r.status==="pending" && r.requestedByUid===currentUser?.uid).length;
    const count = isAdmin() ? pendingAll : pendingMine;
    const label = count>99 ? "99+" : String(count);

    const menuBadge = document.getElementById("stockOutMenuBadge");
    if(menuBadge){
        menuBadge.textContent = label;
        menuBadge.style.display = count>0 ? "flex" : "none";
    }
    const tabBadge = document.getElementById("stockOutRequestsTabBadge");
    if(tabBadge){
        tabBadge.textContent = label;
        tabBadge.style.display = count>0 ? "inline-flex" : "none";
    }
}
let _unsubStockIns = null;
function listenStockIns(){
    if (_unsubStockIns) {
        _unsubStockIns();
        _unsubStockIns = null;
    }
    _unsubStockIns = db.collection("stockIns")
      .orderBy("createdAt","desc")
      .limit(200)
      .onSnapshot(snapshot=>{
          stockIns=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
          renderStockIn();
      },error=>console.error("Stock In listener error:",error));
}


/* =====================================================
   ADD
===================================================== */

async function addItem(data){

    try{

        await db
            .collection(COLLECTION)
            .add({

                ...data,

                createdAt:
                    Date.now()

            });

    }catch(error){

        console.error(error);

        alert(
            "មិនអាចរក្សាទុកទិន្នន័យបានទេ"
        );

    }

}


/* =====================================================
   UPDATE
===================================================== */

async function updateItem(id,data){

    try{

        await db
            .collection(COLLECTION)
            .doc(id)
            .update(data);

    }catch(error){

        console.error(error);

        alert(
            "មិនអាចកែប្រែទិន្នន័យបានទេ"
        );

    }

}


/* =====================================================
   DELETE
===================================================== */

async function deleteItem(id){

    if(!requireAdmin("លុប Brochure")) return;

    const item =
        items.find(x => x.id === id);


    if(!item) return;


    const ok =
        confirm(
            `តើអ្នកចង់លុប "${item.name}" មែនទេ?`
        );


    if(!ok) return;


    try{

        await db
            .collection(COLLECTION)
            .doc(id)
            .delete();

        await writeAuditLog({
            action: "delete",
            entity: "brochure",
            entityId: id,
            entityName: item.name,
            details: `លុប Brochure | ឆ្នាំ ${item.year || ""} | ស្តុកដែលមាន ${Number(item.unit||0).toLocaleString()} ក្បាល`
        });

    }catch(error){

        console.error(error);

        alert(
            "មិនអាចលុបទិន្នន័យបានទេ"
        );

    }

}


/* =====================================================
   MODAL
===================================================== */

function openModal(item=null){

    if(!requireAdmin(item ? "កែ Brochure" : "បន្ថែម Brochure")) return;

    editingId =
        item ? item.id : null;


    document.getElementById(
        "modalTitle"
    ).textContent =
        item
        ? "កែប្រែធាតុ"
        : "បន្ថែមធាតុថ្មី";


    document.getElementById("fName").value =
        item?.name || "";


    document.getElementById("fYear").value =
        item?.year || "";


    document.getElementById("fUnit").value =
        item?.unit ?? "";


    document.getElementById("fImage").value = "";

    const imagePreview =
        document.getElementById("imagePreview");

    if(item?.image){
        imagePreview.src = item.image;
        imagePreview.style.display = "block";
    }else{
        imagePreview.removeAttribute("src");
        imagePreview.style.display = "none";
    }


    document.getElementById("fOther").value =
        item?.other || "";


    document
        .getElementById("formErr")
        .classList.remove("show");


    document
        .getElementById("overlay")
        .classList.add("show");


    setTimeout(() => {

        document
            .getElementById("fName")
            .focus();

    },200);

}


function closeModal(){

    document
        .getElementById("overlay")
        .classList.remove("show");

    editingId = null;

}


/* =====================================================
   IMAGE HELPERS — CLOUDINARY UPLOAD
===================================================== */

const CLOUDINARY_CLOUD_NAME = "vjzwnmb6";
const CLOUDINARY_UPLOAD_PRESET = "my_images_brochures";
const CLOUDINARY_UPLOAD_URL =
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;


// បង្រួមទំហំរូបភាពនៅលើ browser មុននឹង upload ទៅ Cloudinary
// (ជួយឲ្យ upload លឿន និងសន្សំ bandwidth)
function resizeImageToBlob(file){

    return new Promise((resolve,reject) => {

        if(!file){
            resolve(null);
            return;
        }

        if(!file.type.startsWith("image/")){
            reject(new Error("INVALID_IMAGE"));
            return;
        }

        const reader = new FileReader();

        reader.onload = event => {

            const img = new Image();

            img.onload = () => {

                const maxSize = 1000;
                let width = img.width;
                let height = img.height;

                if(width > maxSize || height > maxSize){
                    const ratio = Math.min(
                        maxSize / width,
                        maxSize / height
                    );
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img,0,0,width,height);

                canvas.toBlob(
                    blob => {

                        if(!blob){
                            reject(new Error("IMAGE_COMPRESS_ERROR"));
                            return;
                        }

                        resolve(blob);

                    },
                    "image/jpeg",
                    0.85
                );

            };

            img.onerror = () => reject(new Error("IMAGE_LOAD_ERROR"));
            img.src = event.target.result;

        };

        reader.onerror = () => reject(new Error("IMAGE_READ_ERROR"));
        reader.readAsDataURL(file);

    });
}


// Upload រូបភាពទៅ Cloudinary ហើយត្រឡប់ជា secure_url
// (URL នេះទេ ដែលនឹងត្រូវរក្សាទុកក្នុង Firestore មិនមែន base64)
async function uploadImageToCloudinary(file){

    if(!file){
        return null;
    }

    const blob = await resizeImageToBlob(file);

    const formData = new FormData();
    formData.append("file", blob, file.name || "brochure.jpg");
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    let response;

    try{
        response = await fetch(CLOUDINARY_UPLOAD_URL, {
            method:"POST",
            body:formData
        });
    }catch(error){
        console.error(error);
        throw new Error("UPLOAD_NETWORK_ERROR");
    }

    if(!response.ok){
        throw new Error("UPLOAD_FAILED");
    }

    const data = await response.json();

    if(!data.secure_url){
        throw new Error("UPLOAD_FAILED");
    }

    return data.secure_url;

}


/* =====================================================
   SAVE FORM
===================================================== */

async function saveForm(){

    if(!requireAdmin("រក្សាទុក Brochure")) return;

    const name =
        document
        .getElementById("fName")
        .value.trim();

    const year =
        document
        .getElementById("fYear")
        .value.trim();

    const unitRaw =
        document
        .getElementById("fUnit")
        .value
        .trim()
        .replace(/,/g,"");

    const other =
        document
        .getElementById("fOther")
        .value.trim();

    const imageFile =
        document.getElementById("fImage").files[0];

    let image = null;

    const btnSave = document.getElementById("btnSave");
    const btnSaveOriginalHtml = btnSave ? btnSave.innerHTML : "";

    if(imageFile){

        if(btnSave){
            btnSave.disabled = true;
            btnSave.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> កំពុង Upload រូបភាព...';
        }

        try{
            image = await uploadImageToCloudinary(imageFile);
        }catch(error){

            console.error(error);

            if(btnSave){
                btnSave.disabled = false;
                btnSave.innerHTML = btnSaveOriginalHtml;
            }

            if(error.message === "INVALID_IMAGE"){
                alert("ឯកសារនេះមិនមែនជារូបភាពទេ។ សូមជ្រើសរើសរូបភាពម្តងទៀត។");
            }else if(error.message === "UPLOAD_NETWORK_ERROR"){
                alert("Upload មិនជោគជ័យ។ សូមពិនិត្យការភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងម្តងទៀត។");
            }else{
                alert("Upload រូបភាពមិនជោគជ័យទេ។ សូមសាកល្បងម្តងទៀត។");
            }

            return;
        }

        if(btnSave){
            btnSave.disabled = false;
            btnSave.innerHTML = btnSaveOriginalHtml;
        }

    }

    const unit =
        parseInt(unitRaw);

    if(
        !name ||
        !year ||
        isNaN(unit) ||
        unit < 0
    ){

        document
        .getElementById("formErr")
        .classList.add("show");

        return;

    }

    if(btnSave){
        btnSave.disabled = true;
        btnSave.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> កំពុងរក្សាទុក...';
    }

    try{

        if(editingId){

            // ករណីកែប្រែទិន្នន័យចាស់
            await updateItem(
                editingId,
                {
                    name,
                    year,
                    unit,
                    other,
                    ...(image ? {image} : {})
                }
            );

            await writeAuditLog({
                action: "update",
                entity: "brochure",
                entityId: editingId,
                entityName: name,
                details: `កែ Brochure: ${name} | ឆ្នាំ ${year} | ចំនួន ${unit.toLocaleString()}`
            });

        }else{

            // =====================================================
            // បើឈ្មោះ Brochure និងឆ្នាំដូចគ្នា
            // នឹងបូកចំនួនថ្មីបន្ថែមទៅស្តុកចាស់
            // មិនបង្កើត row ថ្មីទេ
            // =====================================================

            const normalizedName =
                name.replace(/\s+/g," ").trim().toLowerCase();

            const normalizedYear =
                year.replace(/\s+/g,"").trim().toLowerCase();

            const existingItem = items.find(item => {

                const existingName =
                    String(item.name || "")
                    .replace(/\s+/g," ")
                    .trim()
                    .toLowerCase();

                const existingYear =
                    String(item.year || "")
                    .replace(/\s+/g,"")
                    .trim()
                    .toLowerCase();

                return (
                    existingName === normalizedName &&
                    existingYear === normalizedYear
                );

            });

            if(existingItem){

                const oldUnit =
                    Number(existingItem.unit || 0);

                const newTotal =
                    oldUnit + unit;

                await updateItem(
                    existingItem.id,
                    {
                        unit:newTotal,
                        other: other || existingItem.other || "",
                        ...(image ? {image} : {})
                    }
                );

                await writeAuditLog({
                    action: "update",
                    entity: "brochure",
                    entityId: existingItem.id,
                    entityName: name,
                    details: `បូកស្តុកបន្ថែម ${unit.toLocaleString()} ក្បាល (សរុបថ្មី ${newTotal.toLocaleString()})`
                });

            }else{

                // បើមិនទាន់មានឈ្មោះ + ឆ្នាំនេះ ទើបបង្កើតធាតុថ្មី
                await addItem({
                    name,
                    year,
                    unit,
                    other,
                    ...(image ? {image} : {})
                });

                await writeAuditLog({
                    action: "create",
                    entity: "brochure",
                    entityName: name,
                    details: `បង្កើត Brochure ថ្មី | ឆ្នាំ ${year} | ចំនួន ${unit.toLocaleString()}`
                });

            }

        }

        // ជោគជ័យ — លាក់ popup ភ្លាមៗ
        closeModal();

    }catch(error){

        console.error(error);

        alert("មិនអាចរក្សាទុកទិន្នន័យបានទេ។ សូមព្យាយាមម្តងទៀត។");

    }finally{

        if(btnSave){
            btnSave.disabled = false;
            btnSave.innerHTML = btnSaveOriginalHtml;
        }

    }

}
/* =====================================================
   STOCK RENDER
===================================================== */

function renderStock(){

    const search =
        document
        .getElementById("search")
        .value
        .toLowerCase()
        .trim();


    let filtered =
        search

        ? items.filter(item =>

            String(item.name)
                .toLowerCase()
                .includes(search)

            ||

            String(item.year)
                .toLowerCase()
                .includes(search)

        )

        : items;


    const container =
        document.getElementById(
            "stockContent"
        );


    if(!items.length){

        container.innerHTML = `

            <div class="empty">

                <i class="fa-solid fa-box-open"></i>

                <h3>
                    មិនទាន់មានស្តុក
                </h3>

                <p>
                    ចុច "បន្ថែម" ដើម្បីបង្កើតទិន្នន័យ
                </p>

            </div>

        `;

        return;

    }


    if(!filtered.length){

        container.innerHTML = `

            <div class="empty">

                <i class="fa-solid fa-magnifying-glass"></i>

                <h3>
                    រកមិនឃើញ
                </h3>

                <p>
                    មិនមានទិន្នន័យសម្រាប់ "${search}"
                </p>

            </div>

        `;

        return;

    }

    const st = tableState.stock;
    filtered = sortList(filtered, st.sortKey, st.sortDir);
    const pg = paginateList(filtered, st.page, st.pageSize);
    st.page = pg.page;
    const pageRows = pg.slice;
    const offset = pg.start;

    const groups = {};
    pageRows.forEach(item => {
        const year = extractYear(item.year) || "ផ្សេងៗ";
        if(!groups[year]) groups[year] = [];
        groups[year].push(item);
    });

    const keys =
        Object.keys(groups)
        .sort((a,b) => {
            if(a === "ផ្សេងៗ") return 1;
            if(b === "ផ្សេងៗ") return -1;
            return b - a;
        });

    let rowCounter = offset;

    container.innerHTML =
        `<div class="scroll-hint"><i class="fa-solid fa-hand-point-left"></i> អូសទៅឆ្វេង / ស្តាំ ដើម្បីមើលទិន្នន័យទាំងអស់ · ចុច header ដើម្បី Sort <i class="fa-solid fa-hand-point-right"></i></div>` +
        keys.map(year => {
            const rows = groups[year];
            const subtotal = rows.reduce((sum, item) => sum + Number(item.unit || 0), 0);
            return `
                <div class="group">
                    <div class="group-band">
                        <div>
                            <div class="group-year">${year}</div>
                            <div class="group-sub">${rows.length} មុខ (ទំព័រនេះ)</div>
                        </div>
                        <div class="seal">
                            <strong>${subtotal.toLocaleString()}</strong>
                            <small>ក្បាល</small>
                        </div>
                    </div>
                    <div class="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>N°</th>
                                <th>រូបភាព</th>
                                ${sortHeaderHtml("stock", "name", "ឈ្មោះ Brochure")}
                                ${sortHeaderHtml("stock", "year", "ឆ្នាំ")}
                                ${sortHeaderHtml("stock", "unit", "ចំនួន")}
                                <th>ផ្សេងៗ</th>
                                <th>សកម្មភាព</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(item => {
                                rowCounter++;
                                return `
                                <tr>
                                    <td>${rowCounter}</td>
                                    <td class="brochure-image-cell">
                                        ${item.image
                                            ? `<img class="brochure-thumb" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" title="ចុចដើម្បីមើលរូប Full Size" onclick='viewImage(${JSON.stringify(item.image)}, ${JSON.stringify(item.name)})'>`
                                            : `<div class="brochure-placeholder" title="មិនទាន់មានរូបភាព"><i class="fa-solid fa-image"></i></div>`
                                        }
                                    </td>
                                    <td><strong>${escapeHtml(item.name)}</strong></td>
                                    <td>${escapeHtml(item.year)}</td>
                                    <td class="unit ${Number(item.unit||0) < LOW_STOCK_THRESHOLD ? 'low-stock' : ''}">
                                        ${Number(item.unit || 0).toLocaleString()}
                                        ${Number(item.unit||0) < LOW_STOCK_THRESHOLD ? '<i class="fa-solid fa-triangle-exclamation" title="ស្តុកជិតអស់"></i>' : ''}
                                    </td>
                                    <td>${escapeHtml(item.other || "")}</td>
                                    <td class="actions">
                                        <button class="action-btn" onclick="editById('${item.id}')"><i class="fa-solid fa-pen"></i> កែ</button>
                                        <button class="action-btn stockin" onclick="openStockInModal('${item.id}')" title="បញ្ចូលស្តុក"><i class="fa-solid fa-arrow-up"></i> បញ្ចូលស្តុក</button>
                                        <button class="action-btn withdraw" onclick="openStockOutModal('${item.id}')" title="ដកស្តុក"><i class="fa-solid fa-arrow-down"></i> ដកស្តុក</button>
                                        <button class="action-btn delete" onclick="deleteItem('${item.id}')"><i class="fa-solid fa-trash"></i> លុប</button>
                                    </td>
                                </tr>`;
                            }).join("")}
                        </tbody>
                    </table>
                    </div>
                </div>
            `;
        }).join("") + buildPagerHtml("stock", pg);

}


/* =====================================================
   WITHDRAW / REMOVE STOCK
===================================================== */

async function withdrawStock(id){

    const item = items.find(x => x.id === id);

    if(!item) return;

    const currentStock = Number(item.unit || 0);

    if(currentStock <= 0){
        alert("Not enough stock!\nស្តុករបស់ Brochure នេះអស់ហើយ។");
        return;
    }

    const input = prompt(
        `ដកស្តុកចេញពី \"${item.name}\"\nស្តុកបច្ចុប្បន្ន: ${currentStock.toLocaleString()} ក្បាល\n\nសូមបញ្ចូលចំនួនដែលត្រូវដក:`
    );

    if(input === null) return;

    const quantity = parseInt(
        String(input).replace(/,/g, '').trim(),
        10
    );

    if(!Number.isInteger(quantity) || quantity <= 0){
        alert("សូមបញ្ចូលចំនួនស្តុកដែលត្រឹមត្រូវ។");
        return;
    }

    try{

        const docRef =
            db.collection(COLLECTION).doc(id);

        const result = await db.runTransaction(
            async transaction => {

                const snapshot =
                    await transaction.get(docRef);

                if(!snapshot.exists){
                    throw new Error("ITEM_NOT_FOUND");
                }

                const freshStock =
                    Number(snapshot.data().unit || 0);

                if(quantity > freshStock){
                    const error =
                        new Error("NOT_ENOUGH_STOCK");
                    error.available = freshStock;
                    throw error;
                }

                const remaining =
                    freshStock - quantity;

                transaction.update(
                    docRef,
                    {unit: remaining}
                );

                return {
                    remaining,
                    withdrawn: quantity
                };

            }
        );

        alert(
            `ដកស្តុកបានជោគជ័យ\n\nBrochure: ${item.name}\nដកចេញ: ${result.withdrawn.toLocaleString()} ក្បាល\nស្តុកនៅសល់: ${result.remaining.toLocaleString()} ក្បាល`
        );

    }catch(error){

        console.error(error);

        if(error.message === "NOT_ENOUGH_STOCK"){
            alert(
                `Not enough stock!\nស្តុកមិនគ្រប់សម្រាប់ការដកចេញទេ។\n\nស្តុកដែលមាន: ${Number(error.available || 0).toLocaleString()} ក្បាល\nចំនួនដែលស្នើដក: ${quantity.toLocaleString()} ក្បាល`
            );
            return;
        }

        if(error.message === "ITEM_NOT_FOUND"){
            alert("មិនអាចរកឃើញ Brochure នេះទេ។");
            return;
        }

        alert("មិនអាចដកស្តុកបានទេ។ សូមព្យាយាមម្តងទៀត។");

    }

}


/* =====================================================
   DEPARTMENT MANAGEMENT
===================================================== */
function populateDepartmentSelects(){
    const selects=[document.getElementById("soDepartment"),document.getElementById("employeeDepartment")];
    selects.forEach(select=>{
        if(!select) return;
        const current=select.value;
        select.innerHTML=`<option value="">-- ជ្រើសរើសផ្នែក --</option>`+departments.map(dep=>`<option value="${escapeHtml(dep.id)}">${escapeHtml(dep.name)}</option>`).join("");
        if(departments.some(dep=>dep.id===current)) select.value=current;
    });
    updateStockOutEmployees();
}
function updateStockOutEmployees(){
    const depId=document.getElementById("soDepartment")?.value;
    const select=document.getElementById("soEmployee");
    if(!select) return;
    const dep=departments.find(x=>x.id===depId);
    const employees=Array.isArray(dep?.employees)?dep.employees:[];
    select.innerHTML=`<option value="">-- ជ្រើសរើសអ្នកយក --</option>`+employees.map(emp=>`<option value="${escapeHtml(emp.id)}">${escapeHtml(emp.name)}</option>`).join("");
    select.disabled=!depId || !employees.length;
}
function openDepartmentModal(mode="department"){
    if(!requireAdmin("គ្រប់គ្រង Department")) return;
    departmentModalMode=mode;
    const title=document.getElementById("departmentModalTitle");
    const nameField=document.getElementById("departmentNameField");
    const depField=document.getElementById("employeeDepartmentField");
    const empField=document.getElementById("employeeNameField");
    const save=document.getElementById("btnSaveDepartment");
    const err=document.getElementById("departmentErr");
    err.classList.remove("show");err.textContent="";
    if(mode==="department"){
        title.textContent="បន្ថែមផ្នែក";nameField.style.display="block";depField.style.display="none";empField.style.display="none";
        document.getElementById("departmentName").value="";save.innerHTML=`<i class="fa-solid fa-building-circle-plus"></i> រក្សាទុកផ្នែក`;
    }else{
        title.textContent="បន្ថែមបុគ្គលិក";nameField.style.display="none";depField.style.display="block";empField.style.display="block";
        document.getElementById("employeeDepartment").value="";document.getElementById("employeeName").value="";save.innerHTML=`<i class="fa-solid fa-user-plus"></i> រក្សាទុកបុគ្គលិក`;
    }
    document.getElementById("departmentOverlay").classList.add("show");
}
function closeDepartmentModal(){document.getElementById("departmentOverlay").classList.remove("show");}
async function saveDepartmentForm(){
    const err=document.getElementById("departmentErr");err.classList.remove("show");err.textContent="";
    try{
        if(departmentModalMode==="department"){
            const name=document.getElementById("departmentName").value.trim();
            if(!name) throw new Error("សូមបញ្ចូលឈ្មោះផ្នែក។");
            if(departments.some(d=>String(d.name||"").trim().toLowerCase()===name.toLowerCase())) throw new Error("ផ្នែកនេះមានរួចហើយ។");
            await db.collection("departments").add({name,employees:[],createdAt:Date.now()});
            await writeAuditLog({
                action: "create",
                entity: "department",
                entityName: name,
                details: `បន្ថែមផ្នែក ${name}`
            });
            alert("បានបន្ថែមផ្នែកដោយជោគជ័យ។");
        }else{
            const depId=document.getElementById("employeeDepartment").value;
            const name=document.getElementById("employeeName").value.trim();
            if(!depId) throw new Error("សូមជ្រើសរើសផ្នែក។");
            if(!name) throw new Error("សូមបញ្ចូលឈ្មោះបុគ្គលិក។");
            const dep=departments.find(d=>d.id===depId); if(!dep) throw new Error("មិនអាចរកឃើញផ្នែក។");
            const employees=Array.isArray(dep.employees)?dep.employees:[];
            if(employees.some(e=>String(e.name||"").trim().toLowerCase()===name.toLowerCase())) throw new Error("បុគ្គលិកឈ្មោះនេះមានរួចហើយក្នុងផ្នែកនេះ។");
            await db.collection("departments").doc(depId).update({employees:firebase.firestore.FieldValue.arrayUnion({id:`${Date.now()}_${Math.random().toString(36).slice(2,8)}`,name})});
            await writeAuditLog({
                action: "create",
                entity: "employee",
                entityName: name,
                details: `បន្ថែមបុគ្គលិក ${name} ទៅផ្នែក ${dep.name}`
            });
            alert("បានបន្ថែមបុគ្គលិកដោយជោគជ័យ។");
        }
        closeDepartmentModal();
    }catch(e){console.error(e);err.textContent=e.message||"មិនអាចរក្សាទុកបានទេ។";err.classList.add("show");}
}
async function deleteEmployee(departmentId,employeeId){
    if(!requireAdmin("លុបបុគ្គលិក")) return;

    const dep=departments.find(d=>d.id===departmentId);if(!dep)return;
    const emp=(dep.employees||[]).find(e=>e.id===employeeId);if(!emp)return;
    if(!confirm(`តើអ្នកចង់លុបបុគ្គលិក "${emp.name}" ពីផ្នែក "${dep.name}" មែនទេ?`))return;
    try{
        await db.collection("departments").doc(departmentId).update({employees:firebase.firestore.FieldValue.arrayRemove(emp)});
        await writeAuditLog({
            action: "delete",
            entity: "employee",
            entityId: employeeId,
            entityName: emp.name,
            details: `លុបបុគ្គលិក ${emp.name} ពីផ្នែក ${dep.name}`
        });
    }catch(e){console.error(e);alert("មិនអាចលុបបុគ្គលិកបានទេ។");}
}
async function deleteDepartment(id){
    if(!requireAdmin("លុប Department")) return;

    const dep=departments.find(d=>d.id===id);if(!dep)return;
    if(!confirm(`តើអ្នកចង់លុបផ្នែក "${dep.name}" មែនទេ?`))return;
    try{
        await db.collection("departments").doc(id).delete();
        await writeAuditLog({
            action: "delete",
            entity: "department",
            entityId: id,
            entityName: dep.name,
            details: `លុបផ្នែក ${dep.name}`
        });
    }catch(e){console.error(e);alert("មិនអាចលុបផ្នែកបានទេ។");}
}
function renderDepartments(){
    const c=document.getElementById("departmentContent");if(!c)return;
    if(!departments.length){c.innerHTML=`<div class="empty"><i class="fa-solid fa-building"></i><h3>មិនទាន់មានផ្នែក</h3><p>ចុច "បន្ថែមផ្នែក" ដើម្បីបង្កើត Department។</p></div>`;return;}
    c.innerHTML=`<div class="department-grid">${departments.map(dep=>{const es=Array.isArray(dep.employees)?dep.employees:[];return `<div class="department-card"><div class="department-card-head"><div><h3><i class="fa-solid fa-building"></i> ${escapeHtml(dep.name)}</h3><span>${es.length.toLocaleString()} នាក់</span></div><button class="action-btn delete" onclick="deleteDepartment('${dep.id}')"><i class="fa-solid fa-trash"></i></button></div><ul class="employee-list">${es.length?es.map(emp=>`<li><span class="employee-name"><i class="fa-solid fa-user"></i>${escapeHtml(emp.name)}</span><button class="employee-delete" onclick="deleteEmployee('${dep.id}','${emp.id}')"><i class="fa-solid fa-trash"></i></button></li>`).join(""):`<li class="department-empty">មិនទាន់មានបុគ្គលិកក្នុងផ្នែកនេះ</li>`}</ul></div>`;}).join("")}</div>`;
}

/* =====================================================
   STOCK OUT MANAGEMENT
===================================================== */
function todayISO(){const d=new Date(),o=d.getTimezoneOffset();return new Date(d.getTime()-o*60000).toISOString().slice(0,10);}
function formatDateDisplay(v){if(!v)return "-";const p=String(v).split("-");return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:v;}
function populateStockOutBrochures(selectedId="",fallbackLabel=""){
    const s=document.getElementById("soBrochure");if(!s)return;const current=selectedId||s.value;
    let html=`<option value="">-- ជ្រើសរើស Brochure --</option>`+[...items].sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(i=>`<option value="${escapeHtml(i.id)}">${escapeHtml(i.name)} — ${escapeHtml(i.year)} (ស្តុក ${Number(i.unit||0).toLocaleString()})</option>`).join("");
    if(current && !items.some(i=>i.id===current)){
        html+=`<option value="${escapeHtml(current)}">${escapeHtml(fallbackLabel||"Brochure (លែងមាន/លែងស្ថិតក្នុងបញ្ជីបច្ចុប្បន្ន)")}</option>`;
    }
    s.innerHTML=html;
    if(current)s.value=current;
    updateStockOutBrochureInfo();
}
function updateStockOutBrochureInfo(){
    const id=document.getElementById("soBrochure")?.value,item=items.find(i=>i.id===id),year=document.getElementById("soYear"),info=document.getElementById("soStockInfo");
    const imgField=document.getElementById("soImageField");
    const imgPrev=document.getElementById("soImagePreview");
    const imgPh=document.getElementById("soImagePlaceholder");
    if(!item){
        if(id && stockOutEditingId){
            const record=stockOuts.find(x=>x.id===stockOutEditingId);
            if(record && record.brochureId===id){
                if(year)year.value=record.year||"";
                if(info)info.innerHTML=`Brochure នេះលែងមានក្នុងបញ្ជីស្តុកបច្ចុប្បន្នទៀតហើយ (ត្រូវបានលុប ឬប្ដូរឈ្មោះ)។`;
                if(imgField) imgField.style.display="none";
                return;
            }
        }
        if(year)year.value="";
        if(info)info.textContent="សូមជ្រើសរើស Brochure ដើម្បីមើលស្តុកបច្ចុប្បន្ន។";
        if(imgField) imgField.style.display="none";
        return;
    }
    year.value=item.year||"";
    info.innerHTML=`ស្តុកបច្ចុប្បន្ន: <strong>${Number(item.unit||0).toLocaleString()} ក្បាល</strong>`;
    if(imgField) imgField.style.display="block";
    if(item.image && imgPrev){
        imgPrev.src=item.image;
        imgPrev.style.display="block";
        imgPrev.onclick=()=>viewImage(item.image, item.name);
        if(imgPh) imgPh.style.display="none";
    }else{
        if(imgPrev){ imgPrev.removeAttribute("src"); imgPrev.style.display="none"; imgPrev.onclick=null; }
        if(imgPh) imgPh.style.display="flex";
    }
}
function openStockOutModal(brochureId=""){
    if(!requireAdmin("Stock Out")) return;
    if(!items.length){alert("មិនទាន់មាន Brochure ក្នុងស្តុកទេ។");return;}
    stockOutEditingId=null;
    stockOutModalMode="direct";
    document.getElementById("stockOutModalTitle").textContent="បន្ថែម Stock Out";
    document.getElementById("btnSaveStockOut").innerHTML=`<i class="fa-solid fa-floppy-disk"></i> រក្សាទុក Stock Out`;
    document.getElementById("soDate").value=todayISO();document.getElementById("soQuantity").value="";document.getElementById("soDepartment").value="";document.getElementById("soEmployee").value="";document.getElementById("soEmployee").disabled=true;
    document.getElementById("stockOutErr").classList.remove("show");document.getElementById("stockOutErr").textContent="";
    populateStockOutBrochures(brochureId);populateDepartmentSelects();
    if(brochureId){document.getElementById("soBrochure").value=brochureId;updateStockOutBrochureInfo();}
    document.getElementById("stockOutOverlay").classList.add("show");
}
function openStockOutRequestModal(brochureId=""){
    if(!items.length){alert("មិនទាន់មាន Brochure ក្នុងស្តុកទេ។");return;}
    stockOutEditingId=null;
    stockOutModalMode="request";
    document.getElementById("stockOutModalTitle").textContent="ស្នើសុំ Stock Out";
    document.getElementById("btnSaveStockOut").innerHTML=`<i class="fa-solid fa-paper-plane"></i> ស្នើសុំ`;
    document.getElementById("soDate").value=todayISO();document.getElementById("soQuantity").value="";document.getElementById("soDepartment").value="";document.getElementById("soEmployee").value="";document.getElementById("soEmployee").disabled=true;
    document.getElementById("stockOutErr").classList.remove("show");document.getElementById("stockOutErr").textContent="";
    populateStockOutBrochures(brochureId);populateDepartmentSelects();
    if(brochureId){document.getElementById("soBrochure").value=brochureId;updateStockOutBrochureInfo();}
    document.getElementById("stockOutOverlay").classList.add("show");
}
function openEditStockOutModal(id){
    if(!requireAdmin("កែ Stock Out")) return;

    const record=stockOuts.find(x=>x.id===id);
    if(!record){alert("រកមិនឃើញប្រតិបត្តិការនេះទេ។");return;}
    stockOutEditingId=id;
    stockOutModalMode="direct";
    document.getElementById("stockOutModalTitle").textContent="កែប្រែ Stock Out";
    document.getElementById("btnSaveStockOut").innerHTML=`<i class="fa-solid fa-floppy-disk"></i> កែប្រែ Stock Out`;
    document.getElementById("stockOutErr").classList.remove("show");document.getElementById("stockOutErr").textContent="";
    populateStockOutBrochures(record.brochureId,`${record.brochureName||""} — ${record.year||""}`);
    populateDepartmentSelects();
    document.getElementById("soDate").value=record.date||todayISO();
    document.getElementById("soDepartment").value=record.departmentId;
    updateStockOutEmployees();
    document.getElementById("soEmployee").value=record.employeeId;
    document.getElementById("soQuantity").value=record.quantity;
    document.getElementById("stockOutOverlay").classList.add("show");
}
function closeStockOutModal(){document.getElementById("stockOutOverlay").classList.remove("show");stockOutEditingId=null;stockOutModalMode="direct";}
async function saveStockOut(){
    const err=document.getElementById("stockOutErr");err.classList.remove("show");err.textContent="";
    const date=document.getElementById("soDate").value,brochureId=document.getElementById("soBrochure").value,departmentId=document.getElementById("soDepartment").value,employeeId=document.getElementById("soEmployee").value,quantity=parseInt(document.getElementById("soQuantity").value,10);
    if(!date||!brochureId||!departmentId||!employeeId||!Number.isInteger(quantity)||quantity<=0){err.textContent="សូមបំពេញ ថ្ងៃយកចេញ, Brochure, ផ្នែក, ឈ្មោះអ្នកយក និងចំនួនឱ្យបានត្រឹមត្រូវ។";err.classList.add("show");return;}
    const item=items.find(i=>i.id===brochureId),dep=departments.find(d=>d.id===departmentId),emp=dep?.employees?.find(e=>e.id===employeeId);
    if(!item||!dep||!emp){err.textContent="ទិន្នន័យ Brochure ឬ Department/បុគ្គលិក មិនត្រឹមត្រូវ។";err.classList.add("show");return;}
    if(stockOutEditingId){
        await updateStockOut(stockOutEditingId,{date,brochureId,departmentId,employeeId,quantity},err,item,dep,emp);
    }else if(stockOutModalMode==="request"){
        await createStockOutRequest({date,brochureId,departmentId,employeeId,quantity},err,item,dep,emp);
    }else{
        await createStockOut({date,brochureId,departmentId,employeeId,quantity},err,item,dep,emp);
    }
}
async function createStockOut(data,err,item,dep,emp){
    const {date,brochureId,departmentId,employeeId,quantity}=data;
    const stockRef=db.collection(COLLECTION).doc(brochureId),outRef=db.collection("stockOuts").doc();
    try{
        const result=await db.runTransaction(async tx=>{
            const stockSnap=await tx.get(stockRef);if(!stockSnap.exists)throw new Error("ITEM_NOT_FOUND");
            const fresh=stockSnap.data(),available=Number(fresh.unit||0);
            if(quantity>available){const e=new Error("NOT_ENOUGH_STOCK");e.available=available;throw e;}
            const depSnap=await tx.get(db.collection("departments").doc(departmentId));if(!depSnap.exists)throw new Error("DEPARTMENT_NOT_FOUND");
            const latest=(depSnap.data().employees||[]).find(e=>e.id===employeeId);if(!latest)throw new Error("EMPLOYEE_NOT_FOUND");
            const remaining=available-quantity;
            tx.update(stockRef,{unit:remaining});
            tx.set(outRef,{date,brochureId,brochureName:fresh.name||item.name,year:fresh.year||item.year,departmentId,departmentName:depSnap.data().name||dep.name,employeeId,employeeName:latest.name,quantity,createdAt:Date.now()});
            return {remaining};
        });
        await writeAuditLog({
            action: "create",
            entity: "stockOut",
            entityId: outRef.id,
            entityName: item.name,
            details: `ដក ${quantity.toLocaleString()} ក្បាល | អ្នកយក: ${emp.name} | ផ្នែក: ${dep.name}`
        });
        closeStockOutModal();alert(`ដកស្តុកបានជោគជ័យ!\n\nBrochure: ${item.name}\nអ្នកយក: ${emp.name}\nផ្នែក: ${dep.name}\nចំនួនយកចេញ: ${quantity.toLocaleString()} ក្បាល\nស្តុកនៅសល់: ${result.remaining.toLocaleString()} ក្បាល`);goPage("stockout");
    }catch(e){
        console.error(e);
        if(e.message==="NOT_ENOUGH_STOCK")err.textContent=`Not enough stock! ស្តុកមិនគ្រប់សម្រាប់ការដកចេញទេ។ ស្តុកដែលមាន: ${Number(e.available||0).toLocaleString()} ក្បាល | ស្នើដក: ${quantity.toLocaleString()} ក្បាល`;
        else if(e.message==="EMPLOYEE_NOT_FOUND")err.textContent="បុគ្គលិកនេះលែងស្ថិតនៅក្នុងផ្នែកនេះទៀតហើយ។ សូមជ្រើសរើសម្តងទៀត។";
        else if(e.message==="DEPARTMENT_NOT_FOUND")err.textContent="ផ្នែកនេះលែងមានទៀតហើយ។ សូមជ្រើសរើសម្តងទៀត។";
        else if(e.message==="ITEM_NOT_FOUND")err.textContent="Brochure នេះលែងមានក្នុងស្តុកទៀតហើយ។";
        else err.textContent="មិនអាចរក្សាទុក Stock Out បានទេ។ សូមព្យាយាមម្តងទៀត។";
        err.classList.add("show");
    }
}
async function updateStockOut(recordId,data,err,item,dep,emp){
    const {date,brochureId,departmentId,employeeId,quantity}=data;
    const outRef=db.collection("stockOuts").doc(recordId);
    try{
        const result=await db.runTransaction(async tx=>{
            const outSnap=await tx.get(outRef);if(!outSnap.exists)throw new Error("RECORD_NOT_FOUND");
            const old=outSnap.data(),oldBrochureId=old.brochureId,oldQuantity=Number(old.quantity||0);
            const depSnap=await tx.get(db.collection("departments").doc(departmentId));if(!depSnap.exists)throw new Error("DEPARTMENT_NOT_FOUND");
            const latest=(depSnap.data().employees||[]).find(e=>e.id===employeeId);if(!latest)throw new Error("EMPLOYEE_NOT_FOUND");
            if(oldBrochureId===brochureId){
                const stockRef=db.collection(COLLECTION).doc(brochureId);
                const stockSnap=await tx.get(stockRef);if(!stockSnap.exists)throw new Error("ITEM_NOT_FOUND");
                const fresh=stockSnap.data(),availableWithRestore=Number(fresh.unit||0)+oldQuantity;
                if(quantity>availableWithRestore){const e=new Error("NOT_ENOUGH_STOCK");e.available=availableWithRestore;throw e;}
                const remaining=availableWithRestore-quantity;
                tx.update(stockRef,{unit:remaining});
                tx.update(outRef,{date,brochureId,brochureName:fresh.name||item.name,year:fresh.year||item.year,departmentId,departmentName:depSnap.data().name||dep.name,employeeId,employeeName:latest.name,quantity,updatedAt:Date.now()});
                return {remaining};
            }else{
                const oldStockRef=db.collection(COLLECTION).doc(oldBrochureId),newStockRef=db.collection(COLLECTION).doc(brochureId);
                const oldStockSnap=await tx.get(oldStockRef),newStockSnap=await tx.get(newStockRef);
                if(!newStockSnap.exists)throw new Error("ITEM_NOT_FOUND");
                const newFresh=newStockSnap.data(),newAvailable=Number(newFresh.unit||0);
                if(quantity>newAvailable){const e=new Error("NOT_ENOUGH_STOCK");e.available=newAvailable;throw e;}
                if(oldStockSnap.exists){const oldFresh=oldStockSnap.data();tx.update(oldStockRef,{unit:Number(oldFresh.unit||0)+oldQuantity});}
                const remaining=newAvailable-quantity;
                tx.update(newStockRef,{unit:remaining});
                tx.update(outRef,{date,brochureId,brochureName:newFresh.name||item.name,year:newFresh.year||item.year,departmentId,departmentName:depSnap.data().name||dep.name,employeeId,employeeName:latest.name,quantity,updatedAt:Date.now()});
                return {remaining};
            }
        });
        await writeAuditLog({
            action: "update",
            entity: "stockOut",
            entityId: recordId,
            entityName: item.name,
            details: `កែ Stock Out → ចំនួន ${quantity.toLocaleString()} | អ្នកយក: ${emp.name} | ផ្នែក: ${dep.name}`
        });
        closeStockOutModal();alert(`កែប្រែ Stock Out បានជោគជ័យ!\n\nBrochure: ${item.name}\nអ្នកយក: ${emp.name}\nផ្នែក: ${dep.name}\nចំនួនយកចេញ: ${quantity.toLocaleString()} ក្បាល\nស្តុកនៅសល់: ${result.remaining.toLocaleString()} ក្បាល`);goPage("stockout");
    }catch(e){
        console.error(e);
        if(e.message==="NOT_ENOUGH_STOCK")err.textContent=`Not enough stock! ស្តុកមិនគ្រប់សម្រាប់ការកែប្រែនេះទេ។ ស្តុកអតិបរមាដែលអាចប្រើបាន: ${Number(e.available||0).toLocaleString()} ក្បាល | ស្នើ: ${quantity.toLocaleString()} ក្បាល`;
        else if(e.message==="EMPLOYEE_NOT_FOUND")err.textContent="បុគ្គលិកនេះលែងស្ថិតនៅក្នុងផ្នែកនេះទៀតហើយ។ សូមជ្រើសរើសម្តងទៀត។";
        else if(e.message==="DEPARTMENT_NOT_FOUND")err.textContent="ផ្នែកនេះលែងមានទៀតហើយ។ សូមជ្រើសរើសម្តងទៀត។";
        else if(e.message==="ITEM_NOT_FOUND")err.textContent="Brochure នេះលែងមានក្នុងស្តុកទៀតហើយ។";
        else if(e.message==="RECORD_NOT_FOUND")err.textContent="ប្រតិបត្តិការនេះលែងមានទៀតហើយ។ សូមផ្ទុកទំព័រឡើងវិញ។";
        else err.textContent="មិនអាចកែប្រែ Stock Out បានទេ។ សូមព្យាយាមម្តងទៀត។";
        err.classList.add("show");
    }
}
async function deleteStockOut(id){
    if(!requireAdmin("លុប Stock Out")) return;

    const record=stockOuts.find(x=>x.id===id);
    if(!record){alert("រកមិនឃើញប្រតិបត្តិការនេះទេ។");return;}
    const ok=confirm(`តើអ្នកចង់លុបប្រតិបត្តិការនេះមែនទេ?\n\nBrochure: ${record.brochureName}\nផ្នែក: ${record.departmentName}\nចំនួនយកចេញ: ${Number(record.quantity||0).toLocaleString()} ក្បាល\n\nស្តុកនឹងត្រូវបានបន្ថែមមកវិញដោយស្វ័យប្រវត្តិ។`);
    if(!ok)return;
    const outRef=db.collection("stockOuts").doc(id),stockRef=db.collection(COLLECTION).doc(record.brochureId);
    try{
        await db.runTransaction(async tx=>{
            const outSnap=await tx.get(outRef);if(!outSnap.exists)return;
            const stockSnap=await tx.get(stockRef);
            if(stockSnap.exists){
                const fresh=stockSnap.data();
                tx.update(stockRef,{unit:Number(fresh.unit||0)+Number(record.quantity||0)});
            }
            tx.delete(outRef);
        });
        await writeAuditLog({
            action: "delete",
            entity: "stockOut",
            entityId: id,
            entityName: record.brochureName,
            details: `លុប Stock Out | ចំនួន ${Number(record.quantity||0).toLocaleString()} | ផ្នែក ${record.departmentName} | អ្នកយក ${record.employeeName}`
        });
    }catch(error){
        console.error(error);
        alert("មិនអាចលុបប្រតិបត្តិការនេះបានទេ។ សូមព្យាយាមម្តងទៀត។");
    }
}
function brochureImageCellHtml(brochureId, brochureName){
    const item = items.find(i => i.id === brochureId);
    const img = item?.image || "";
    const title = brochureName || item?.name || "Brochure";
    if(img){
        return `<td class="brochure-image-cell"><img class="table-thumb" src="${escapeHtml(img)}" alt="${escapeHtml(title)}" title="ចុចមើល Full Size" onclick='viewImage(${JSON.stringify(img)}, ${JSON.stringify(title)})'></td>`;
    }
    return `<td class="brochure-image-cell"><div class="table-thumb-ph" title="មិនទាន់មានរូបភាព"><i class="fa-solid fa-image"></i></div></td>`;
}

function renderStockOut(){
    const c=document.getElementById("stockOutContent");if(!c)return;
    const q=(document.getElementById("stockOutSearch")?.value||"").toLowerCase().trim();
    let list=q?stockOuts.filter(x=>[x.date,x.brochureName,x.year,x.departmentName,x.employeeName].some(v=>String(v||"").toLowerCase().includes(q))):[...stockOuts];
    const totalAll=list.reduce((a,x)=>a+Number(x.quantity||0),0);
    if(!list.length){c.innerHTML=`<div class="stockout-summary"><div class="stockout-summary-card"><small>ប្រតិបត្តិការសរុប</small><strong>0</strong></div><div class="stockout-summary-card"><small>ចំនួនយកចេញសរុប</small><strong>0</strong></div><div class="stockout-summary-card"><small>ស្ថានភាព</small><strong>—</strong></div></div><div class="empty"><i class="fa-solid fa-arrow-up-from-bracket"></i><h3>មិនទាន់មាន Stock Out</h3><p>ចុច "បន្ថែម Stock Out" ដើម្បីកត់ត្រាការយក Brochure ចេញ។</p></div>`;return;}
    const st=tableState.stockOut;
    list=sortList(list, st.sortKey, st.sortDir);
    const pg=paginateList(list, st.page, st.pageSize);
    st.page=pg.page;
    const rows=pg.slice;
    c.innerHTML=`<div class="stockout-summary"><div class="stockout-summary-card"><small>ប្រតិបត្តិការសរុប</small><strong>${list.length.toLocaleString()}</strong></div><div class="stockout-summary-card"><small>ចំនួនយកចេញសរុប</small><strong>${totalAll.toLocaleString()}</strong></div><div class="stockout-summary-card"><small>បង្ហាញ</small><strong>${rows.length.toLocaleString()}</strong></div></div><div class="data-table-wrap"><table><thead><tr><th>N°</th><th>រូបភាព</th>${sortHeaderHtml("stockOut","date","ថ្ងៃយកចេញ")}${sortHeaderHtml("stockOut","brochureName","ឈ្មោះ Brochure")}${sortHeaderHtml("stockOut","year","ឆ្នាំ")}${sortHeaderHtml("stockOut","departmentName","ផ្នែក")}${sortHeaderHtml("stockOut","employeeName","ឈ្មោះអ្នកយក")}${sortHeaderHtml("stockOut","quantity","ចំនួនយកចេញ")}<th>សកម្មភាព</th></tr></thead><tbody>${rows.map((x,i)=>`<tr><td>${pg.start+i+1}</td>${brochureImageCellHtml(x.brochureId, x.brochureName)}<td>${escapeHtml(formatDateDisplay(x.date))}</td><td><strong>${escapeHtml(x.brochureName)}</strong></td><td>${escapeHtml(x.year)}</td><td>${escapeHtml(x.departmentName)}</td><td>${escapeHtml(x.employeeName)}</td><td class="unit">${Number(x.quantity||0).toLocaleString()}</td><td class="actions"><button class="action-btn" onclick="openEditStockOutModal('${x.id}')"><i class="fa-solid fa-pen"></i> កែ</button><button class="action-btn delete" onclick="deleteStockOut('${x.id}')"><i class="fa-solid fa-trash"></i> លុប</button></td></tr>`).join("")}</tbody></table></div>${buildPagerHtml("stockOut", pg)}`;
}

function switchStockOutTab(tab){
    stockOutActiveTab = tab;
    document.getElementById("stockOutTabTransactions")?.classList.toggle("active", tab==="transactions");
    document.getElementById("stockOutTabRequests")?.classList.toggle("active", tab==="requests");
    const txPanel = document.getElementById("stockOutTxPanel");
    const reqPanel = document.getElementById("stockOutReqPanel");
    if(txPanel) txPanel.style.display = tab==="transactions" ? "" : "none";
    if(reqPanel) reqPanel.style.display = tab==="requests" ? "" : "none";
    if(tab==="requests") renderStockOutRequests();
}

function requestStatusBadgeHtml(status){
    const map = {
        pending:  { label:"កំពុងរង់ចាំ",   cls:"pending"  },
        approved: { label:"បានអនុម័ត",     cls:"approved" },
        rejected: { label:"បានបដិសេធ",     cls:"rejected" }
    };
    const s = map[status] || { label: status || "-", cls: "" };
    return `<span class="request-status-badge ${s.cls}">${escapeHtml(s.label)}</span>`;
}

function renderStockOutRequests(){
    const c=document.getElementById("stockOutRequestsContent");if(!c)return;
    const admin = isAdmin();
    const q=(document.getElementById("stockOutRequestSearch")?.value||"").toLowerCase().trim();
    const statusFilter = document.getElementById("stockOutRequestStatusFilter")?.value || "";

    let list = admin ? [...stockOutRequests] : stockOutRequests.filter(r=>r.requestedByUid===currentUser?.uid);
    if(statusFilter) list = list.filter(r=>r.status===statusFilter);
    if(q) list = list.filter(r=>[r.brochureName,r.year,r.departmentName,r.employeeName,r.requestedByName].some(v=>String(v||"").toLowerCase().includes(q)));

    const pendingCount = list.filter(r=>r.status==="pending").length;

    if(!list.length){
        c.innerHTML=`<div class="empty"><i class="fa-solid fa-inbox"></i><h3>មិនទាន់មានសំណើ</h3><p>${admin ? "សំណើ Stock Out ពី Staff នឹងបង្ហាញនៅទីនេះ។" : 'ចុច "ស្នើសុំ Stock Out" ដើម្បីស្នើសុំយក Brochure ចេញ។'}</p></div>`;
        return;
    }

    const st=tableState.stockOutRequests;
    list=sortList(list, st.sortKey, st.sortDir);
    const pg=paginateList(list, st.page, st.pageSize);
    st.page=pg.page;
    const rows=pg.slice;

    c.innerHTML=`
        <div class="stockout-summary">
            <div class="stockout-summary-card"><small>សំណើសរុប</small><strong>${list.length.toLocaleString()}</strong></div>
            <div class="stockout-summary-card"><small>កំពុងរង់ចាំ</small><strong>${pendingCount.toLocaleString()}</strong></div>
            <div class="stockout-summary-card"><small>បង្ហាញ</small><strong>${rows.length.toLocaleString()}</strong></div>
        </div>
        <div class="data-table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>N°</th>
                        <th>រូបភាព</th>
                        ${sortHeaderHtml("stockOutRequests","date","ថ្ងៃស្នើ")}
                        ${sortHeaderHtml("stockOutRequests","brochureName","ឈ្មោះ Brochure")}
                        ${sortHeaderHtml("stockOutRequests","departmentName","ផ្នែក")}
                        ${sortHeaderHtml("stockOutRequests","employeeName","ឈ្មោះអ្នកយក")}
                        ${sortHeaderHtml("stockOutRequests","quantity","ចំនួន")}
                        ${admin ? sortHeaderHtml("stockOutRequests","requestedByName","ស្នើដោយ") : ""}
                        <th>ស្ថានភាព</th>
                        <th>សកម្មភាព</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map((x,i)=>`
                        <tr>
                            <td>${pg.start+i+1}</td>
                            ${brochureImageCellHtml(x.brochureId, x.brochureName)}
                            <td>${escapeHtml(formatDateDisplay(x.date))}</td>
                            <td><strong>${escapeHtml(x.brochureName)}</strong>${x.year?` <span style="color:var(--text-soft);font-size:11px;">(${escapeHtml(x.year)})</span>`:""}</td>
                            <td>${escapeHtml(x.departmentName)}</td>
                            <td>${escapeHtml(x.employeeName)}</td>
                            <td class="unit">${Number(x.quantity||0).toLocaleString()}</td>
                            ${admin ? `<td>${escapeHtml(x.requestedByName||"-")}</td>` : ""}
                            <td>${requestStatusBadgeHtml(x.status)}${x.status==="rejected" && x.reviewNote ? `<div style="font-size:11px;color:var(--text-soft);margin-top:3px;max-width:160px;">${escapeHtml(x.reviewNote)}</div>` : ""}</td>
                            <td class="actions">
                                ${admin && x.status==="pending" ? `<button class="action-btn approve" onclick="approveStockOutRequest('${x.id}')" title="អនុម័ត"><i class="fa-solid fa-check"></i> អនុម័ត</button><button class="action-btn reject" onclick="rejectStockOutRequest('${x.id}')" title="បដិសេធ"><i class="fa-solid fa-xmark"></i> បដិសេធ</button>` : ""}
                                ${!admin && x.status==="pending" ? `<button class="btn-secondary" style="padding:6px 10px;font-size:12px;" onclick="cancelStockOutRequest('${x.id}')"><i class="fa-solid fa-ban"></i> បោះបង់</button>` : ""}
                                ${x.status!=="pending" ? `<span style="font-size:11px;color:var(--text-soft);">${escapeHtml(x.reviewedByName||"")}</span>` : ""}
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
        ${buildPagerHtml("stockOutRequests", pg)}
    `;
}

/* =====================================================
   STOCK OUT REQUEST — CREATE / APPROVE / REJECT / CANCEL
===================================================== */
async function createStockOutRequest(data,err,item,dep,emp){
    const {date,brochureId,departmentId,employeeId,quantity}=data;
    try{
        const fresh = items.find(i=>i.id===brochureId);
        if(!fresh){err.textContent="Brochure នេះលែងមានក្នុងស្តុកទៀតហើយ។";err.classList.add("show");return;}
        if(quantity > Number(fresh.unit||0)){
            err.textContent=`Not enough stock! ស្តុកមិនគ្រប់សម្រាប់ការស្នើសុំនេះទេ។ ស្តុកដែលមាន: ${Number(fresh.unit||0).toLocaleString()} ក្បាល | ស្នើ: ${quantity.toLocaleString()} ក្បាល`;
            err.classList.add("show");
            return;
        }
        const reqRef = db.collection("stockOutRequests").doc();
        await reqRef.set({
            date, brochureId, brochureName:item.name, year:item.year||"",
            departmentId, departmentName:dep.name,
            employeeId, employeeName:emp.name,
            quantity,
            status:"pending",
            requestedByUid: currentUser?.uid || "",
            requestedByName: getOperatorName(),
            requestedAt: Date.now()
        });
        await writeAuditLog({
            action:"create",
            entity:"stockOutRequest",
            entityId:reqRef.id,
            entityName:item.name,
            details:`ស្នើសុំដក ${quantity.toLocaleString()} ក្បាល | អ្នកយក: ${emp.name} | ផ្នែក: ${dep.name}`
        });
        closeStockOutModal();
        alert(`ស្នើសុំ Stock Out បានជោគជ័យ! សូមរង់ចាំការអនុម័តពី Admin។\n\nBrochure: ${item.name}\nអ្នកយក: ${emp.name}\nផ្នែក: ${dep.name}\nចំនួន: ${quantity.toLocaleString()} ក្បាល`);
        goPage("stockout");
    }catch(e){
        console.error(e);
        err.textContent="មិនអាចផ្ញើសំណើ Stock Out បានទេ។ សូមព្យាយាមម្តងទៀត។";
        err.classList.add("show");
    }
}

async function approveStockOutRequest(id){
    if(!requireAdmin("អនុម័ត Stock Out")) return;
    const request = stockOutRequests.find(r=>r.id===id);
    if(!request){alert("រកមិនឃើញសំណើនេះទេ។");return;}
    if(request.status!=="pending"){alert("សំណើនេះត្រូវបានដោះស្រាយរួចហើយ។");return;}
    const ok = confirm(`តើអ្នកចង់អនុម័តសំណើនេះមែនទេ?\n\nBrochure: ${request.brochureName}\nផ្នែក: ${request.departmentName}\nអ្នកយក: ${request.employeeName}\nចំនួន: ${Number(request.quantity||0).toLocaleString()} ក្បាល`);
    if(!ok)return;

    const reqRef = db.collection("stockOutRequests").doc(id);
    const stockRef = db.collection(COLLECTION).doc(request.brochureId);
    const outRef = db.collection("stockOuts").doc();

    try{
        const result = await db.runTransaction(async tx=>{
            const reqSnap = await tx.get(reqRef);
            if(!reqSnap.exists) throw new Error("REQUEST_NOT_FOUND");
            const freshReq = reqSnap.data();
            if(freshReq.status!=="pending") throw new Error("ALREADY_HANDLED");

            const stockSnap = await tx.get(stockRef);
            if(!stockSnap.exists) throw new Error("ITEM_NOT_FOUND");
            const fresh = stockSnap.data(), available = Number(fresh.unit||0);
            const quantity = Number(freshReq.quantity||0);
            if(quantity>available){const e=new Error("NOT_ENOUGH_STOCK");e.available=available;throw e;}

            const depSnap = await tx.get(db.collection("departments").doc(freshReq.departmentId));
            if(!depSnap.exists) throw new Error("DEPARTMENT_NOT_FOUND");
            const latest = (depSnap.data().employees||[]).find(e=>e.id===freshReq.employeeId);
            if(!latest) throw new Error("EMPLOYEE_NOT_FOUND");

            const remaining = available-quantity;
            tx.update(stockRef,{unit:remaining});
            tx.set(outRef,{
                date:freshReq.date, brochureId:freshReq.brochureId, brochureName:fresh.name||freshReq.brochureName, year:fresh.year||freshReq.year,
                departmentId:freshReq.departmentId, departmentName:depSnap.data().name||freshReq.departmentName,
                employeeId:freshReq.employeeId, employeeName:latest.name,
                quantity, createdAt:Date.now(), fromRequestId:id
            });
            tx.update(reqRef,{
                status:"approved",
                reviewedByUid:currentUser?.uid||"",
                reviewedByName:getOperatorName(),
                reviewedAt:Date.now()
            });
            return {remaining, quantity};
        });
        await writeAuditLog({
            action:"update",
            entity:"stockOutRequest",
            entityId:id,
            entityName:request.brochureName,
            details:`អនុម័តសំណើ Stock Out | ចំនួន ${result.quantity.toLocaleString()} | ផ្នែក ${request.departmentName} | អ្នកយក ${request.employeeName}`
        });
        alert(`អនុម័តសំណើបានជោគជ័យ! ស្តុកនៅសល់: ${result.remaining.toLocaleString()} ក្បាល`);
        }catch(e){
        console.error(e);
        if(e.code === "resource-exhausted" || (e.message && e.message.includes("Quota"))){
            alert("Firestore Quota លើសហើយ។ សូមរង់ចាំបន្តិច ឬកាត់បន្ថយចំនួន tab App ដែលបើក។");
        }
        else if(e.message==="NOT_ENOUGH_STOCK") alert(`Not enough stock! ស្តុកមិនគ្រប់សម្រាប់អនុម័តទេ។ ស្តុកដែលមាន: ${Number(e.available||0).toLocaleString()} ក្បាល`);
        else if(e.message==="ALREADY_HANDLED") alert("សំណើនេះត្រូវបានដោះស្រាយរួចហើយ។");
        else if(e.message==="REQUEST_NOT_FOUND") alert("រកមិនឃើញសំណើនេះទេ។");
        else if(e.message==="EMPLOYEE_NOT_FOUND") alert("បុគ្គលិកនេះលែងស្ថិតនៅក្នុងផ្នែកនេះទៀតហើយ។");
        else if(e.message==="DEPARTMENT_NOT_FOUND") alert("ផ្នែកនេះលែងមានទៀតហើយ។");
        else if(e.message==="ITEM_NOT_FOUND") alert("Brochure នេះលែងមានក្នុងស្តុកទៀតហើយ។");
        else alert("មិនអាចអនុម័តសំណើនេះបានទេ។ សូមព្យាយាមម្តងទៀត។");
    }
}

async function rejectStockOutRequest(id){
    if(!requireAdmin("បដិសេធ Stock Out")) return;
    const request = stockOutRequests.find(r=>r.id===id);
    if(!request){alert("រកមិនឃើញសំណើនេះទេ។");return;}
    if(request.status!=="pending"){alert("សំណើនេះត្រូវបានដោះស្រាយរួចហើយ។");return;}
    const note = prompt("មូលហេតុនៃការបដិសេធ (មិនចាំបាច់):","") || "";
    const reqRef = db.collection("stockOutRequests").doc(id);
    try{
        await db.runTransaction(async tx=>{
            const reqSnap = await tx.get(reqRef);
            if(!reqSnap.exists) throw new Error("REQUEST_NOT_FOUND");
            if(reqSnap.data().status!=="pending") throw new Error("ALREADY_HANDLED");
            tx.update(reqRef,{
                status:"rejected",
                reviewNote:note.trim(),
                reviewedByUid:currentUser?.uid||"",
                reviewedByName:getOperatorName(),
                reviewedAt:Date.now()
            });
        });
        await writeAuditLog({
            action:"update",
            entity:"stockOutRequest",
            entityId:id,
            entityName:request.brochureName,
            details:`បដិសេធសំណើ Stock Out | ផ្នែក ${request.departmentName} | អ្នកយក ${request.employeeName}${note.trim()?` | មូលហេតុ: ${note.trim()}`:""}`
        });
        alert("បានបដិសេធសំណើនេះ។");
        }catch(e){
        console.error(e);
        if(e.code === "resource-exhausted" || (e.message && e.message.includes("Quota"))){
            alert("Firestore Quota លើសហើយ។ សូមរង់ចាំបន្តិច ឬកាត់បន្ថយចំនួន tab App ដែលបើក។");
        }
        else if(e.message==="ALREADY_HANDLED") alert("សំណើនេះត្រូវបានដោះស្រាយរួចហើយ។");
        else if(e.message==="REQUEST_NOT_FOUND") alert("រកមិនឃើញសំណើនេះទេ។");
        else alert("មិនអាចបដិសេធសំណើនេះបានទេ។ សូមព្យាយាមម្តងទៀត។");
    }
}

async function cancelStockOutRequest(id){
    const request = stockOutRequests.find(r=>r.id===id);
    if(!request){alert("រកមិនឃើញសំណើនេះទេ។");return;}
    if(request.requestedByUid !== currentUser?.uid){alert("អ្នកមិនអាចបោះបង់សំណើនេះបានទេ។");return;}
    if(request.status!=="pending"){alert("សំណើនេះត្រូវបានដោះស្រាយរួចហើយ។");return;}
    const ok = confirm("តើអ្នកចង់បោះបង់សំណើនេះមែនទេ?");
    if(!ok) return;
    const reqRef = db.collection("stockOutRequests").doc(id);
    try{
        await db.runTransaction(async tx=>{
            const reqSnap = await tx.get(reqRef);
            if(!reqSnap.exists) throw new Error("REQUEST_NOT_FOUND");
            if(reqSnap.data().status!=="pending") throw new Error("ALREADY_HANDLED");
            tx.delete(reqRef);
        });
        await writeAuditLog({
            action:"delete",
            entity:"stockOutRequest",
            entityId:id,
            entityName:request.brochureName,
            details:`បោះបង់សំណើ Stock Out | ចំនួន ${Number(request.quantity||0).toLocaleString()} | ផ្នែក ${request.departmentName}`
        });
    }catch(e){
        console.error(e);
        if(e.message==="ALREADY_HANDLED") alert("សំណើនេះត្រូវបានដោះស្រាយរួចហើយ។");
        else alert("មិនអាចបោះបង់សំណើនេះបានទេ។ សូមព្យាយាមម្តងទៀត។");
    }
}


/* =====================================================
   STOCK IN MANAGEMENT
===================================================== */
function clearSiImageInput(){
    const input=document.getElementById("siImage");
    if(input) input.value="";
}
function resetSiImagePreview(){
    clearSiImageInput();
    const prev=document.getElementById("siImagePreview");
    if(prev){
        prev.removeAttribute("src");
        prev.style.display="none";
        prev.onclick=null;
    }
    const help=document.getElementById("siImageHelp");
    if(help){
        help.innerHTML = siMode==="new"
            ? "Upload រូបភាព Brochure ថ្មី (ស្រេចចិត្ត)"
            : "Brochure មានស្រាប់៖ បង្ហាញរូបបច្ចុប្បន្ន · អាចជ្រើសរូបថ្មីដើម្បីប្តូរ";
    }
}
function setSiImagePreviewFromUrl(url, title){
    const prev=document.getElementById("siImagePreview");
    if(!prev) return;
    if(url){
        prev.src=url;
        prev.style.display="block";
        prev.onclick=()=>viewImage(url, title||"Brochure");
    }else{
        prev.removeAttribute("src");
        prev.style.display="none";
        prev.onclick=null;
    }
}
function setSiMode(mode){
    siMode=mode;
    const btnExisting=document.getElementById("siModeExisting");
    const btnNew=document.getElementById("siModeNew");
    const existingWrap=document.getElementById("siExistingWrap");
    const existingYearWrap=document.getElementById("siExistingYearWrap");
    const newNameWrap=document.getElementById("siNewNameWrap");
    const newYearWrap=document.getElementById("siNewYearWrap");
    const info=document.getElementById("siStockInfo");

    btnExisting?.classList.toggle("active",mode==="existing");
    btnNew?.classList.toggle("active",mode==="new");

    if(mode==="existing"){
        existingWrap.style.display="block";
        existingYearWrap.style.display="block";
        newNameWrap.style.display="none";
        newYearWrap.style.display="none";
        resetSiImagePreview();
        updateStockInBrochureInfo();
    }else{
        existingWrap.style.display="none";
        existingYearWrap.style.display="none";
        newNameWrap.style.display="block";
        newYearWrap.style.display="block";
        if(info) info.innerHTML="Brochure ថ្មីនឹងត្រូវបានបង្កើតដោយស្វ័យប្រវត្តិ ព្រមជាមួយការបញ្ចូលស្តុកលើកដំបូង។";
        resetSiImagePreview();
    }
}
function populateStockInBrochures(selectedId="",fallbackLabel=""){
    const s=document.getElementById("siBrochureSelect");if(!s)return;const current=selectedId||s.value;
    let html=`<option value="">-- ជ្រើសរើស Brochure --</option>`+[...items].sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(i=>`<option value="${escapeHtml(i.id)}">${escapeHtml(i.name)} — ${escapeHtml(i.year)} (ស្តុក ${Number(i.unit||0).toLocaleString()})</option>`).join("");
    if(current && !items.some(i=>i.id===current)){
        html+=`<option value="${escapeHtml(current)}">${escapeHtml(fallbackLabel||"Brochure (លែងមាន/លែងស្ថិតក្នុងបញ្ជីបច្ចុប្បន្ន)")}</option>`;
    }
    s.innerHTML=html;
    if(current)s.value=current;
    if(siMode==="existing") updateStockInBrochureInfo();
}
function updateStockInBrochureInfo(){
    const id=document.getElementById("siBrochureSelect")?.value,item=items.find(i=>i.id===id),year=document.getElementById("siYear"),info=document.getElementById("siStockInfo");
    // កុំលុប file input បើអ្នកប្រើកំពុងជ្រើសរូប — តែពេលប្តូរ brochure
    const fileInput=document.getElementById("siImage");
    const hasNewFile=fileInput && fileInput.files && fileInput.files[0];
    if(!item){
        if(id && stockInEditingId){
            const record=stockIns.find(x=>x.id===stockInEditingId);
            if(record && record.brochureId===id){
                if(year)year.value=record.year||"";
                if(info)info.innerHTML=`Brochure នេះលែងមានក្នុងបញ្ជីស្តុកបច្ចុប្បន្នទៀតហើយ (ត្រូវបានលុប ឬប្ដូរឈ្មោះ)។`;
                if(!hasNewFile) setSiImagePreviewFromUrl("", "");
                return;
            }
        }
        if(year)year.value="";
        if(info)info.textContent="សូមជ្រើសរើស Brochure ដើម្បីមើលស្តុកបច្ចុប្បន្ន។";
        if(!hasNewFile) setSiImagePreviewFromUrl("", "");
        return;
    }
    year.value=item.year||"";
    info.innerHTML=`ស្តុកបច្ចុប្បន្ន: <strong>${Number(item.unit||0).toLocaleString()} ក្បាល</strong>`;
    if(!hasNewFile){
        setSiImagePreviewFromUrl(item.image || "", item.name);
    }
}
function openStockInModal(brochureId=""){
    if(!requireAdmin("Stock In")) return;
    stockInEditingId=null;
    document.getElementById("stockInModalTitle").textContent="បន្ថែម Stock In";
    document.getElementById("btnSaveStockIn").innerHTML=`<i class="fa-solid fa-floppy-disk"></i> រក្សាទុក Stock In`;
    document.getElementById("siDate").value=todayISO();document.getElementById("siQuantity").value="";document.getElementById("siNote").value="";
    document.getElementById("siBrochureNameNew").value="";document.getElementById("siYearNew").value="";
    document.getElementById("stockInErr").classList.remove("show");document.getElementById("stockInErr").textContent="";
    document.getElementById("siModeField").style.display="block";
    clearSiImageInput();
    setSiMode("existing");
    populateStockInBrochures(brochureId);
    if(brochureId){document.getElementById("siBrochureSelect").value=brochureId;updateStockInBrochureInfo();}
    document.getElementById("stockInOverlay").classList.add("show");
}
function openEditStockInModal(id){
    if(!requireAdmin("កែ Stock In")) return;

    const record=stockIns.find(x=>x.id===id);
    if(!record){alert("រកមិនឃើញប្រតិបត្តិការនេះទេ។");return;}
    stockInEditingId=id;
    document.getElementById("stockInModalTitle").textContent="កែប្រែ Stock In";
    document.getElementById("btnSaveStockIn").innerHTML=`<i class="fa-solid fa-floppy-disk"></i> កែប្រែ Stock In`;
    document.getElementById("stockInErr").classList.remove("show");document.getElementById("stockInErr").textContent="";
    // ការកែប្រែជានិច្ចកែទៅលើ Brochure ដែលមានស្រាប់ ដូច្នេះលាក់ប៊ូតុង "Brochure ថ្មី"
    document.getElementById("siModeField").style.display="none";
    clearSiImageInput();
    setSiMode("existing");
    populateStockInBrochures(record.brochureId,`${record.brochureName||""} — ${record.year||""}`);
    document.getElementById("siBrochureSelect").value=record.brochureId;
    document.getElementById("siDate").value=record.date||todayISO();
    document.getElementById("siQuantity").value=record.quantity;
    document.getElementById("siNote").value=record.note||"";
    updateStockInBrochureInfo();
    document.getElementById("stockInOverlay").classList.add("show");
}
function closeStockInModal(){
    document.getElementById("stockInOverlay").classList.remove("show");
    stockInEditingId=null;
    resetSiImagePreview();
}
async function getSiUploadedImageUrl(err){
    const file=document.getElementById("siImage")?.files?.[0];
    if(!file) return null;
    try{
        return await uploadImageToCloudinary(file);
    }catch(e){
        console.error(e);
        if(err){
            err.textContent="មិនអាច Upload រូបភាពបានទេ។ សូមព្យាយាមម្តងទៀត។";
            err.classList.add("show");
        }
        throw e;
    }
}
async function saveStockIn(){
    const err=document.getElementById("stockInErr");err.classList.remove("show");err.textContent="";
    const date=document.getElementById("siDate").value;
    const quantity=parseInt(String(document.getElementById("siQuantity").value).replace(/,/g,""),10);
    const note=document.getElementById("siNote").value.trim();
    const btn=document.getElementById("btnSaveStockIn");
    const btnHtml=btn?btn.innerHTML:"";
    if(btn){btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> កំពុងរក្សាទុក...';}

    try{
        let imageUrl=null;
        try{
            imageUrl=await getSiUploadedImageUrl(err);
            if(err.classList.contains("show") && err.textContent.includes("Upload")){
                return;
            }
        }catch(_){ return; }

        if(stockInEditingId){
            const brochureId=document.getElementById("siBrochureSelect").value;
            if(!date||!brochureId||!Number.isInteger(quantity)||quantity<=0){err.textContent="សូមបំពេញ ថ្ងៃបញ្ចូល, Brochure និងចំនួនឱ្យបានត្រឹមត្រូវ។";err.classList.add("show");return;}
            const item=items.find(i=>i.id===brochureId);
            if(!item){err.textContent="ទិន្នន័យ Brochure មិនត្រឹមត្រូវ។";err.classList.add("show");return;}
            if(imageUrl){
                try{ await db.collection(COLLECTION).doc(brochureId).update({image:imageUrl}); }catch(e){ console.warn(e); }
            }
            await updateStockIn(stockInEditingId,{date,brochureId,quantity,note},err,item);
            return;
        }

        if(siMode==="new"){
            const name=document.getElementById("siBrochureNameNew").value.trim();
            const year=document.getElementById("siYearNew").value.trim();
            if(!date||!name||!year||!Number.isInteger(quantity)||quantity<=0){err.textContent="សូមបំពេញ ថ្ងៃបញ្ចូល, ឈ្មោះ Brochure ថ្មី, ឆ្នាំ និងចំនួនឱ្យបានត្រឹមត្រូវ។";err.classList.add("show");return;}
            await createStockInNewBrochure({date,name,year,quantity,note,image:imageUrl},err);
        }else{
            const brochureId=document.getElementById("siBrochureSelect").value;
            if(!date||!brochureId||!Number.isInteger(quantity)||quantity<=0){err.textContent="សូមបំពេញ ថ្ងៃបញ្ចូល, Brochure និងចំនួនឱ្យបានត្រឹមត្រូវ។";err.classList.add("show");return;}
            const item=items.find(i=>i.id===brochureId);
            if(!item){err.textContent="ទិន្នន័យ Brochure មិនត្រឹមត្រូវ។";err.classList.add("show");return;}
            if(imageUrl){
                try{ await db.collection(COLLECTION).doc(brochureId).update({image:imageUrl}); }catch(e){ console.warn(e); }
            }
            await createStockIn({date,brochureId,quantity,note},err,item);
        }
    }finally{
        if(btn){btn.disabled=false;btn.innerHTML=btnHtml||'<i class="fa-solid fa-floppy-disk"></i> រក្សាទុក Stock In';}
    }
}
async function createStockIn(data,err,item){
    const {date,brochureId,quantity,note}=data;
    const stockRef=db.collection(COLLECTION).doc(brochureId),inRef=db.collection("stockIns").doc();
    try{
        const result=await db.runTransaction(async tx=>{
            const stockSnap=await tx.get(stockRef);if(!stockSnap.exists)throw new Error("ITEM_NOT_FOUND");
            const fresh=stockSnap.data(),current=Number(fresh.unit||0),remaining=current+quantity;
            tx.update(stockRef,{unit:remaining});
            tx.set(inRef,{date,brochureId,brochureName:fresh.name||item.name,year:fresh.year||item.year,quantity,note:note||"",createdAt:Date.now()});
            return {remaining};
        });
        await writeAuditLog({
            action: "create",
            entity: "stockIn",
            entityId: inRef.id,
            entityName: item.name,
            details: `បញ្ចូល ${quantity.toLocaleString()} ក្បាល | ស្តុកសរុបថ្មី ${result.remaining.toLocaleString()}${note ? " | ចំណាំ: "+note : ""}`
        });
        closeStockInModal();alert(`បញ្ចូលស្តុកបានជោគជ័យ!\n\nBrochure: ${item.name}\nចំនួនបញ្ចូល: ${quantity.toLocaleString()} ក្បាល\nស្តុកសរុបថ្មី: ${result.remaining.toLocaleString()} ក្បាល`);goPage("stockin");
    }catch(e){
        console.error(e);
        if(e.message==="ITEM_NOT_FOUND")err.textContent="Brochure នេះលែងមានក្នុងស្តុកទៀតហើយ។";
        else err.textContent="មិនអាចរក្សាទុក Stock In បានទេ។ សូមព្យាយាមម្តងទៀត។";
        err.classList.add("show");
    }
}
// បញ្ចូលស្តុកសម្រាប់ Brochure ថ្មី៖ បង្កើត Brochure ថ្មី (ឬប្រើ Brochure ដែលមានឈ្មោះ+ឆ្នាំដូចគ្នារួចហើយ) រួចបញ្ចូលស្តុកភ្លាមតែម្តង
async function createStockInNewBrochure(data,err){
    const {date,name,year,quantity,note,image}=data;
    try{
        const normalizedName=name.replace(/\s+/g," ").trim().toLowerCase();
        const normalizedYear=year.replace(/\s+/g,"").trim().toLowerCase();

        const existingItem=items.find(item=>{
            const en=String(item.name||"").replace(/\s+/g," ").trim().toLowerCase();
            const ey=String(item.year||"").replace(/\s+/g,"").trim().toLowerCase();
            return en===normalizedName && ey===normalizedYear;
        });

        let brochureId;

        if(existingItem){
            brochureId=existingItem.id;
            if(image){
                try{ await db.collection(COLLECTION).doc(brochureId).update({image}); }catch(e){ console.warn(e); }
            }
        }else{
            const newDocRef=db.collection(COLLECTION).doc();
            const payload={name,year,unit:0,other:"",createdAt:Date.now()};
            if(image) payload.image=image;
            await newDocRef.set(payload);
            brochureId=newDocRef.id;
        }

        const stockRef=db.collection(COLLECTION).doc(brochureId),inRef=db.collection("stockIns").doc();
        const result=await db.runTransaction(async tx=>{
            const stockSnap=await tx.get(stockRef);if(!stockSnap.exists)throw new Error("ITEM_NOT_FOUND");
            const fresh=stockSnap.data(),remaining=Number(fresh.unit||0)+quantity;
            tx.update(stockRef,{unit:remaining});
            tx.set(inRef,{date,brochureId,brochureName:fresh.name||name,year:fresh.year||year,quantity,note:note||"",createdAt:Date.now()});
            return {remaining};
        });

        await writeAuditLog({
            action: "create",
            entity: "stockIn",
            entityId: inRef.id,
            entityName: name,
            details: `បញ្ចូល ${quantity.toLocaleString()} ក្បាល${existingItem?" (បន្ថែមទៅស្តុកមានស្រាប់)":" (Brochure ថ្មី)"} | ស្តុកសរុបថ្មី ${result.remaining.toLocaleString()}${note ? " | ចំណាំ: "+note : ""}`
        });
        if(!existingItem){
            await writeAuditLog({
                action: "create",
                entity: "brochure",
                entityId: brochureId,
                entityName: name,
                details: `បង្កើត Brochure ថ្មីតាម Stock In | ឆ្នាំ ${year}`
            });
        }
        closeStockInModal();
        alert(`បញ្ចូលស្តុកបានជោគជ័យ!\n\nBrochure: ${name}${existingItem?" (បញ្ចូលបន្ថែមទៅស្តុកមានស្រាប់)":" (Brochure ថ្មី)"}\nចំនួនបញ្ចូល: ${quantity.toLocaleString()} ក្បាល\nស្តុកសរុបថ្មី: ${result.remaining.toLocaleString()} ក្បាល`);
        goPage("stockin");
    }catch(e){
        console.error(e);
        err.textContent="មិនអាចរក្សាទុក Stock In សម្រាប់ Brochure ថ្មីបានទេ។ សូមព្យាយាមម្តងទៀត។";
        err.classList.add("show");
    }
}
async function updateStockIn(recordId,data,err,item){
    const {date,brochureId,quantity,note}=data;
    const inRef=db.collection("stockIns").doc(recordId);
    try{
        const result=await db.runTransaction(async tx=>{
            const inSnap=await tx.get(inRef);if(!inSnap.exists)throw new Error("RECORD_NOT_FOUND");
            const old=inSnap.data(),oldBrochureId=old.brochureId,oldQuantity=Number(old.quantity||0);
            if(oldBrochureId===brochureId){
                const stockRef=db.collection(COLLECTION).doc(brochureId);
                const stockSnap=await tx.get(stockRef);if(!stockSnap.exists)throw new Error("ITEM_NOT_FOUND");
                const fresh=stockSnap.data(),withoutOld=Number(fresh.unit||0)-oldQuantity;
                if(withoutOld<0){const e=new Error("WOULD_GO_NEGATIVE");e.available=Number(fresh.unit||0);throw e;}
                const remaining=withoutOld+quantity;
                tx.update(stockRef,{unit:remaining});
                tx.update(inRef,{date,brochureId,brochureName:fresh.name||item.name,year:fresh.year||item.year,quantity,note:note||"",updatedAt:Date.now()});
                return {remaining};
            }else{
                const oldStockRef=db.collection(COLLECTION).doc(oldBrochureId),newStockRef=db.collection(COLLECTION).doc(brochureId);
                const oldStockSnap=await tx.get(oldStockRef),newStockSnap=await tx.get(newStockRef);
                if(!newStockSnap.exists)throw new Error("ITEM_NOT_FOUND");
                if(oldStockSnap.exists){
                    const oldFresh=oldStockSnap.data(),oldWithoutOld=Number(oldFresh.unit||0)-oldQuantity;
                    if(oldWithoutOld<0){const e=new Error("WOULD_GO_NEGATIVE");e.available=Number(oldFresh.unit||0);throw e;}
                    tx.update(oldStockRef,{unit:oldWithoutOld});
                }
                const newFresh=newStockSnap.data(),remaining=Number(newFresh.unit||0)+quantity;
                tx.update(newStockRef,{unit:remaining});
                tx.update(inRef,{date,brochureId,brochureName:newFresh.name||item.name,year:newFresh.year||item.year,quantity,note:note||"",updatedAt:Date.now()});
                return {remaining};
            }
        });
        await writeAuditLog({
            action: "update",
            entity: "stockIn",
            entityId: recordId,
            entityName: item.name,
            details: `កែ Stock In → ចំនួន ${quantity.toLocaleString()} | ស្តុកសរុបថ្មី ${result.remaining.toLocaleString()}${note ? " | ចំណាំ: "+note : ""}`
        });
        closeStockInModal();alert(`កែប្រែ Stock In បានជោគជ័យ!\n\nBrochure: ${item.name}\nចំនួនបញ្ចូល: ${quantity.toLocaleString()} ក្បាល\nស្តុកសរុបថ្មី: ${result.remaining.toLocaleString()} ក្បាល`);goPage("stockin");
    }catch(e){
        console.error(e);
        if(e.message==="WOULD_GO_NEGATIVE")err.textContent=`មិនអាចកែប្រែបានទេ ព្រោះស្តុកបច្ចុប្បន្ន (${Number(e.available||0).toLocaleString()} ក្បាល) មិនគ្រប់ដើម្បីដកចំនួនចាស់ចេញវិញ។ ប្រហែលជាមានការដកស្តុកចេញច្រើនរួចហើយ។`;
        else if(e.message==="ITEM_NOT_FOUND")err.textContent="Brochure នេះលែងមានក្នុងស្តុកទៀតហើយ។";
        else if(e.message==="RECORD_NOT_FOUND")err.textContent="ប្រតិបត្តិការនេះលែងមានទៀតហើយ។ សូមផ្ទុកទំព័រឡើងវិញ។";
        else err.textContent="មិនអាចកែប្រែ Stock In បានទេ។ សូមព្យាយាមម្តងទៀត។";
        err.classList.add("show");
    }
}
async function deleteStockIn(id){
    if(!requireAdmin("លុប Stock In")) return;

    const record=stockIns.find(x=>x.id===id);
    if(!record){alert("រកមិនឃើញប្រតិបត្តិការនេះទេ។");return;}
    const ok=confirm(`តើអ្នកចង់លុបប្រតិបត្តិការនេះមែនទេ?\n\nBrochure: ${record.brochureName}\nចំនួនបញ្ចូល: ${Number(record.quantity||0).toLocaleString()} ក្បាល\n\nស្តុកនឹងត្រូវបានដកចេញវិញតាមចំនួននេះដោយស្វ័យប្រវត្តិ។`);
    if(!ok)return;
    const inRef=db.collection("stockIns").doc(id),stockRef=db.collection(COLLECTION).doc(record.brochureId);
    try{
        await db.runTransaction(async tx=>{
            const inSnap=await tx.get(inRef);if(!inSnap.exists)return;
            const stockSnap=await tx.get(stockRef);
            if(stockSnap.exists){
                const fresh=stockSnap.data();
                const remaining=Math.max(0,Number(fresh.unit||0)-Number(record.quantity||0));
                tx.update(stockRef,{unit:remaining});
            }
            tx.delete(inRef);
        });
        await writeAuditLog({
            action: "delete",
            entity: "stockIn",
            entityId: id,
            entityName: record.brochureName,
            details: `លុប Stock In | ចំនួន ${Number(record.quantity||0).toLocaleString()} ក្បាល`
        });
    }catch(error){
        console.error(error);
        alert("មិនអាចលុបប្រតិបត្តិការនេះបានទេ។ សូមព្យាយាមម្តងទៀត។");
    }
}
function renderStockIn(){
    const c=document.getElementById("stockInContent");if(!c)return;
    const q=(document.getElementById("stockInSearch")?.value||"").toLowerCase().trim();
    let list=q?stockIns.filter(x=>[x.date,x.brochureName,x.year,x.note].some(v=>String(v||"").toLowerCase().includes(q))):[...stockIns];
    const totalAll=list.reduce((a,x)=>a+Number(x.quantity||0),0);
    if(!list.length){c.innerHTML=`<div class="stockout-summary"><div class="stockout-summary-card"><small>ប្រតិបត្តិការសរុប</small><strong>0</strong></div><div class="stockout-summary-card"><small>ចំនួនបញ្ចូលសរុប</small><strong>0</strong></div><div class="stockout-summary-card"><small>ស្ថានភាព</small><strong>—</strong></div></div><div class="empty"><i class="fa-solid fa-dolly"></i><h3>មិនទាន់មាន Stock In</h3><p>ចុច "បន្ថែម Stock In" ដើម្បីកត់ត្រាការបញ្ចូល Brochure ចូលស្តុក។</p></div>`;return;}
    const st=tableState.stockIn;
    list=sortList(list, st.sortKey, st.sortDir);
    const pg=paginateList(list, st.page, st.pageSize);
    st.page=pg.page;
    const rows=pg.slice;
    c.innerHTML=`<div class="stockout-summary"><div class="stockout-summary-card"><small>ប្រតិបត្តិការសរុប</small><strong>${list.length.toLocaleString()}</strong></div><div class="stockout-summary-card"><small>ចំនួនបញ្ចូលសរុប</small><strong>${totalAll.toLocaleString()}</strong></div><div class="stockout-summary-card"><small>បង្ហាញ</small><strong>${rows.length.toLocaleString()}</strong></div></div><div class="data-table-wrap"><table><thead><tr><th>N°</th><th>រូបភាព</th>${sortHeaderHtml("stockIn","date","ថ្ងៃបញ្ចូល")}${sortHeaderHtml("stockIn","brochureName","ឈ្មោះ Brochure")}${sortHeaderHtml("stockIn","year","ឆ្នាំ")}${sortHeaderHtml("stockIn","quantity","ចំនួនបញ្ចូល")}<th>ចំណាំ</th><th>សកម្មភាព</th></tr></thead><tbody>${rows.map((x,i)=>`<tr><td>${pg.start+i+1}</td>${brochureImageCellHtml(x.brochureId, x.brochureName)}<td>${escapeHtml(formatDateDisplay(x.date))}</td><td><strong>${escapeHtml(x.brochureName)}</strong></td><td>${escapeHtml(x.year)}</td><td class="unit">${Number(x.quantity||0).toLocaleString()}</td><td>${escapeHtml(x.note||"")}</td><td class="actions"><button class="action-btn" onclick="openEditStockInModal('${x.id}')"><i class="fa-solid fa-pen"></i> កែ</button><button class="action-btn delete" onclick="deleteStockIn('${x.id}')"><i class="fa-solid fa-trash"></i> លុប</button></td></tr>`).join("")}</tbody></table></div>${buildPagerHtml("stockIn", pg)}`;
}


/* =====================================================
   LOW STOCK ALERTS + EMAIL TO ADMIN
===================================================== */
function getLowStockItems(){
    LOW_STOCK_THRESHOLD = getLowStockThreshold();
    return items
        .filter(i => Number(i.unit || 0) < LOW_STOCK_THRESHOLD)
        .sort((a,b) => Number(a.unit || 0) - Number(b.unit || 0));
}

function getAdminNotifyEmails(){
    const raw = (localStorage.getItem("adminNotifyEmails") || "").trim();
    if(raw){
        return raw.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    }
    // fallback: email របស់អ្នកប្រើបច្ចុប្បន្ន បើជា admin
    if(isAdmin() && currentUser?.email){
        return [currentUser.email];
    }
    return [];
}

function lowStockFingerprint(low){
    return low
        .map(i => `${i.id}:${Number(i.unit||0)}`)
        .sort()
        .join("|");
}

function simpleHash(str){
    let h = 0;
    for(let i = 0; i < str.length; i++){
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h).toString(36);
}

function buildLowStockEmailHtml(low){
    const rows = low.map(i =>
        `<tr>
            <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(i.name)}</td>
            <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(i.year)}</td>
            <td style="padding:8px;border:1px solid #ddd;color:#B94A48;font-weight:700;">${Number(i.unit||0).toLocaleString()}</td>
        </tr>`
    ).join("");
    return `
        <div style="font-family:sans-serif;max-width:560px;">
            <h2 style="color:#B94A48;margin:0 0 8px;">⚠️ ជូនដំណឹងស្តុកជិតអស់</h2>
            <p style="color:#333;">មាន <strong>${low.length}</strong> មុខ Brochure ស្តុកតិចជាង <strong>${LOW_STOCK_THRESHOLD}</strong> ក្បាល។</p>
            <table style="border-collapse:collapse;width:100%;margin-top:12px;">
                <thead>
                    <tr style="background:#F8E3E1;">
                        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Brochure</th>
                        <th style="padding:8px;border:1px solid #ddd;text-align:left;">ឆ្នាំ</th>
                        <th style="padding:8px;border:1px solid #ddd;text-align:left;">នៅសល់</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <p style="color:#68737D;font-size:12px;margin-top:16px;">សារ​នេះ​ផ្ញើ​ស្វ័យប្រវត្តិ​ពី​ប្រព័ន្ធ Brochure Stock Management។</p>
        </div>
    `;
}

function showBrowserLowStockNotification(low){
    if(!("Notification" in window)) return;
    if(Notification.permission !== "granted") return;
    const title = `ស្តុកជិតអស់ — ${low.length} មុខ`;
    const body = low.slice(0, 5).map(i =>
        `${i.name} (${i.year}): ${Number(i.unit||0)} ក្បាល`
    ).join("\n") + (low.length > 5 ? `\n... និង ${low.length - 5} មុខទៀត` : "");
    try{
        const n = new Notification(title, {
            body,
            icon: "assets/logo_NU.png",
            tag: "low-stock-alert"
        });
        n.onclick = () => {
            window.focus();
            goPage("stock");
            n.close();
        };
    }catch(e){
        console.warn("Browser notification error:", e);
    }
}

async function queueLowStockEmail(low){
    const emails = getAdminNotifyEmails();
    if(!emails.length){
        console.warn("No admin notify emails configured.");
        return { ok: false, reason: "no-email" };
    }
    if(!currentUser){
        return { ok: false, reason: "not-signed-in" };
    }

    const day = new Date().toISOString().slice(0, 10);
    const fp = lowStockFingerprint(low);
    const docId = `lowstock_${day}_${simpleHash(fp)}`;
    const ref = db.collection("mail").doc(docId);

    try{
        const existing = await ref.get();
        if(existing.exists){
            return { ok: true, reason: "already-queued" };
        }

        const subject = `[Brochure Stock] ស្តុកជិតអស់ — ${low.length} មុខ (កម្រិត < ${LOW_STOCK_THRESHOLD})`;
        const textLines = low.map(i =>
            `- ${i.name} | ${i.year} | នៅសល់ ${Number(i.unit||0)} ក្បាល`
        ).join("\n");

        await ref.set({
            to: emails,
            message: {
                subject,
                text: `ជូនដំណឹងស្តុកជិតអស់\n\nមាន ${low.length} មុខ Brochure ស្តុកតិចជាង ${LOW_STOCK_THRESHOLD} ក្បាល។\n\n${textLines}\n`,
                html: buildLowStockEmailHtml(low)
            },
            type: "lowStock",
            itemCount: low.length,
            threshold: LOW_STOCK_THRESHOLD,
            fingerprint: fp,
            createdAt: Date.now(),
            createdBy: currentUser.uid,
            createdByEmail: currentUser.email || ""
        });
        return { ok: true, reason: "queued" };
    }catch(e){
        console.error("queueLowStockEmail error:", e);
        return { ok: false, reason: e.message || "error" };
    }
}

async function checkAndNotifyLowStock(low){
    if(!low.length || lowStockNotifyBusy) return;

    const fp = lowStockFingerprint(low);
    const lastFp = localStorage.getItem("lowStockLastFingerprint") || "";
    if(fp === lastFp) return;

    // មានការផ្លាស់ប្តូរថ្មីនៃបញ្ជីស្តុកទាប
    lowStockNotifyBusy = true;
    try{
        showBrowserLowStockNotification(low);
        const result = await queueLowStockEmail(low);
        if(result.ok){
            localStorage.setItem("lowStockLastFingerprint", fp);
            localStorage.setItem("lowStockLastNotifiedAt", String(Date.now()));
            if(result.reason === "queued"){
                console.log("Low-stock email queued for admin.");
            }
        }else if(result.reason === "no-email"){
            // នៅតែចង់ាត់ត្រា fingerprint សម្រាប់ browser notif ដើម្បីមិន spam
            localStorage.setItem("lowStockLastFingerprint", fp);
        }
    }finally{
        lowStockNotifyBusy = false;
    }
}

function updateLowStockAlerts(){
    const low = getLowStockItems();
    const badge = document.getElementById("lowStockBadge");
    if(badge){
        if(low.length){
            badge.style.display = "flex";
            badge.textContent = low.length > 99 ? "99+" : String(low.length);
        }else{
            badge.style.display = "none";
        }
    }
    const list = document.getElementById("lowStockList");
    if(list){
        list.innerHTML = low.length
            ? low.map(i => `<div class="notif-item" onclick="goToLowStockItem('${i.id}')"><div><div class="notif-item-name">${escapeHtml(i.name)}</div><div class="notif-item-year">${escapeHtml(i.year)}</div></div><div class="notif-item-qty">${Number(i.unit||0).toLocaleString()} ក្បាល</div></div>`).join("")
            : `<div class="empty-mini">គ្មានស្តុកជិតអស់ទេ 🎉</div>`;
    }
    const dashCard = document.getElementById("lowStockDashCard");
    if(dashCard){
        if(low.length){
            dashCard.style.display = "block";
            document.getElementById("lowStockDashList").innerHTML = low.map(i =>
                `<div class="low-stock-row"><strong>${escapeHtml(i.name)}</strong><span>${escapeHtml(i.year)}</span><div class="low-stock-qty">${Number(i.unit||0).toLocaleString()} ក្បាល នៅសល់</div></div>`
            ).join("");
            document.getElementById("lowStockDashCount").textContent = low.length;
        }else{
            dashCard.style.display = "none";
        }
    }

    // Alert + ផ្ញើ email (មិន spam — តែពេលបញ្ជីផ្លាស់ប្តូរ)
    if(low.length){
        checkAndNotifyLowStock(low);
    }else{
        localStorage.removeItem("lowStockLastFingerprint");
    }
}

function goToLowStockItem(id){
    document.getElementById("lowStockPanel")?.classList.remove("show");
    goPage("stock");
    const item = items.find(i => i.id === id);
    const search = document.getElementById("search");
    if(search && item){
        search.value = item.name;
        renderStock();
    }
}

function initLowStockSettingsUI(){
    const thrInput = document.getElementById("lowStockThresholdInput");
    const emailInput = document.getElementById("adminNotifyEmailsInput");
    if(thrInput) thrInput.value = String(getLowStockThreshold());
    if(emailInput) emailInput.value = localStorage.getItem("adminNotifyEmails") || (currentUser?.email || "");

    document.getElementById("btnSaveLowStockSettings")?.addEventListener("click", () => {
        const thr = Number(document.getElementById("lowStockThresholdInput")?.value);
        const emails = (document.getElementById("adminNotifyEmailsInput")?.value || "").trim();
        if(!Number.isFinite(thr) || thr < 1){
            alert("សូមបញ្ចូលកម្រិតស្តុកត្រឹមត្រូវ (លេខ ≥ 1)។");
            return;
        }
        localStorage.setItem("lowStockThreshold", String(Math.floor(thr)));
        localStorage.setItem("adminNotifyEmails", emails);
        LOW_STOCK_THRESHOLD = getLowStockThreshold();
        // ឲ្យផ្ញើម្តងទៀតបើចាំបាច់
        localStorage.removeItem("lowStockLastFingerprint");
        updateLowStockAlerts();
        alert("បានរក្សាទុកការកំណត់ស្តុកជិតអស់។");
    });

    document.getElementById("btnEnableBrowserNotif")?.addEventListener("click", async () => {
        if(!("Notification" in window)){
            alert("Browser នេះមិនគាំទ្រ Notification ទេ។");
            return;
        }
        const perm = await Notification.requestPermission();
        if(perm === "granted"){
            alert("បានបើក Browser Notification រួចហើយ។");
            const low = getLowStockItems();
            if(low.length) showBrowserLowStockNotification(low);
        }else{
            alert("អ្នកមិនអនុញ្ញាត Notification។ អាចបើកវិញក្នុង Settings របស់ browser។");
        }
    });
}


/* =====================================================
   PRINT STOCK FUNCTION (ENHANCED PRINT PREVIEW)
===================================================== */
function buildPrintTable(){
    const search = document.getElementById("search")?.value.toLowerCase().trim() || "";

    let filtered = search
        ? items.filter(item =>
            String(item.name).toLowerCase().includes(search) ||
            String(item.year).toLowerCase().includes(search))
        : items;

    if(!filtered.length){
        document.getElementById("printFooter").innerHTML = "";
        return `<div style="text-align:center;padding:30px;color:#666">មិនមានទិន្នន័យសម្រាប់បោះពុម្ព</div>`;
    }

    const groups = {};

    filtered.forEach(item => {
        const year = extractYear(item.year) || "ផ្សេងៗ";
        if(!groups[year]) groups[year] = [];
        groups[year].push(item);
    });

    const keys = Object.keys(groups).sort((a,b) => {
        if(a === "ផ្សេងៗ") return 1;
        if(b === "ផ្សេងៗ") return -1;
        return b - a;
    });

    let grandTotalItems = 0;
    let grandTotalUnits = 0;

    const tableHtml = keys.map(year => {
        const rows = groups[year];
        const subtotal = rows.reduce((s,i) => s + Number(i.unit || 0), 0);

        grandTotalItems += rows.length;
        grandTotalUnits += subtotal;

        return `
            <div class="group">
                <div class="group-band">
                    <div>
                        <div class="group-year">${escapeHtml(String(year))}</div>
                        <div class="group-sub">${rows.length} មុខ</div>
                    </div>
                    <div style="color:white;font-weight:700;font-size:13px">
                        សរុប៖ ${subtotal.toLocaleString()} ក្បាល
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px; text-align:center;">ល.រ</th>
                            <th style="width: 60px; text-align:center;">រូបភាព</th>
                            <th>ឈ្មោះ Brochure</th>
                            <th style="width: 80px; text-align:center;">ឆ្នាំ</th>
                            <th style="width: 100px; text-align:right;">ចំនួនស្តុក</th>
                            <th>ចំណាំ / ផ្សេងៗ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map((item,index) => `
                            <tr>
                                <td style="text-align:center;">${index+1}</td>
                                <td class="brochure-image-cell">
                                    ${item.image
                                        ? `<img class="brochure-thumb" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`
                                        : `<div class="brochure-placeholder"><i class="fa-solid fa-image"></i></div>`}
                                </td>
                                <td><strong>${escapeHtml(item.name)}</strong></td>
                                <td style="text-align:center;">${escapeHtml(item.year)}</td>
                                <td class="unit" style="text-align:right;">${Number(item.unit || 0).toLocaleString()}</td>
                                <td>${escapeHtml(item.other || "-")}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;
    }).join("");

    const footerHtml = `
        <div class="print-footer-summary">
            <div class="sum-item">មុខទំនិញសរុប៖ <strong>${grandTotalItems.toLocaleString()} មុខ</strong></div>
            <div class="sum-item">ចំនួនក្បាលសរុប៖ <strong>${grandTotalUnits.toLocaleString()} ក្បាល</strong></div>
            <div class="sum-item">ប្រព័ន្ធ៖ <strong>Brochure Stock Management</strong></div>
        </div>

        <div class="print-sign-section">
            <div class="print-sign-box">
                <div class="sign-title">អ្នករៀបចំ (Prepared By)</div>
                <div class="sign-line"></div>
            </div>
            <div class="print-sign-box">
                <div class="sign-title">អ្នកពិនិត្យ (Approved By)</div>
                <div class="sign-line"></div>
            </div>
        </div>
    `;

    document.getElementById("printFooter").innerHTML = footerHtml;
    return tableHtml;
}

function printStock(){
    if(!items || !items.length){
        alert("មិនទាន់មានទិន្នន័យស្តុកសម្រាប់បោះពុម្ពទេ។");
        return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("km-KH", {year:"numeric",month:"long",day:"numeric"});
    const timeStr = now.toLocaleTimeString("km-KH", {hour:'2-digit', minute:'2-digit'});

    const printArea = document.getElementById("printArea");
    if(printArea){
        // ១. បង្កើត Structure ទាំងអស់ជាមុនសិន
       // កូដនៅក្នុង function printStock()
printArea.innerHTML = `
    <div class="print-header-container">
        <div style="display: flex; align-items: center; gap: 12px;">
            <img src="assets/logo_NU.png" class="print-logo-img" alt="Logo">
            <div class="print-header-left">
                <h1>របាយការណ៍ស្តុក BROCHURE</h1>
                <p>ប្រព័ន្ធគ្រប់គ្រងស្តុក Brochure (Brochure Stock Management)</p>
            </div>
        </div>
        <div class="print-header-right">
            <div>កាលបរិច្ឆេទបោះពុម្ព៖ <strong>${dateStr}</strong></div>
            <div>ម៉ោង៖ <strong>${timeStr}</strong></div>
        </div>
    </div>
    <div id="printTableContent"></div>
    <div id="printFooter"></div>
`;

        // ២. បញ្ចូល Table content ទៅក្នុង Element ដែលទើបបង្កើត
        const tableHtml = buildPrintTable();
        document.getElementById("printTableContent").innerHTML = tableHtml;

        // ៣. បើក Print Window
        setTimeout(() => {
            window.print();
        }, 250);
    }
}


/* =====================================================
   EXPORT (EXCEL ស្អាតទាក់ទាញ / CSV)
===================================================== */

// ពណ៌ Theme សម្រាប់ Excel (ដូចពណ៌សំខាន់របស់កម្មវិធី)
const EXPORT_COLORS = {
    titleBg:   "FF204C36", // primary-dark
    titleText: "FFFFFFFF",
    subtitleBg:"FFE4F0E9", // primary-light
    subtitleText:"FF2F6D4C",
    headerBg:  "FFC89B3C", // gold
    headerText:"FFFFFFFF",
    stripe:    "FFF6F1E0", // ស្រាលៗ ដូច bg
    border:    "FFD3C393",
    lowStock:  "FFF8E3E1", // danger-light
    lowStockText:"FFB94A48"
};

function exportFileTimestamp(){
    const now = new Date();
    const pad = n => String(n).padStart(2,"0");
    return `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function exportGeneratedAtLabel(){
    const now = new Date();
    const dateStr = now.toLocaleDateString("km-KH", {year:"numeric",month:"long",day:"numeric"});
    const timeStr = now.toLocaleTimeString("km-KH", {hour:'2-digit', minute:'2-digit'});
    return `បង្កើតនៅ៖ ${dateStr}, ម៉ោង ${timeStr}`;
}

function downloadAsCSV(rows, headers, filename){
    if(!rows.length){
        alert("មិនមានទិន្នន័យសម្រាប់នាំចេញទេ។");
        return;
    }

    const escapeCsv = v => {
        const s = String(v ?? "");
        if(/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
        return s;
    };

    const lines = [
        headers.map(escapeCsv).join(","),
        ...rows.map(row => row.map(escapeCsv).join(","))
    ];

    // \uFEFF (BOM) ដើម្បីឲ្យ Excel អាន Unicode/Khmer បានត្រឹមត្រូវ
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * បង្កើតឯកសារ Excel (.xlsx) ដែលមាន Style ពេញលេញ៖
 * - ជួរចំណងជើង ពណ៌ fill + អក្សរស + ទំហំធំ
 * - ជួរ subtitle បង្ហាញកាលបរិច្ឆេទ + ចំនួនកំណត់ត្រា
 * - ជួរក្បាលតារាង highlight ពណ៌មាស + អក្សរដិត + border
 * - ជួរដេកឆ្លាស់ពណ៌ (striped rows) ឲ្យអានស្រួល
 * - ជួរឈរ "ស្តុកទាប" បន្លិចពណ៌ក្រហមស្រាល (បើមាន lowStockCol)
 * - Number format សម្រាប់ជួរឈរជាលេខ + AutoFilter + Freeze ក្បាល
 */
async function downloadAsExcelStyled(rows, headers, filename, sheetName, opts = {}){
    if(!rows.length){
        alert("មិនមានទិន្នន័យសម្រាប់នាំចេញទេ។");
        return;
    }

    if(typeof ExcelJS === "undefined"){
        alert("មិនអាចផ្ទុកបណ្ណាល័យ Excel បានទេ។ សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងម្តងទៀត។");
        return;
    }

    const title = opts.title || sheetName;
    const numberCols = opts.numberCols || [];       // 0-based index នៃជួរឈរជាលេខ
    const lowStockCol = opts.lowStockCol;             // 0-based index នៃជួរឈរស្តុក (សម្រាប់ពិនិត្យទាប)
    const lowStockThreshold = opts.lowStockThreshold ?? LOW_STOCK_THRESHOLD;
    const colWidths = opts.colWidths;                 // array ជម្រើសកំណត់ទទឹងផ្ទាល់ខ្លួន
    const lastCol = headers.length;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Brochure Stock Management";
    workbook.created = new Date();

    const ws = workbook.addWorksheet(sheetName, {
        views: [{state: "frozen", ySplit: 4}]
    });

    // ជួរទី 1: ចំណងជើងធំ
    ws.mergeCells(1, 1, 1, lastCol);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = title;
    titleCell.font = {name:"Calibri", bold:true, size:16, color:{argb:EXPORT_COLORS.titleText}};
    titleCell.fill = {type:"pattern", pattern:"solid", fgColor:{argb:EXPORT_COLORS.titleBg}};
    titleCell.alignment = {horizontal:"center", vertical:"middle"};
    ws.getRow(1).height = 32;

    // ជួរទី 2: subtitle (កាលបរិច្ឆេទ + ចំនួនកំណត់ត្រា)
    ws.mergeCells(2, 1, 2, lastCol);
    const subtitleCell = ws.getCell(2, 1);
    subtitleCell.value = `${exportGeneratedAtLabel()}   |   ចំនួនកំណត់ត្រា៖ ${rows.length.toLocaleString()}`;
    subtitleCell.font = {name:"Calibri", italic:true, size:10, color:{argb:EXPORT_COLORS.subtitleText}};
    subtitleCell.fill = {type:"pattern", pattern:"solid", fgColor:{argb:EXPORT_COLORS.subtitleBg}};
    subtitleCell.alignment = {horizontal:"center", vertical:"middle"};
    ws.getRow(2).height = 22;

    // ជួរទី 3: ជួរទទេតូចមួយសម្រាប់ដកដង្ហើម
    ws.getRow(3).height = 6;

    // ជួរទី 4: ក្បាលតារាង
    const headerRow = ws.getRow(4);
    headers.forEach((h, i) => { headerRow.getCell(i+1).value = h; });
    headerRow.eachCell(cell => {
        cell.font = {name:"Calibri", bold:true, size:11, color:{argb:EXPORT_COLORS.headerText}};
        cell.fill = {type:"pattern", pattern:"solid", fgColor:{argb:EXPORT_COLORS.headerBg}};
        cell.alignment = {horizontal:"center", vertical:"middle"};
        cell.border = {
            top:{style:"thin", color:{argb:EXPORT_COLORS.border}},
            bottom:{style:"thin", color:{argb:EXPORT_COLORS.border}},
            left:{style:"thin", color:{argb:EXPORT_COLORS.border}},
            right:{style:"thin", color:{argb:EXPORT_COLORS.border}}
        };
    });
    headerRow.height = 24;

    // ជួរទិន្នន័យ
    rows.forEach((row, rowIdx) => {
        const excelRow = ws.addRow(row);
        const isLow = lowStockCol !== undefined && Number(row[lowStockCol] || 0) < lowStockThreshold;

        excelRow.eachCell((cell, colNum) => {
            cell.border = {
                top:{style:"thin", color:{argb:EXPORT_COLORS.border}},
                bottom:{style:"thin", color:{argb:EXPORT_COLORS.border}},
                left:{style:"thin", color:{argb:EXPORT_COLORS.border}},
                right:{style:"thin", color:{argb:EXPORT_COLORS.border}}
            };
            cell.alignment = {vertical:"middle", horizontal: numberCols.includes(colNum-1) ? "center" : "left"};

            if(isLow){
                cell.fill = {type:"pattern", pattern:"solid", fgColor:{argb:EXPORT_COLORS.lowStock}};
                if(colNum-1 === lowStockCol) cell.font = {bold:true, color:{argb:EXPORT_COLORS.lowStockText}};
            }else if(rowIdx % 2 === 1){
                cell.fill = {type:"pattern", pattern:"solid", fgColor:{argb:EXPORT_COLORS.stripe}};
            }
        });

        numberCols.forEach(colIdx => {
            excelRow.getCell(colIdx+1).numFmt = "#,##0";
        });
    });

    // ទទឹងជួរឈរ
    ws.columns.forEach((col, i) => {
        if(colWidths && colWidths[i]){
            col.width = colWidths[i];
        }else{
            let maxLen = String(headers[i]).length;
            rows.forEach(r => {
                const len = String(r[i] ?? "").length;
                if(len > maxLen) maxLen = len;
            });
            col.width = Math.min(Math.max(maxLen + 4, 10), 45);
        }
    });

    // AutoFilter លើជួរក្បាល
    ws.autoFilter = {
        from: {row:4, column:1},
        to: {row:4, column:lastCol}
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function closeAllExportMenus(except){
    document.querySelectorAll(".export-menu.show").forEach(menu => {
        if(menu.id !== except) menu.classList.remove("show");
    });
}

function toggleExportMenu(menuId){
    closeAllExportMenus(menuId);
    document.getElementById(menuId)?.classList.toggle("show");
}

function getStockExportRows(){
    const search = (document.getElementById("search")?.value || "").toLowerCase().trim();

    const filtered = search
        ? items.filter(item =>
            String(item.name).toLowerCase().includes(search) ||
            String(item.year).toLowerCase().includes(search)
        )
        : items;

    return [...filtered]
        .sort((a,b) => String(b.year||"").localeCompare(String(a.year||"")) || String(a.name||"").localeCompare(String(b.name||"")))
        .map((item,index) => [
            index+1,
            item.name || "",
            item.year || "",
            Number(item.unit || 0),
            item.other || ""
        ]);
}

async function exportStock(type){
    closeAllExportMenus();

    const headers = ["N°", "ឈ្មោះ Brochure", "ឆ្នាំ", "ចំនួន", "ផ្សេងៗ"];
    const rows = getStockExportRows();
    const stamp = exportFileTimestamp();

    if(type === "xlsx"){
        await downloadAsExcelStyled(rows, headers, `Stock_Brochure_${stamp}.xlsx`, "Stock", {
            title: "បញ្ជីស្តុក Brochure",
            numberCols: [3],
            lowStockCol: 3
        });
    }else{
        downloadAsCSV(rows, headers, `Stock_Brochure_${stamp}.csv`);
    }
}

function getStockOutExportRows(){
    const q = (document.getElementById("stockOutSearch")?.value || "").toLowerCase().trim();

    const list = q
        ? stockOuts.filter(x => [x.date, x.brochureName, x.year, x.departmentName, x.employeeName]
            .some(v => String(v||"").toLowerCase().includes(q)))
        : stockOuts;

    return list.map((x,index) => [
        index+1,
        formatDateDisplay(x.date),
        x.brochureName || "",
        x.year || "",
        x.departmentName || "",
        x.employeeName || "",
        Number(x.quantity || 0)
    ]);
}

async function exportStockOut(type){
    closeAllExportMenus();

    const headers = ["N°", "ថ្ងៃយកចេញ", "ឈ្មោះ Brochure", "ឆ្នាំ", "ផ្នែក", "ឈ្មោះអ្នកយក", "ចំនួនយកចេញ"];
    const rows = getStockOutExportRows();
    const stamp = exportFileTimestamp();

    if(type === "xlsx"){
        await downloadAsExcelStyled(rows, headers, `StockOut_${stamp}.xlsx`, "StockOut", {
            title: "ប្រវត្តិការដកស្តុក (Stock Out)",
            numberCols: [6]
        });
    }else{
        downloadAsCSV(rows, headers, `StockOut_${stamp}.csv`);
    }
}

function getStockInExportRows(){
    const q = (document.getElementById("stockInSearch")?.value || "").toLowerCase().trim();

    const list = q
        ? stockIns.filter(x => [x.date, x.brochureName, x.year, x.note]
            .some(v => String(v||"").toLowerCase().includes(q)))
        : stockIns;

    return list.map((x,index) => [
        index+1,
        formatDateDisplay(x.date),
        x.brochureName || "",
        x.year || "",
        Number(x.quantity || 0),
        x.note || ""
    ]);
}

async function exportStockIn(type){
    closeAllExportMenus();

    const headers = ["N°", "ថ្ងៃបញ្ចូល", "ឈ្មោះ Brochure", "ឆ្នាំ", "ចំនួនបញ្ចូល", "ចំណាំ"];
    const rows = getStockInExportRows();
    const stamp = exportFileTimestamp();

    if(type === "xlsx"){
        await downloadAsExcelStyled(rows, headers, `StockIn_${stamp}.xlsx`, "StockIn", {
            title: "ប្រវត្តិការបញ្ចូលស្តុក (Stock In)",
            numberCols: [4]
        });
    }else{
        downloadAsCSV(rows, headers, `StockIn_${stamp}.csv`);
    }
}


/* =====================================================
   FULL SIZE IMAGE VIEWER
===================================================== */

function viewImage(image, title = "Brochure"){

    if(!image) return;

    const lightbox =
        document.getElementById("imageLightbox");

    const imageElement =
        document.getElementById("fullSizeImage");

    const titleElement =
        document.getElementById("fullSizeImageTitle");

    imageElement.src = image;
    imageElement.alt = title;
    titleElement.textContent = title;

    lightbox.classList.add("show");
    document.body.style.overflow = "hidden";

}

function closeImageViewer(){

    const lightbox =
        document.getElementById("imageLightbox");

    lightbox.classList.remove("show");

    document.getElementById("fullSizeImage").src = "";
    document.getElementById("fullSizeImageTitle").textContent = "";

    document.body.style.overflow = "";

}


function editById(id){

    const item =
        items.find(x => x.id === id);

    if(item)
        openModal(item);

}


/* =====================================================
   DASHBOARD
===================================================== */

function updateDashboard(){

    const totalItems =
        items.length;


    const totalUnits =
        items.reduce(
            (sum,item) =>
                sum + Number(item.unit || 0),
            0
        );


    const years =
        new Set(
            items.map(
                item => extractYear(item.year)
            )
        );


    const yearCount =
        [...years].filter(Boolean).length;


    const average =
        totalItems
        ? Math.round(
            totalUnits / totalItems
        )
        : 0;


    document.getElementById(
        "dashItems"
    ).textContent =
        totalItems.toLocaleString();


    document.getElementById(
        "dashUnits"
    ).textContent =
        totalUnits.toLocaleString();


    document.getElementById(
        "dashYears"
    ).textContent =
        yearCount;


    document.getElementById(
        "dashAverage"
    ).textContent =
        average.toLocaleString();


    renderRecent();

    updateCharts();

}


/* =====================================================
   RECENT
===================================================== */

function renderRecent(){

    const container =
        document.getElementById(
            "recentTable"
        );


    if(!items.length){

        container.innerHTML = `

            <div class="empty">
                មិនទាន់មានទិន្នន័យ
            </div>

        `;

        return;

    }


    const recent =
        [...items]
        .reverse()
        .slice(0,5);


    container.innerHTML = `

        <table>

            <thead>

                <tr>

                    <th>
                        Brochure
                    </th>

                    <th>
                        ឆ្នាំ
                    </th>

                    <th>
                        ចំនួន
                    </th>

                </tr>

            </thead>

            <tbody>

                ${recent.map(item => `

                    <tr>

                        <td>
                            ${escapeHtml(item.name)}
                        </td>

                        <td>
                            ${escapeHtml(item.year)}
                        </td>

                        <td class="unit">
                            ${Number(item.unit || 0).toLocaleString()}
                        </td>

                    </tr>

                `).join("")}

            </tbody>

        </table>

    `;

}


/* =====================================================
   CHART DATA
===================================================== */

function getYearData(){

    const data = {};


    items.forEach(item => {

        const year =
            extractYear(item.year);


        if(!year)
            return;


        if(!data[year])
            data[year] = 0;


        data[year] +=
            Number(item.unit || 0);

    });


    const years =
        Object.keys(data)
        .sort((a,b) => a-b);


    return {

        years,

        values:
            years.map(
                year => data[year]
            )

    };

}


/* =====================================================
   CHARTS
===================================================== */

function updateCharts(){

    const data =
        getYearData();


    const ctx1 =
        document
        .getElementById("yearChart");


    const ctx2 =
        document
        .getElementById("pieChart");


    if(!ctx1 || !ctx2)
        return;


    if(yearChart)
        yearChart.destroy();


    if(pieChart)
        pieChart.destroy();


    const isDark =
        document.body
        .classList
        .contains("dark");


    const textColor =
        isDark
        ? "#DDEAE2"
        : "#26323D";


    yearChart =
        new Chart(ctx1, {

            type:"bar",

            data:{

                labels:data.years,

                datasets:[{

                    label:"ចំនួន Brochure",

                    data:data.values,

                    borderRadius:7,

                    backgroundColor:
                        "#2F6D4C"

                }]

            },

            options:{

                responsive:true,

                maintainAspectRatio:false,

                plugins:{

                    legend:{
                        display:false
                    }

                },

                scales:{

                    x:{

                        ticks:{
                            color:textColor
                        },

                        grid:{
                            display:false
                        }

                    },

                    y:{

                        ticks:{
                            color:textColor
                        },

                        beginAtZero:true

                    }

                }

            }

        });


    pieChart =
        new Chart(ctx2, {

            type:"doughnut",

            data:{

                labels:data.years,

                datasets:[{

                    data:data.values,

                    backgroundColor:[

                        "#2F6D4C",
                        "#C89B3C",
                        "#8B3A3A",
                        "#4E79A7",
                        "#59A14F",
                        "#F28E2B",
                        "#B07AA1"

                    ],

                    borderWidth:2

                }]

            },

            options:{

                responsive:true,

                maintainAspectRatio:false,

                plugins:{

                    legend:{

                        position:"bottom",

                        labels:{
                            color:textColor
                        }

                    }

                }

            }

        });

}


/* =====================================================
   YEARS
===================================================== */

function renderYears(){

    const container =
        document.getElementById(
            "yearCards"
        );


    const data = {};


    items.forEach(item => {

        const year =
            extractYear(item.year);


        if(!year)
            return;


        if(!data[year]){

            data[year] = {

                items:0,

                units:0

            };

        }


        data[year].items++;

        data[year].units +=
            Number(item.unit || 0);

    });


    const years =
        Object.keys(data)
        .sort((a,b) => b-a);


    if(!years.length){

        container.innerHTML = `

            <div class="empty">

                <i class="fa-solid fa-calendar-xmark"></i>

                <h3>
                    មិនទាន់មានឆ្នាំ
                </h3>

            </div>

        `;

        return;

    }


    container.innerHTML =
        years.map(year => `

            <div class="year-card">

                <div class="year-icon">

                    <i class="fa-solid fa-calendar-days"></i>

                </div>

                <h3>
                    ${year}
                </h3>

                <p>
                    ${data[year].items}
                    មុខ Brochure
                </p>

                <strong>

                    ${data[year].units
                        .toLocaleString()}

                    ក្បាល

                </strong>

            </div>

        `).join("");

}


/* =====================================================
   REPORT
===================================================== */

function updateReports(){

    const totalItems =
        items.length;


    const totalUnits =
        items.reduce(
            (s,i) =>
                s + Number(i.unit || 0),
            0
        );


    const yearCount =
        new Set(
            items
            .map(i => extractYear(i.year))
            .filter(Boolean)
        ).size;


    const average =
        totalItems
        ? Math.round(
            totalUnits / totalItems
        )
        : 0;

    const stockOutUnits = stockOuts.reduce((s,x) => s + Number(x.quantity || 0), 0);

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.textContent = val;
    };

    setText("reportItems", totalItems.toLocaleString());
    setText("reportUnits", totalUnits.toLocaleString());
    setText("reportYears", String(yearCount));
    setText("reportAverage", average.toLocaleString());
    setText("reportStockOutCount", stockOuts.length.toLocaleString());
    setText("reportStockOutUnits", stockOutUnits.toLocaleString());

    // --- ផ្នែកយកច្រើនបំផុត ---
    const depMap = {};
    stockOuts.forEach(x => {
        const key = x.departmentId || x.departmentName || "—";
        if(!depMap[key]){
            depMap[key] = {
                name: x.departmentName || "—",
                qty: 0,
                times: 0
            };
        }
        depMap[key].qty += Number(x.quantity || 0);
        depMap[key].times += 1;
    });
    const depRank = Object.values(depMap).sort((a,b) => b.qty - a.qty).slice(0, 15);
    const depEl = document.getElementById("reportByDepartment");
    if(depEl){
        depEl.innerHTML = depRank.length
            ? depRank.map((d, i) => `
                <div class="report-rank">
                    <div class="report-rank-num ${i < 3 ? "top" : ""}">${i + 1}</div>
                    <div class="report-rank-info">
                        <strong>${escapeHtml(d.name)}</strong>
                        <span>${d.times.toLocaleString()} ដង</span>
                    </div>
                    <div class="report-rank-qty">${d.qty.toLocaleString()} ក្បាល</div>
                </div>
            `).join("")
            : `<div class="empty-mini" style="padding:20px;">មិនទាន់មានទិន្នន័យ Stock Out</div>`;
    }

    // --- និយោជិតយកញឹកញាប់ ---
    const empMap = {};
    stockOuts.forEach(x => {
        const key = (x.employeeId || x.employeeName || "—") + "|" + (x.departmentName || "");
        if(!empMap[key]){
            empMap[key] = {
                name: x.employeeName || "—",
                dept: x.departmentName || "—",
                qty: 0,
                times: 0
            };
        }
        empMap[key].qty += Number(x.quantity || 0);
        empMap[key].times += 1;
    });
    const empRank = Object.values(empMap).sort((a,b) => {
        if(b.times !== a.times) return b.times - a.times;
        return b.qty - a.qty;
    }).slice(0, 15);
    const empEl = document.getElementById("reportByEmployee");
    if(empEl){
        empEl.innerHTML = empRank.length
            ? empRank.map((e, i) => `
                <div class="report-rank">
                    <div class="report-rank-num ${i < 3 ? "top" : ""}">${i + 1}</div>
                    <div class="report-rank-info">
                        <strong>${escapeHtml(e.name)}</strong>
                        <span>${escapeHtml(e.dept)} · ${e.times.toLocaleString()} ដង</span>
                    </div>
                    <div class="report-rank-qty">${e.qty.toLocaleString()} ក្បាល</div>
                </div>
            `).join("")
            : `<div class="empty-mini" style="padding:20px;">មិនទាន់មានទិន្នន័យ Stock Out</div>`;
    }
}

/* =====================================================
   BACKUP JSON
===================================================== */
async function backupAllDataJson(){
    const btn = document.getElementById("btnBackupJson");
    const original = btn ? btn.innerHTML : "";
    if(btn){
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> កំពុងនាំចេញ...';
    }
    try{
        // ប្រើទិន្នន័យក្នុង memory + ទាញ audit logs ចុងក្រោយ
        let audits = typeof auditLogs !== "undefined" ? auditLogs : [];
        try{
            const snap = await db.collection("auditLogs").orderBy("createdAt","desc").limit(500).get();
            audits = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }catch(e){
            console.warn("Could not refresh audit logs for backup:", e);
        }

        const payload = {
            exportedAt: new Date().toISOString(),
            app: "Brochure Stock Management",
            counts: {
                brochureItems: items.length,
                stockIns: stockIns.length,
                stockOuts: stockOuts.length,
                departments: departments.length,
                auditLogs: audits.length
            },
            data: {
                brochureItems: items,
                stockIns: stockIns,
                stockOuts: stockOuts,
                departments: departments,
                auditLogs: audits
            }
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g, "-");
        a.href = url;
        a.download = `brochure-stock-backup-${stamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        alert("បាននាំចេញ Backup JSON រួចហើយ។");
    }catch(e){
        console.error(e);
        alert("មិនអាចនាំចេញ Backup បានទេ។");
    }finally{
        if(btn){
            btn.disabled = false;
            btn.innerHTML = original || '<i class="fa-solid fa-download"></i> Download Backup';
        }
    }
}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHtml(value){

    const div =
        document.createElement("div");

    div.textContent =
        value || "";

    return div.innerHTML;

}


/* =====================================================
   EVENTS
===================================================== */

const fImage = document.getElementById("fImage");
const imagePreview = document.getElementById("imagePreview");

if(fImage){
    fImage.addEventListener("change", event => {

        const file = event.target.files[0];

        if(!file){
            return;
        }

        const reader = new FileReader();

        reader.onload = e => {
            imagePreview.src = e.target.result;
            imagePreview.style.display = "block";
        };

        reader.readAsDataURL(file);

    });
}

// document
// .getElementById("btnAdd")
// .addEventListener(
//     "click",
//     () => openModal()
// );


document
.getElementById("btnCancel")
.addEventListener(
    "click",
    closeModal
);


document
.getElementById("btnSave")
.addEventListener(
    "click",
    saveForm
);


document
.getElementById("search")
.addEventListener(
    "input",
    () => {
        tableState.stock.page = 1;
        renderStock();
    }
);


document
.getElementById("overlay")
.addEventListener(
    "click",
    e => {

        if(
            e.target.id === "overlay"
        ){

            closeModal();

        }

    }
);


const imageLightbox =
    document.getElementById("imageLightbox");

const imageLightboxClose =
    document.getElementById("imageLightboxClose");

if(imageLightboxClose){
    imageLightboxClose.addEventListener("click", closeImageViewer);
}

if(imageLightbox){
    imageLightbox.addEventListener("click", e => {
        if(e.target === imageLightbox){
            closeImageViewer();
        }
    });
}


document.getElementById("btnAddStockOut")?.addEventListener("click",()=>openStockOutModal());
document.getElementById("btnRequestStockOut")?.addEventListener("click",()=>openStockOutRequestModal());
document.getElementById("btnCancelStockOut")?.addEventListener("click",closeStockOutModal);
document.getElementById("btnSaveStockOut")?.addEventListener("click",saveStockOut);
document.getElementById("soBrochure")?.addEventListener("change",updateStockOutBrochureInfo);
document.getElementById("soDepartment")?.addEventListener("change",updateStockOutEmployees);
document.getElementById("stockOutSearch")?.addEventListener("input",()=>{tableState.stockOut.page=1;renderStockOut();});
document.getElementById("stockOutOverlay")?.addEventListener("click",e=>{if(e.target.id==="stockOutOverlay")closeStockOutModal();});
document.getElementById("btnAddStockIn")?.addEventListener("click",()=>openStockInModal());
document.getElementById("btnCancelStockIn")?.addEventListener("click",closeStockInModal);
document.getElementById("btnSaveStockIn")?.addEventListener("click",saveStockIn);
document.getElementById("siModeExisting")?.addEventListener("click",()=>setSiMode("existing"));
document.getElementById("siModeNew")?.addEventListener("click",()=>setSiMode("new"));
document.getElementById("siBrochureSelect")?.addEventListener("change",()=>{
    clearSiImageInput();
    updateStockInBrochureInfo();
});
document.getElementById("siImage")?.addEventListener("change", e => {
    const file = e.target.files?.[0];
    const prev = document.getElementById("siImagePreview");
    if(!file || !prev) return;
    const reader = new FileReader();
    reader.onload = ev => {
        prev.src = ev.target.result;
        prev.style.display = "block";
        prev.onclick = () => viewImage(ev.target.result, "Preview");
    };
    reader.readAsDataURL(file);
});
document.getElementById("stockInSearch")?.addEventListener("input",()=>{tableState.stockIn.page=1;renderStockIn();});
document.getElementById("btnBackupJson")?.addEventListener("click",backupAllDataJson);
document.getElementById("stockInOverlay")?.addEventListener("click",e=>{if(e.target.id==="stockInOverlay")closeStockInModal();});
document.getElementById("lowStockBtn")?.addEventListener("click",e=>{e.stopPropagation();document.getElementById("lowStockPanel")?.classList.toggle("show");});
document.addEventListener("click",e=>{const wrap=document.getElementById("notifWrap");if(wrap && !wrap.contains(e.target))document.getElementById("lowStockPanel")?.classList.remove("show");});
document.getElementById("btnAddDepartment")?.addEventListener("click",()=>openDepartmentModal("department"));
document.getElementById("btnAddEmployee")?.addEventListener("click",()=>{if(!departments.length){alert("សូមបន្ថែម Department ជាមុនសិន។");return;}openDepartmentModal("employee");});
document.getElementById("btnCancelDepartment")?.addEventListener("click",closeDepartmentModal);
document.getElementById("btnSaveDepartment")?.addEventListener("click",saveDepartmentForm);
document.getElementById("departmentOverlay")?.addEventListener("click",e=>{if(e.target.id==="departmentOverlay")closeDepartmentModal();});
document.getElementById("btnPrintStock")?.addEventListener("click",printStock);
document.getElementById("btnExportStock")?.addEventListener("click",e=>{e.stopPropagation();toggleExportMenu("stockExportMenu");});
document.getElementById("btnExportStockOut")?.addEventListener("click",e=>{e.stopPropagation();toggleExportMenu("stockOutExportMenu");});
document.getElementById("btnExportStockIn")?.addEventListener("click",e=>{e.stopPropagation();toggleExportMenu("stockInExportMenu");});
document.addEventListener("click",e=>{
    if(!document.getElementById("stockExportWrap")?.contains(e.target)) document.getElementById("stockExportMenu")?.classList.remove("show");
    if(!document.getElementById("stockOutExportWrap")?.contains(e.target)) document.getElementById("stockOutExportMenu")?.classList.remove("show");
    if(!document.getElementById("stockInExportWrap")?.contains(e.target)) document.getElementById("stockInExportMenu")?.classList.remove("show");
});

/* =====================================================
   AUDIT LOG
===================================================== */
const AUDIT_COLLECTION = "auditLogs";
let auditLogs = [];

function getOperatorName(){
    if(currentUserProfile?.displayName) return String(currentUserProfile.displayName).trim();
    if(currentUser?.displayName) return String(currentUser.displayName).trim();
    if(currentUser?.email) return String(currentUser.email).trim();
    return (localStorage.getItem("operatorName") || "").trim() || "មិនស្គាល់";
}

function setOperatorName(name){
    const n = (name || "").trim();
    localStorage.setItem("operatorName", n);
    const input = document.getElementById("operatorNameInput");
    if(input) input.value = n;
}

async function writeAuditLog({ action, entity, entityId = "", entityName = "", details = "", extra = {} }){
    try{
        await db.collection(AUDIT_COLLECTION).add({
            action,
            entity,
            entityId: String(entityId || ""),
            entityName: String(entityName || ""),
            details: String(details || ""),
            operator: getOperatorName(),
            createdAt: Date.now(),
            ...extra
        });
    }catch(e){
        console.error("Audit log error:", e);
    }
}

let _unsubAuditLogs = null;
function listenAuditLogs(){
    if (_unsubAuditLogs) {
        _unsubAuditLogs();
        _unsubAuditLogs = null;
    }
    _unsubAuditLogs = db.collection(AUDIT_COLLECTION)
      .orderBy("createdAt","desc")
      .limit(300)
      .onSnapshot(snapshot => {
          auditLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          if(document.getElementById("audit")?.classList.contains("active")){
              renderAuditLog();
          }
      }, err => console.error("Audit listener error:", err));
}

function actionLabel(a){
    if(a === "create") return "បង្កើត";
    if(a === "update") return "កែប្រែ";
    if(a === "delete") return "លុប";
    return a || "-";
}

function entityLabel(e){
    const map = {
        brochure: "Brochure",
        stockIn: "Stock In",
        stockOut: "Stock Out",
        stockOutRequest: "សំណើ Stock Out",
        department: "Department",
        employee: "Employee"
    };
    return map[e] || e || "-";
}

function formatAuditTime(ts){
    if(!ts) return "-";
    const d = new Date(ts);
    return d.toLocaleString("km-KH", {
        year:"numeric", month:"2-digit", day:"2-digit",
        hour:"2-digit", minute:"2-digit", second:"2-digit"
    });
}

function renderAuditLog(){
    const c = document.getElementById("auditContent");
    if(!c) return;

    const q = (document.getElementById("auditSearch")?.value || "").toLowerCase().trim();
    const actionF = document.getElementById("auditActionFilter")?.value || "";
    const entityF = document.getElementById("auditEntityFilter")?.value || "";

    let list = auditLogs;

    if(actionF) list = list.filter(x => x.action === actionF);
    if(entityF) list = list.filter(x => x.entity === entityF);
    if(q){
        list = list.filter(x =>
            [x.operator, x.entityName, x.details, x.entity, x.action]
            .some(v => String(v||"").toLowerCase().includes(q))
        );
    }

    if(!list.length){
        c.innerHTML = `<div class="empty"><i class="fa-solid fa-clipboard-list"></i><h3>មិនទាន់មាន Audit Log</h3><p>នៅពេលមានការកែ/លុប នឹងបង្ហាញនៅទីនេះ</p></div>`;
        return;
    }

    c.innerHTML = `
        <div class="data-table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>N°</th>
                        <th>ពេលវេលា</th>
                        <th>អ្នកប្រើ</th>
                        <th>សកម្មភាព</th>
                        <th>ប្រភេទ</th>
                        <th>ឈ្មោះ / វត្ថុ</th>
                        <th>ព័ត៌មានលម្អិត</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.map((x,i) => `
                        <tr>
                            <td>${i+1}</td>
                            <td style="white-space:nowrap;font-size:12px;">${escapeHtml(formatAuditTime(x.createdAt))}</td>
                            <td><strong>${escapeHtml(x.operator || "មិនស្គាល់")}</strong></td>
                            <td><span class="audit-badge ${escapeHtml(x.action||"")}">${escapeHtml(actionLabel(x.action))}</span></td>
                            <td>${escapeHtml(entityLabel(x.entity))}</td>
                            <td>${escapeHtml(x.entityName || "-")}</td>
                            <td><div class="audit-detail" title="${escapeHtml(x.details||"")}">${escapeHtml(x.details || "-")}</div></td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

/* Operator name init + events */
(function(){
    const savedOperator = localStorage.getItem("operatorName") || "";
    const opInput = document.getElementById("operatorNameInput");
    if(opInput) opInput.value = savedOperator;

    document.getElementById("btnSaveOperator")?.addEventListener("click", () => {
        const name = document.getElementById("operatorNameInput")?.value.trim();
        if(!name){
            alert("សូមបញ្ចូលឈ្មោះអ្នកប្រើ។");
            return;
        }
        setOperatorName(name);
        alert("បានរក្សាទុកឈ្មោះអ្នកប្រើ៖ " + name);
    });

    document.getElementById("auditSearch")?.addEventListener("input", renderAuditLog);
    document.getElementById("auditActionFilter")?.addEventListener("change", renderAuditLog);
    document.getElementById("auditEntityFilter")?.addEventListener("change", renderAuditLog);

    initLowStockSettingsUI();
})();

/* ESC CLOSE MODAL */

document.addEventListener(
    "keydown",
    e => {

        if(e.key === "Escape"){

            closeModal();
            closeImageViewer();
            closeStockOutModal();
            closeDepartmentModal();
            closeAllExportMenus();

        }

    }
);

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('PWA Service Worker Registered!'))
        .catch(err => console.log('Service Worker Error: ', err));
    });
}

/* =====================================================
   START
===================================================== */

initAuth();