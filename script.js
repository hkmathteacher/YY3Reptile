document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // !! 重要設定 !!
    // 請將此處的 URL 替換為您部署後的 Google Apps Script Web App URL
    // =================================================================
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbwP7e6JBeMu6KbiFyWo3m_Mn4sovcU1B3vhAeTokixTGjwjyyemSsQEuGbLSFmqZQ5S/exec';

    // --- 全域狀態管理 ---
    const state = {
        currentPage: 'login-page',
        currentUser: null,
        currentReptile: { id: null, name: null, imageUrl: null },
        reptiles: [],
        foodOptions: [],
        recorderOptions: [],
        recordDates: new Set(),
        currentCalendarDate: new Date(),
        language: 'zh'
    };

    // --- DOM 元素快取 ---
    const DOMElements = {
        loadingOverlay: document.getElementById('loading-overlay'),
        loginPage: document.getElementById('login-page'),
        mainContent: document.getElementById('main-content'),
        pages: document.querySelectorAll('.page'),
        headerTitle: document.getElementById('header-title'),
        backButton: document.getElementById('back-button'),
        logoutButton: document.getElementById('logout-button'),
        themeToggle: document.getElementById('theme-toggle'),
        langToggle: document.getElementById('lang-toggle'),
        themeIconLight: document.getElementById('theme-icon-light'),
        themeIconDark: document.getElementById('theme-icon-dark'),
    };
    
    // --- 語言翻譯資料 ---
    const translations = {
        zh: { appTitle: "爬蟲飼養記錄", appSubtitle: "專為中學生設計", placeholderUser: "帳戶", placeholderPass: "密碼", login: "登入", loginSuccess: "登入成功！", loginFail: "帳戶或密碼錯誤", homeTitle: "我的爬蟲", feed: "餵食", records: "記錄", camera: "拍照", formTitle: (name) => `為 ${name} 新增記錄`, formDate: "記錄日期", formRecorder: "記錄人", formTemp: "溫度 (°C)", formHumidity: "濕度 (%)", formFed: "有否餵食？", formFoodType: "食物種類", formFoodQty: "食物數量", formWater: "有否換水？", formPoop: "有否清理糞便？", formSubstrate: "有否換底材？", formNotes: "備註", placeholderNotes: "可以在這裡輸入詳細描述...", submit: "提交記錄", submitSuccess: "記錄已成功儲存！", uploadTitle: (name) => `為 ${name} 上傳照片`, uploadClick: "點擊以上傳或拍照", uploadFileType: "支援 JPG, PNG, MP4 等格式", upload: "上傳", uploadSuccess: "檔案上傳成功！", uploadFail: "檔案上傳失敗", recordTitle: (name) => `${name} 的記錄`, recordStatus: "最新狀態概覽", lastFed: "上次餵食", lastWater: "上次換水", lastPoop: "上次清便", lastSubstrate: "上次換底材", recordCalendar: "活動日曆", recordDailyDetail: "當日記錄詳情", noRecord: "這一天沒有記錄喔！", fetchingData: "正在獲取數據...", none: "無", weekdays: ['日', '一', '二', '三', '四', '五', '六'] },
        en: { appTitle: "Reptile Keeper", appSubtitle: "Designed for students", placeholderUser: "Username", placeholderPass: "Password", login: "Login", loginSuccess: "Login Successful!", loginFail: "Incorrect username or password", homeTitle: "My Reptiles", feed: "Feed", records: "Records", camera: "Photo", formTitle: (name) => `New Log for ${name}`, formDate: "Date", formRecorder: "Recorder", formTemp: "Temperature (°C)", formHumidity: "Humidity (%)", formFed: "Fed?", formFoodType: "Food Type", formFoodQty: "Food Quantity", formWater: "Water Changed?", formPoop: "Poop Cleaned?", formSubstrate: "Substrate Changed?", formNotes: "Notes", placeholderNotes: "Enter detailed descriptions here...", submit: "Submit Log", submitSuccess: "Log saved successfully!", uploadTitle: (name) => `Upload for ${name}`, uploadClick: "Click to upload or take a photo", uploadFileType: "Supports JPG, PNG, MP4, etc.", upload: "Upload", uploadSuccess: "File uploaded successfully!", uploadFail: "File upload failed", recordTitle: (name) => `${name}'s Records`, recordStatus: "Latest Status Overview", lastFed: "Last Fed", lastWater: "Last Water Change", lastPoop: "Last Poop Clean", lastSubstrate: "Last Substrate Change", recordCalendar: "Activity Calendar", recordDailyDetail: "Daily Record Details", noRecord: "No records for this day!", fetchingData: "Fetching data...", none: "None", weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }
    };

    // =================================================================
    // === 核心功能函式 (Core Functions) ===
    // =================================================================

    const showLoading = () => DOMElements.loadingOverlay.classList.remove('hidden');
    const hideLoading = () => DOMElements.loadingOverlay.classList.add('hidden');

    async function gasApi(action, payload) {
        if (GAS_URL.includes('YOUR_DEPLOYMENT_ID')) {
             alert('請先在 JavaScript 程式碼中設定您的 Google Apps Script URL！');
             return;
        }
        showLoading();
        try {
            const response = await fetch(GAS_URL, { method: 'POST', redirect: "follow", headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, payload }) });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();
            if (result.status === 'success') return result.data;
            else throw new Error(result.message || 'Unknown API error');
        } catch (error) {
            console.error(`API Error on action [${action}]:`, error);
            alert(`發生錯誤：${error.message}`);
            return null;
        } finally {
            hideLoading();
        }
    }

    function updateLanguage() {
        const lang = translations[state.language];
        DOMElements.langToggle.textContent = state.language === 'zh' ? 'En' : '中';
        document.querySelectorAll('[data-lang-key]').forEach(el => {
            const key = el.dataset.langKey;
            const value = lang[key];
            if (typeof value === 'function') return; 
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.placeholder) el.placeholder = value;
            } else {
                el.textContent = value;
            }
        });
        updateHeaderTitle();
    }
    
    function updateHeaderTitle() {
        const T = translations[state.language];
        let title = '';
        switch(state.currentPage) {
            case 'home-page': title = T.homeTitle; break;
            case 'form-page': title = T.formTitle(state.currentReptile.name); break;
            case 'upload-page': title = T.uploadTitle(state.currentReptile.name); break;
            case 'records-page': title = T.recordTitle(state.currentReptile.name); break;
        }
        DOMElements.headerTitle.textContent = title;
    }

    function navigateTo(pageId, onShowCallback) {
        state.currentPage = pageId;
        DOMElements.pages.forEach(page => page.style.display = 'none');
        document.getElementById(pageId).style.display = 'block';
        
        const isHomePage = pageId === 'home-page';
        DOMElements.backButton.classList.toggle('hidden', isHomePage);
        DOMElements.logoutButton.classList.toggle('hidden', !isHomePage);
        
        updateHeaderTitle();
        if (onShowCallback) onShowCallback();
        window.scrollTo(0, 0);
    }
    
    const formatDate = (date) => date.toISOString().split('T')[0];
    
    // =================================================================
    // === 主題切換 (Theme Toggle) - 優化後邏輯 ===
    // =================================================================

    function applyTheme(theme) {
        const isDark = theme === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
        DOMElements.themeIconLight.classList.toggle('hidden', isDark);
        DOMElements.themeIconDark.classList.toggle('hidden', !isDark);
    }

    function handleThemeToggle() {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        localStorage.theme = newTheme;
        applyTheme(newTheme);
    }
    
    function initTheme() {
        let theme = localStorage.theme;
        if (!theme) {
            theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        applyTheme(theme);
    }


    // =================================================================
    // === 頁面渲染與邏輯 (Page Rendering & Logic) ===
    // =================================================================

    function setupLoginPage() {
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const loginButton = document.getElementById('login-button');
        const loginError = document.getElementById('login-error');

        loginButton.addEventListener('click', async () => {
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();
            if (!username || !password) {
                loginError.textContent = translations[state.language].loginFail;
                return;
            }
            const result = await gasApi('login', { username, password });
            if (result && result.success) {
                state.currentUser = result.username;
                DOMElements.loginPage.style.display = 'none';
                DOMElements.mainContent.style.display = 'block';
                navigateTo('home-page', setupHomePage);
            } else {
                loginError.textContent = translations[state.language].loginFail;
            }
        });
    }

    async function setupHomePage() {
        const page = document.getElementById('home-page');
        page.innerHTML = `<div id="reptile-list" class="grid grid-cols-1 sm:grid-cols-2 gap-4"></div>`;
        const listContainer = document.getElementById('reptile-list');
        listContainer.innerHTML = `<p>${translations[state.language].fetchingData}</p>`;
        
        const reptiles = await gasApi('getReptiles');
        if (reptiles) {
            state.reptiles = reptiles;
            renderReptileCards(reptiles);
        } else {
            listContainer.innerHTML = `<p>無法載入爬蟲列表。</p>`;
        }
    }

    function renderReptileCards(reptiles) {
        const listContainer = document.getElementById('reptile-list');
        listContainer.innerHTML = '';
        reptiles.forEach(reptile => {
            const card = document.createElement('div');
            card.className = "bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden shadow-lg transform hover:scale-105 transition-transform duration-300";
            card.innerHTML = `
                <img class="w-full h-48 object-cover" src="${reptile.ImageURL}" alt="${reptile.Name}" onerror="this.src='https://placehold.co/600x400/333/FFF?text=${reptile.Name}'">
                <div class="p-4">
                    <h2 class="text-2xl font-bold mb-4">${reptile.Name}</h2>
                    <div class="grid grid-cols-3 gap-2 text-center">
                        <button data-action="feed" data-id="${reptile.ID}" data-name="${reptile.Name}" class="p-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition flex flex-col items-center"><svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 21a9 9 0 000-18h.01M3 13.92a9 9 0 0013.138 5.163M21 13.92a9 9 0 01-13.138 5.163"></path></svg><span class="text-xs font-semibold" data-lang-key="feed"></span></button>
                        <button data-action="records" data-id="${reptile.ID}" data-name="${reptile.Name}" data-image="${reptile.ImageURL}" class="p-3 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition flex flex-col items-center"><svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6-13h4m0 0a2 2 0 012 2v2a2 2 0 01-2 2h-4a2 2 0 01-2-2V8a2 2 0 012-2z"></path></svg><span class="text-xs font-semibold" data-lang-key="records"></span></button>
                        <button data-action="camera" data-id="${reptile.ID}" data-name="${reptile.Name}" class="p-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition flex flex-col items-center"><svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg><span class="text-xs font-semibold" data-lang-key="camera"></span></button>
                    </div>
                </div>`;
            listContainer.appendChild(card);
        });
        updateLanguage();
    }
    
    // 省略其他頁面渲染函式 (內容與上一版相同)
    // setupFormPage, setupUploadPage, setupRecordsPage...

    // =================================================================
    // === 事件監聽器 (Event Listeners) ===
    // =================================================================
    
    DOMElements.themeToggle.addEventListener('click', handleThemeToggle);

    DOMElements.langToggle.addEventListener('click', () => {
        state.language = state.language === 'zh' ? 'en' : 'zh';
        updateLanguage();
    });
    
    DOMElements.backButton.addEventListener('click', () => navigateTo('home-page', setupHomePage));
    
    DOMElements.logoutButton.addEventListener('click', () => {
        // 使用 location.reload() 重新整理頁面，是返回登入頁最簡單可靠的方式
        window.location.reload();
    });

    document.getElementById('home-page').addEventListener('click', e => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;
        
        const { action, id, name, image } = button.dataset;
        state.currentReptile = { id, name, imageUrl: image };
        
        if (action === 'feed') navigateTo('form-page', async () => { /* setupFormPage aync logic */ });
        if (action === 'camera') navigateTo('upload-page', () => { /* setupUploadPage logic */ });
        if (action === 'records') navigateTo('records-page', async () => { /* setupRecordsPage aync logic */ });
    });
    
    // 省略表單、上傳、日曆等事件監聽器 (內容與上一版相同)

    // =================================================================
    // === 應用程式初始化 (App Initialization) ===
    // =================================================================
    function init() {
        initTheme(); // 初始化主題
        DOMElements.loginPage.style.display = 'flex';
        setupLoginPage();
        updateLanguage();
    }

    init();
});
// **注意**: 為了方便展示，上面 JS 程式碼有省略部分未修改的函式和事件監聽器。
// 您應該將此程式碼與您上一版的完整 JS 程式碼進行對比，
// 主要關注新增的 `Theme Toggle` 區塊和 `init` 函式的變化。
