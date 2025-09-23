document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // !! 重要設定 !!
    // 請將此處的 URL 替換為您部署後的 Google Apps Script Web App URL
    // =================================================================
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbyui8ai5x5WhfqPD6iWLVP44lhehlEJJGweFWjC4eI_ZdZNfJQGmaUuJsHFVWjxPnJMLg/exec'; // <-- !! 請務必替換成您自己的 URL !!

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
        html: document.documentElement,
        loadingOverlay: document.getElementById('loading-overlay'),
        loginPage: document.getElementById('login-page'),
        mainContent: document.getElementById('main-content'),
        pages: {
            home: document.getElementById('home-page'),
            form: document.getElementById('form-page'),
            upload: document.getElementById('upload-page'),
            records: document.getElementById('records-page'),
        },
        headerTitle: document.getElementById('header-title'),
        backButton: document.getElementById('back-button'),
        logoutButton: document.getElementById('logout-button'),
    };
    
    // --- 語言翻譯資料 ---
    const translations = {
        zh: { appTitle: "爬蟲飼養記錄", appSubtitle: "專為中學生設計", placeholderUser: "帳戶", placeholderPass: "密碼", login: "登入", loginSuccess: "登入成功！", loginFail: "帳戶或密碼錯誤", homeTitle: "我的爬蟲", feed: "餵食", records: "記錄", camera: "拍照", formTitle: (name) => `為 ${name} 新增記錄`, formDate: "記錄日期", formRecorder: "記錄人", formTemp: "溫度 (°C)", formHumidity: "濕度 (%)", formFed: "有否餵食？", formFoodType: "食物種類", formFoodQty: "食物數量", formWater: "有否換水？", formPoop: "有否清理糞便？", formSubstrate: "有否換底材？", formNotes: "備註", placeholderNotes: "可以在這裡輸入詳細描述...", submit: "提交記錄", submitSuccess: "記錄已成功儲存！", uploadTitle: (name) => `為 ${name} 上傳照片`, uploadClick: "點擊以上傳或拍照", uploadFileType: "支援 JPG, PNG, MP4 等格式", upload: "上傳", uploadSuccess: "檔案上傳成功！", uploadFail: "檔案上傳失敗", recordTitle: (name) => `${name} 的記錄`, recordStatus: "最新狀態概覽", lastFed: "上次餵食", lastWater: "上次換水", lastPoop: "上次清便", lastSubstrate: "上次換底材", recordCalendar: "活動日曆", recordDailyDetail: "當日記錄詳情", noRecord: "這一天沒有記錄喔！", fetchingData: "正在獲取數據...", none: "無", weekdays: ['日', '一', '二', '三', '四', '五', '六'] },
        en: { appTitle: "Reptile Keeper", appSubtitle: "Designed for students", placeholderUser: "Username", placeholderPass: "Password", login: "Login", loginSuccess: "Login Successful!", loginFail: "Incorrect username or password", homeTitle: "My Reptiles", feed: "Feed", records: "Records", camera: "Photo", formTitle: (name) => `New Log for ${name}`, formDate: "Date", formRecorder: "Recorder", formTemp: "Temperature (°C)", formHumidity: "Humidity (%)", formFed: "Fed?", formFoodType: "Food Type", formFoodQty: "Food Quantity", formWater: "Water Changed?", formPoop: "Poop Cleaned?", formSubstrate: "Substrate Changed?", formNotes: "Notes", placeholderNotes: "Enter detailed descriptions here...", submit: "Submit Log", submitSuccess: "Log saved successfully!", uploadTitle: (name) => `Upload for ${name}`, uploadClick: "Click to upload or take a photo", uploadFileType: "Supports JPG, PNG, MP4, etc.", upload: "Upload", uploadSuccess: "File uploaded successfully!", uploadFail: "File upload failed", recordTitle: (name) => `${name}'s Records`, recordStatus: "Latest Status Overview", lastFed: "Last Fed", lastWater: "Last Water Change", lastPoop: "Last Poop Clean", lastSubstrate: "Last Substrate Change", recordCalendar: "Activity Calendar", recordDailyDetail: "Daily Record Details", noRecord: "No records for this day!", fetchingData: "Fetching data...", none: "None", weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }
    };

    // =================================================================
    // === 核心功能函式 (Core Functions) - 無變動 ===
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

    function navigateTo(pageId, onShowCallback) {
        state.currentPage = pageId;
        Object.values(DOMElements.pages).forEach(page => page.style.display = 'none');
        document.getElementById(pageId).style.display = 'block';
        
        const isHomePage = pageId === 'home-page';
        DOMElements.backButton.classList.toggle('hidden', isHomePage);
        DOMElements.logoutButton.parentElement.classList.toggle('hidden', isHomePage);
        
        updateHeaderTitle();
        if (onShowCallback) onShowCallback();
        window.scrollTo(0, 0);
    }
    
    const formatDate = (date) => date.toISOString().split('T')[0];
    
    // =================================================================
    // === 主題與語言切換 (Theme & Language Toggle) - 無變動 ===
    // =================================================================
    function applyTheme(theme) {
        if (theme === 'dark') {
            DOMElements.html.classList.add('dark');
        } else {
            DOMElements.html.classList.remove('dark');
        }
        const isDark = (theme === 'dark');
        document.querySelectorAll('.theme-icon-light').forEach(icon => icon.classList.toggle('hidden', isDark));
        document.querySelectorAll('.theme-icon-dark').forEach(icon => icon.classList.toggle('hidden', !isDark));
    }

    function handleThemeToggle() {
        const newTheme = DOMElements.html.classList.contains('dark') ? 'light' : 'dark';
        localStorage.theme = newTheme;
        applyTheme(newTheme);
    }

    function handleLangToggle() {
        state.language = state.language === 'zh' ? 'en' : 'zh';
        document.querySelectorAll('.lang-toggle').forEach(btn => {
            btn.textContent = state.language === 'zh' ? 'En' : '中';
        });
        updateLanguageUI();
        if (state.currentPage === 'records-page') renderCalendar();
    }

    function updateLanguageUI() {
        const lang = translations[state.language];
        document.querySelectorAll('[data-lang-key]').forEach(el => {
            const key = el.dataset.langKey;
            const value = lang[key];
            if (typeof value === 'function') return; 
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.placeholder !== undefined) el.placeholder = value || '';
            } else {
                el.textContent = value || '';
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
    
    function initTheme() {
        const theme = localStorage.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        applyTheme(theme);
    }

    // =================================================================
    // === 頁面渲染與邏輯 (Page Rendering & Logic) - 無變動 ===
    // =================================================================
    // 此處所有頁面渲染函式 (setupHomePage, renderReptileCards, setupFormPage 等) 保持不變
    function setupLoginPage() {
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const loginButton = document.getElementById('login-button');
        const loginError = document.getElementById('login-error');

        loginButton.addEventListener('click', async () => {
            loginError.textContent = '';
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();
            if (!username || !password) return;
            
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
        const page = DOMElements.pages.home;
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
        if (!reptiles || reptiles.length === 0) {
            listContainer.innerHTML = `<p>目前沒有爬蟲資料。</p>`;
            return;
        }
        reptiles.forEach(reptile => {
            const card = document.createElement('div');
            card.className = "bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden shadow-lg transform hover:scale-105 transition-transform duration-300";
            card.innerHTML = `
                <img class="w-full h-48 object-cover" src="${reptile.ImageURL}" alt="${reptile.Name}" onerror="this.src='https://placehold.co/600x400/333/FFF?text=${reptile.Name}'">
                <div class="p-4">
                    <h2 class="text-2xl font-bold mb-4">${reptile.Name}</h2>
                    <div class="grid grid-cols-3 gap-2 text-center">
                        <button data-action="feed" data-id="${reptile.ID}" data-name="${reptile.Name}" class="p-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition flex flex-col items-center"><svg class="w-6 h-6 mb-1 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 21a9 9 0 000-18h.01M3 13.92a9 9 0 0013.138 5.163M21 13.92a9 9 0 01-13.138 5.163"></path></svg><span class="text-xs font-semibold pointer-events-none" data-lang-key="feed"></span></button>
                        <button data-action="records" data-id="${reptile.ID}" data-name="${reptile.Name}" data-image="${reptile.ImageURL}" class="p-3 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition flex flex-col items-center"><svg class="w-6 h-6 mb-1 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6-13h4m0 0a2 2 0 012 2v2a2 2 0 01-2 2h-4a2 2 0 01-2-2V8a2 2 0 012-2z"></path></svg><span class="text-xs font-semibold pointer-events-none" data-lang-key="records"></span></button>
                        <button data-action="camera" data-id="${reptile.ID}" data-name="${reptile.Name}" class="p-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition flex flex-col items-center"><svg class="w-6 h-6 mb-1 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg><span class="text-xs font-semibold pointer-events-none" data-lang-key="camera"></span></button>
                    </div>
                </div>`;
            listContainer.appendChild(card);
        });
        updateLanguageUI();
    }

    async function setupFormPage() {
        const T = translations[state.language];
        const page = DOMElements.pages.form;
        page.innerHTML = `
            <form id="feeding-form" class="space-y-6">
                <div>
                    <label for="form-date" class="block text-sm font-medium text-gray-700 dark:text-gray-300" data-lang-key="formDate"></label>
                    <input type="date" id="form-date" class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-emerald-500 focus:ring-emerald-500">
                </div>
                <div>
                    <label for="form-recorder" class="block text-sm font-medium text-gray-700 dark:text-gray-300" data-lang-key="formRecorder"></label>
                    <select id="form-recorder" class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"></select>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label for="form-temp" class="block text-sm font-medium text-gray-700 dark:text-gray-300" data-lang-key="formTemp"></label>
                        <input type="number" step="0.1" id="form-temp" class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-emerald-500 focus:ring-emerald-500">
                    </div>
                    <div>
                        <label for="form-humidity" class="block text-sm font-medium text-gray-700 dark:text-gray-300" data-lang-key="formHumidity"></label>
                        <input type="number" step="1" id="form-humidity" class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-emerald-500 focus:ring-emerald-500">
                    </div>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300" data-lang-key="formFed"></span>
                    <label for="form-fed-toggle" class="inline-flex relative items-center cursor-pointer">
                        <input type="checkbox" id="form-fed-toggle" class="sr-only peer">
                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-emerald-600"></div>
                    </label>
                </div>
                <div id="food-details" class="space-y-4 hidden pt-4 border-t border-gray-200 dark:border-gray-600">
                    <div>
                        <label for="form-food-type" class="block text-sm font-medium text-gray-700 dark:text-gray-300" data-lang-key="formFoodType"></label>
                        <select id="form-food-type" class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"></select>
                    </div>
                    <div>
                        <label for="form-food-quantity" class="block text-sm font-medium text-gray-700 dark:text-gray-300" data-lang-key="formFoodQty"></label>
                        <input type="number" step="1" id="form-food-quantity" class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-emerald-500 focus:ring-emerald-500">
                    </div>
                </div>
                <div class="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                    ${['Water', 'Poop', 'Substrate'].map(item => `
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300" data-lang-key="form${item}"></span>
                        <input type="checkbox" id="form-${item.toLowerCase()}-changed" class="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500">
                    </div>
                    `).join('')}
                </div>
                <div>
                    <label for="form-notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300" data-lang-key="formNotes"></label>
                    <textarea id="form-notes" rows="3" class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-emerald-500 focus:ring-emerald-500" placeholder="${T.placeholderNotes}"></textarea>
                </div>
                <button type="submit" class="w-full bg-emerald-500 text-white font-bold py-3 rounded-lg hover:bg-emerald-600 transition-transform transform active:scale-95" data-lang-key="submit"></button>
            </form>
        `;
        
        document.getElementById('form-date').value = formatDate(new Date());

        const fedToggle = document.getElementById('form-fed-toggle');
        const foodDetails = document.getElementById('food-details');
        fedToggle.addEventListener('change', () => {
            foodDetails.classList.toggle('hidden', !fedToggle.checked);
        });

        Promise.all([gasApi('getFoodOptions'), gasApi('getRecorders')]).then(([foodOptions, recorderOptions]) => {
            const foodSelect = document.getElementById('form-food-type');
            const recorderSelect = document.getElementById('form-recorder');
            
            if (foodOptions) {
                state.foodOptions = foodOptions;
                foodSelect.innerHTML = foodOptions.map(f => `<option value="${f.FoodName}">${f.FoodName} (${f.Unit})</option>`).join('');
            }
            if (recorderOptions) {
                state.recorderOptions = recorderOptions;
                recorderSelect.innerHTML = recorderOptions.map(r => `<option value="${r.Name}" ${r.Name === state.currentUser ? 'selected' : ''}>${r.Name}</option>`).join('');
            }
        });
        
        updateLanguageUI();
    }

    async function setupUploadPage() {
        const T = translations[state.language];
        const page = DOMElements.pages.upload;
        page.innerHTML = `
            <div class="flex flex-col items-center space-y-4">
                <label for="file-upload" class="cursor-pointer w-full p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                    <svg class="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                    <p class="mt-2 font-semibold" data-lang-key="uploadClick"></p>
                    <p class="text-xs text-gray-500" data-lang-key="uploadFileType"></p>
                </label>
                <input id="file-upload" type="file" class="hidden" accept="image/*,video/*">
                
                <div id="file-preview-container" class="w-full hidden">
                    <p class="font-semibold text-sm mb-2">預覽:</p>
                    <img id="image-preview" class="max-w-full rounded-lg mx-auto">
                    <p id="file-name" class="text-center text-sm mt-2 text-gray-500"></p>
                </div>
                
                <button id="upload-button" class="w-full bg-amber-500 text-white font-bold py-3 rounded-lg hover:bg-amber-600 transition-transform transform active:scale-95 hidden" data-lang-key="upload"></button>
            </div>
        `;

        const fileInput = document.getElementById('file-upload');
        const previewContainer = document.getElementById('file-preview-container');
        const imagePreview = document.getElementById('image-preview');
        const fileNameEl = document.getElementById('file-name');
        const uploadButton = document.getElementById('upload-button');

        let fileToUpload = null;

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            fileToUpload = file;
            fileNameEl.textContent = file.name;
            
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    imagePreview.src = event.target.result;
                };
                reader.readAsDataURL(file);
            } else {
                imagePreview.src = 'https://placehold.co/600x400/333/FFF?text=Video';
            }

            previewContainer.classList.remove('hidden');
            uploadButton.classList.remove('hidden');
        });

        uploadButton.addEventListener('click', async () => {
            if (!fileToUpload) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64Data = event.target.result.split(',')[1];
                const payload = {
                    reptileName: state.currentReptile.name,
                    recorder: state.currentUser,
                    fileName: fileToUpload.name,
                    mimeType: fileToUpload.type,
                    base64Data: base64Data
                };
                const result = await gasApi('uploadFile', payload);
                if (result && result.success) {
                    alert(T.uploadSuccess);
                    navigateTo('home-page', setupHomePage);
                } else {
                    alert(T.uploadFail);
                }
            };
            reader.readAsDataURL(fileToUpload);
        });
        
        updateLanguageUI();
    }

    async function setupRecordsPage() {
        const page = DOMElements.pages.records;
        page.innerHTML = `
            <div class="text-center mb-6">
                <img id="record-reptile-img" class="w-32 h-32 rounded-full mx-auto object-cover shadow-lg border-4 border-white dark:border-gray-800" src="${state.currentReptile.imageUrl}" onerror="this.src='https://placehold.co/200x200/333/FFF?text=${state.currentReptile.name}'">
            </div>
            <div id="latest-status" class="mb-8 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg"></div>
            <h3 class="text-xl font-bold mb-4 text-center" data-lang-key="recordCalendar"></h3>
            <div id="calendar-container" class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg"></div>
            <h3 class="text-xl font-bold mt-8 mb-4 text-center" data-lang-key="recordDailyDetail"></h3>
            <div id="daily-details" class="space-y-3 min-h-[5rem]"></div>
        `;

        updateLanguageUI();
        
        const [status, recordDates] = await Promise.all([
            gasApi('getLatestStatus', { reptileName: state.currentReptile.name }),
            gasApi('getRecordDates', { reptileName: state.currentReptile.name })
        ]);
        
        if (status) renderLatestStatus(status);
        if (recordDates) state.recordDates = new Set(recordDates);

        renderCalendar();
    }
    
    function renderLatestStatus(status) {
        const T = translations[state.language];
        const container = document.getElementById('latest-status');
        const items = [
            { key: 'lastFed', label: T.lastFed, value: status.lastFed, detail: status.lastFedDetail },
            { key: 'lastWater', label: T.lastWater, value: status.lastWater },
            { key: 'lastPoop', label: T.lastPoop, value: status.lastPoop },
            { key: 'lastSubstrate', label: T.lastSubstrate, value: status.lastSubstrate },
        ];
        container.innerHTML = `
            <h3 class="text-xl font-bold mb-4 text-center" data-lang-key="recordStatus"></h3>
            <div class="grid grid-cols-2 gap-4">
            ${items.map(item => `
                <div class="p-3 bg-white dark:bg-gray-600 rounded-md shadow-sm">
                    <p class="text-sm text-gray-500 dark:text-gray-400">${item.label}</p>
                    <p class="font-bold text-lg">${item.value || T.none}</p>
                    ${item.detail ? `<p class="text-xs text-gray-400">${item.detail}</p>` : ''}
                </div>
            `).join('')}
            </div>
        `;
        updateLanguageUI();
    }

    function renderCalendar() {
        const T = translations[state.language];
        const container = document.getElementById('calendar-container');
        const date = state.currentCalendarDate;
        const year = date.getFullYear();
        const month = date.getMonth();

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let calendarHTML = `
            <div class="flex justify-between items-center mb-2">
                <button id="prev-month" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">&lt;</button>
                <h4 class="font-bold">${year} / ${month + 1}</h4>
                <button id="next-month" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">&gt;</button>
            </div>
            <div class="grid grid-cols-7 text-center text-xs font-bold text-gray-500 dark:text-gray-400">
                ${T.weekdays.map(day => `<div>${day}</div>`).join('')}
            </div>
            <div class="grid grid-cols-7 text-center mt-2">
        `;
        
        for (let i = 0; i < firstDay; i++) {
            calendarHTML += `<div></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasRecord = state.recordDates.has(currentDateStr);
            calendarHTML += `
                <div class="p-1">
                    <button data-date="${currentDateStr}" class="day-cell w-8 h-8 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800 transition relative">
                        ${day}
                        ${hasRecord ? '<span class="calendar-dot"></span>' : ''}
                    </button>
                </div>
            `;
        }
        
        calendarHTML += `</div>`;
        container.innerHTML = calendarHTML;
    }
    
    async function renderDailyDetails(dateStr) {
        const T = translations[state.language];
        const container = document.getElementById('daily-details');
        container.innerHTML = `<p>${T.fetchingData}</p>`;
        
        const records = await gasApi('getRecordsByDate', { reptileName: state.currentReptile.name, date: dateStr });

        if (!records || records.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500">${T.noRecord}</p>`;
            return;
        }

        container.innerHTML = records.map(rec => `
            <div class="p-3 bg-white dark:bg-gray-600 rounded-lg shadow-sm">
                <p class="text-xs text-gray-400">${rec.Recorder} @ ${rec.Timestamp.split(' ')[1]}</p>
                <div class="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
                    ${rec.Fed ? `<p><strong>${T.formFoodType}:</strong> ${rec.FoodType} (${rec.FoodQuantity})</p>` : ''}
                    <p><strong>${T.formTemp}:</strong> ${rec.Temperature}°C</p>
                    <p><strong>${T.formHumidity}:</strong> ${rec.Humidity}%</p>
                    <p><strong>${T.formWater}:</strong> ${rec.WaterChanged ? '✔' : '✘'}</p>
                    <p><strong>${T.formPoop}:</strong> ${rec.CleanedPoop ? '✔' : '✘'}</p>
                    <p><strong>${T.formSubstrate}:</strong> ${rec.SubstrateChanged ? '✔' : '✘'}</p>
                </div>
                ${rec.Notes ? `<p class="text-sm mt-2 pt-2 border-t border-gray-200 dark:border-gray-500">${rec.Notes}</p>` : ''}
            </div>
        `).join('');
    }

    // =================================================================
    // === 事件監聽器 (Event Listeners) ===
    // =================================================================
    
    function setupEventListeners() {
        document.querySelectorAll('.theme-toggle').forEach(btn => {
            btn.addEventListener('click', handleThemeToggle);
        });
        document.querySelectorAll('.lang-toggle').forEach(btn => {
            btn.addEventListener('click', handleLangToggle);
        });

        DOMElements.backButton.addEventListener('click', () => navigateTo('home-page', setupHomePage));
        DOMElements.logoutButton.addEventListener('click', () => window.location.reload());

        DOMElements.pages.home.addEventListener('click', e => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            
            const { action, id, name, image } = button.dataset;
            state.currentReptile = { id, name, imageUrl: image };
            
            if (action === 'feed') navigateTo('form-page', setupFormPage);
            if (action === 'camera') navigateTo('upload-page', setupUploadPage);
            if (action === 'records') navigateTo('records-page', setupRecordsPage);
        });
        
        DOMElements.pages.form.addEventListener('submit', async e => {
            if (e.target.id !== 'feeding-form') return;
            e.preventDefault();
            const T = translations[state.language];
            const isFed = document.getElementById('form-fed-toggle').checked;
            const formData = {
                reptileName: state.currentReptile.name,
                date: document.getElementById('form-date').value,
                recorder: document.getElementById('form-recorder').value,
                temperature: document.getElementById('form-temp').value,
                humidity: document.getElementById('form-humidity').value,
                fed: isFed,
                foodType: isFed ? document.getElementById('form-food-type').value : '',
                foodQuantity: isFed ? document.getElementById('form-food-quantity').value : '',
                waterChanged: document.getElementById('form-water-changed').checked,
                cleanedPoop: document.getElementById('form-poop-changed').checked,
                substrateChanged: document.getElementById('form-substrate-changed').checked,
                notes: document.getElementById('form-notes').value,
            };
            
            console.log("將要提交的記錄資料 (Submitting log data):", formData);

            const result = await gasApi('submitLog', formData);
            if (result && result.success) {
                alert(T.submitSuccess);
                navigateTo('home-page', setupHomePage);
            }
        });

        DOMElements.pages.records.addEventListener('click', e => {
            const button = e.target.closest('button');
            if (!button) return;
            
            if (button.id === 'prev-month') {
                state.currentCalendarDate.setMonth(state.currentCalendarDate.getMonth() - 1);
                renderCalendar();
            } else if (button.id === 'next-month') {
                state.currentCalendarDate.setMonth(state.currentCalendarDate.getMonth() + 1);
                renderCalendar();
            } else if (button.classList.contains('day-cell')) {
                const dateStr = button.dataset.date;
                document.querySelectorAll('.day-cell.bg-emerald-500').forEach(el => el.classList.remove('bg-emerald-500', 'text-white'));
                button.classList.add('bg-emerald-500', 'text-white');
                renderDailyDetails(dateStr);
            }
        });
    }

    // =================================================================
    // === 應用程式初始化 (App Initialization) ===
    // =================================================================
    function init() {
        initTheme();
        DOMElements.loginPage.style.display = 'flex';
        setupLoginPage();
        setupEventListeners();
        updateLanguageUI();
    }

    init();
});

