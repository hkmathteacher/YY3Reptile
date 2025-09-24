document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // !! 重要設定 !!
    // 請將此處的 URL 替換為您部署後的 Google Apps Script Web App URL
    // =================================================================
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbzlP7DwYPVG9WDcx4N3OsA2P4dNoUqbv-A9etQ_Q8tyrU89Z_YbeCfNr5ZxZLo4j5p8Eg/exec'; // <-- !! 請務必替換成您自己的 URL !!

    // --- 全域狀態管理 ---
    const state = {
        currentPage: 'login-page',
        currentUser: null,
        currentReptile: { id: null, name: null, imageUrl: null },
        language: 'zh'
    };

    // --- DOM 元素快取 ---
    const DOMElements = {
        html: document.documentElement,
        body: document.body,
        loadingOverlay: document.getElementById('loading-overlay'),
        loginPage: document.getElementById('login-page'),
        mainContent: document.getElementById('main-content'),
        logoutButton: document.getElementById('logout-button'),
        pages: {
            home: document.getElementById('home-page'),
            form: document.getElementById('form-page'),
            upload: document.getElementById('upload-page'),
            records: document.getElementById('records-page'),
        },
        headerTitle: document.getElementById('header-title'),
        backButton: document.getElementById('back-button'),
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
        if (GAS_URL.includes('YOUR_GAS_URL_HERE')) {
             alert('請先在 JavaScript 檔案中設定您的 Google Apps Script URL！');
             return null;
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
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.style.display = 'block';
        }
        DOMElements.backButton.classList.toggle('hidden', pageId === 'home-page');
        updateHeaderTitle();
        if (onShowCallback) onShowCallback();
        window.scrollTo(0, 0);
    }
    
    const formatDate = (date) => date.toISOString().split('T')[0];
    
    // =================================================================
    // === 主題與語言切換 (Theme & Language Toggle) ===
    // =================================================================
    function applyTheme(theme) {
        DOMElements.html.classList.toggle('dark', theme === 'dark');
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
        updateLanguageUI();
    }

    function updateLanguageUI(container = document) {
        const lang = translations[state.language];
        document.querySelectorAll('.lang-toggle').forEach(btn => {
            btn.textContent = state.language === 'zh' ? 'En' : '中';
        });

        container.querySelectorAll('[data-lang-key]').forEach(el => {
            const key = el.dataset.langKey;
            const value = lang[key];
            if (typeof value === 'function') return; 
            
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                 if (el.type === 'submit' || el.type === 'button') {
                     el.value = value || '';
                 } else {
                     el.placeholder = value || '';
                 }
            } else {
                el.textContent = value || '';
            }
        });
        updateHeaderTitle();
        if (state.currentPage === 'records-page') {
             const calContainer = document.getElementById('calendar-container');
             if (calContainer && calContainer.innerHTML) renderCalendar(calContainer);
        }
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
    // === 頁面渲染與邏輯 (Page Rendering & Logic) ===
    // =================================================================
    async function handleLogin() {
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const loginError = document.getElementById('login-error');

        loginError.textContent = '';
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        if (!username || !password) return;
        
        const result = await gasApi('login', { username, password });
        if (result && result.success) {
            state.currentUser = result.username;
            DOMElements.loginPage.style.display = 'none';
            DOMElements.mainContent.style.display = 'flex';
            DOMElements.logoutButton.classList.remove('hidden');
            navigateTo('home-page', setupHomePage);
        } else {
            loginError.textContent = translations[state.language].loginFail;
        }
    }
    
    async function setupHomePage() {
        const page = DOMElements.pages.home;
        page.innerHTML = `<div id="reptile-list" class="grid grid-cols-1 sm:grid-cols-2 gap-4"></div>`;
        const listContainer = document.getElementById('reptile-list');
        listContainer.innerHTML = `<p class="text-center">${translations[state.language].fetchingData}</p>`;
        
        const reptiles = await gasApi('getReptiles');
        if (reptiles) {
            renderReptileCards(reptiles, listContainer);
        } else {
            listContainer.innerHTML = `<p class="text-center">無法載入爬蟲列表。</p>`;
        }
    }

    function renderReptileCards(reptiles, container) {
        container.innerHTML = '';
        if (!reptiles || reptiles.length === 0) {
            container.innerHTML = `<p class="text-center">目前沒有爬蟲資料。</p>`;
            return;
        }
        reptiles.forEach(reptile => {
            const card = document.createElement('div');
            card.className = "rounded-xl overflow-hidden shadow-lg transform hover:scale-105 transition-transform duration-300";
            card.style.backgroundColor = 'var(--bg-card)';
            card.innerHTML = `
                <img class="w-full h-48 object-cover" src="${reptile.ImageURL}" alt="${reptile.Name}" onerror="this.src='https.placehold.co/600x400/555/FFF?text=${reptile.Name}'">
                <div class="p-4">
                    <h2 class="text-2xl font-bold mb-4" style="color: var(--text-header);">${reptile.Name}</h2>
                    <div class="grid grid-cols-3 gap-2 text-center">
                        <button data-action="feed" data-id="${reptile.ID}" data-name="${reptile.Name}" class="p-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition flex flex-col items-center"><svg class="w-6 h-6 mb-1 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 21a9 9 0 000-18h.01M3 13.92a9 9 0 0013.138 5.163M21 13.92a9 9 0 01-13.138 5.163"></path></svg><span class="text-xs font-semibold pointer-events-none" data-lang-key="feed"></span></button>
                        <button data-action="records" data-id="${reptile.ID}" data-name="${reptile.Name}" data-image="${reptile.ImageURL}" class="p-3 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition flex flex-col items-center"><svg class="w-6 h-6 mb-1 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6-13h4m0 0a2 2 0 012 2v2a2 2 0 01-2 2h-4a2 2 0 01-2-2V8a2 2 0 012-2z"></path></svg><span class="text-xs font-semibold pointer-events-none" data-lang-key="records"></span></button>
                        <button data-action="camera" data-id="${reptile.ID}" data-name="${reptile.Name}" class="p-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition flex flex-col items-center"><svg class="w-6 h-6 mb-1 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg><span class="text-xs font-semibold pointer-events-none" data-lang-key="camera"></span></button>
                    </div>
                </div>`;
            container.appendChild(card);
        });
        updateLanguageUI(container);
    }
    
    async function setupFormPage() {
        const page = DOMElements.pages.form;
        page.innerHTML = `<form id="feeding-form" class="space-y-6 p-4 rounded-lg shadow-md" style="background-color: var(--bg-card);"></form>`;
        const form = page.querySelector('#feeding-form');

        form.innerHTML = `
            <div><label for="form-date" class="block text-sm font-medium" data-lang-key="formDate"></label><input type="date" id="form-date" style="background-color: var(--bg-input); border-color: var(--border-color); color: var(--text-main);" class="mt-1 block w-full rounded-md border shadow-sm focus:border-emerald-500 focus:ring-emerald-500"></div>
            <div><label for="form-recorder" class="block text-sm font-medium" data-lang-key="formRecorder"></label><select id="form-recorder" style="background-color: var(--bg-input); border-color: var(--border-color); color: var(--text-main);" class="mt-1 block w-full rounded-md border shadow-sm focus:border-emerald-500 focus:ring-emerald-500"></select></div>
            <div class="grid grid-cols-2 gap-4">
                <div><label for="form-temp" class="block text-sm font-medium" data-lang-key="formTemp"></label><input type="number" step="0.1" id="form-temp" style="background-color: var(--bg-input); border-color: var(--border-color); color: var(--text-main);" class="mt-1 block w-full rounded-md border shadow-sm"></div>
                <div><label for="form-humidity" class="block text-sm font-medium" data-lang-key="formHumidity"></label><input type="number" step="1" id="form-humidity" style="background-color: var(--bg-input); border-color: var(--border-color); color: var(--text-main);" class="mt-1 block w-full rounded-md border shadow-sm"></div>
            </div>
            <div class="flex items-center justify-between"><span class="font-medium" data-lang-key="formFed"></span><label class="inline-flex relative items-center cursor-pointer"><input type="checkbox" id="form-fed-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div></label></div>
            <div id="food-details" class="space-y-4 hidden pt-4" style="border-top: 1px solid var(--border-color);">
                 <div><label for="form-food-type" class="block text-sm font-medium" data-lang-key="formFoodType"></label><select id="form-food-type" style="background-color: var(--bg-input); border-color: var(--border-color); color: var(--text-main);" class="mt-1 block w-full rounded-md border shadow-sm"></select></div>
                 <div><label for="form-food-quantity" class="block text-sm font-medium" data-lang-key="formFoodQty"></label><input type="number" step="1" id="form-food-quantity" style="background-color: var(--bg-input); border-color: var(--border-color); color: var(--text-main);" class="mt-1 block w-full rounded-md border shadow-sm"></div>
            </div>
            <div class="space-y-3 pt-4" style="border-top: 1px solid var(--border-color);">
                ${['Water', 'Poop', 'Substrate'].map(item => `<div class="flex items-center justify-between"><span data-lang-key="form${item}"></span><input type="checkbox" id="form-${item.toLowerCase()}-changed" class="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"></div>`).join('')}
            </div>
            <div><label for="form-notes" class="block text-sm font-medium" data-lang-key="formNotes"></label><textarea id="form-notes" rows="3" style="background-color: var(--bg-input); border-color: var(--border-color); color: var(--text-main);" class="mt-1 block w-full rounded-md border shadow-sm" data-lang-key="placeholderNotes"></textarea></div>
            <button type="submit" class="w-full bg-emerald-500 text-white font-bold py-3 rounded-lg hover:bg-emerald-600 transition-transform transform active:scale-95" data-lang-key="submit"></button>
        `;
        
        document.getElementById('form-date').value = formatDate(new Date());

        Promise.all([gasApi('getFoodOptions'), gasApi('getRecorders')]).then(([foodOptions, recorderOptions]) => {
            const foodSelect = document.getElementById('form-food-type');
            const recorderSelect = document.getElementById('form-recorder');
            if (foodOptions && foodSelect) foodSelect.innerHTML = foodOptions.map(f => `<option value="${f.FoodName}">${f.FoodName} (${f.Unit})</option>`).join('');
            if (recorderOptions && recorderSelect) recorderSelect.innerHTML = recorderOptions.map(r => `<option value="${r.Name}" ${r.Name === state.currentUser ? 'selected' : ''}>${r.Name}</option>`).join('');
        });
        
        updateLanguageUI(page);
    }

    async function handleFormSubmit() {
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
        
        const result = await gasApi('submitLog', formData);
        if (result && result.success) {
            alert(T.submitSuccess);
            navigateTo('home-page', setupHomePage);
        }
    }

    async function setupUploadPage() {
        const page = DOMElements.pages.upload;
        page.innerHTML = `
            <div class="flex flex-col items-center space-y-4 p-4 rounded-lg shadow-md" style="background-color: var(--bg-card);">
                <label for="file-upload" class="cursor-pointer w-full p-8 border-2 border-dashed rounded-lg text-center transition" style="border-color: var(--border-color); color: var(--text-secondary);">
                    <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                    <p class="mt-2 font-semibold" data-lang-key="uploadClick"></p>
                    <p class="text-xs" data-lang-key="uploadFileType"></p>
                </label>
                <input id="file-upload" type="file" class="hidden" accept="image/*,video/*">
                <div id="file-preview-container" class="w-full hidden"><p class="font-semibold text-sm mb-2">預覽:</p><img id="image-preview" class="max-w-full rounded-lg mx-auto"><p id="file-name" class="text-center text-sm mt-2" style="color: var(--text-secondary);"></p></div>
                <button id="upload-button" class="w-full bg-amber-500 text-white font-bold py-3 rounded-lg hover:bg-amber-600 transition-transform transform active:scale-95 hidden" data-lang-key="upload"></button>
            </div>
        `;
        updateLanguageUI(page);
    }
    
    async function handleFileUpload(file) {
        if (!file) return;
        const T = translations[state.language];
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64Data = event.target.result.split(',')[1];
            const payload = {
                reptileName: state.currentReptile.name,
                recorder: state.currentUser,
                fileName: file.name,
                mimeType: file.type,
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
        reader.readAsDataURL(file);
    }

    async function setupRecordsPage() {
        console.log("--- 正在設定記錄頁面 ---");
        const T = translations[state.language];
        const page = DOMElements.pages.records;

        // 1. 設定頁面基本結構，包含載入中的提示
        page.innerHTML = `
            <div class="space-y-6">
                <div class="text-center"><img class="w-32 h-32 rounded-full mx-auto object-cover shadow-lg border-4" style="border-color: var(--bg-card);" src="${state.currentReptile.imageUrl}" onerror="this.src='https.placehold.co/200x200/555/FFF?text=${state.currentReptile.name}'"></div>
                <div id="latest-status" class="p-4 rounded-lg shadow-md" style="background-color: var(--bg-card);"><p class="text-center">${T.fetchingData}</p></div>
                <div id="calendar-card" class="p-4 rounded-lg shadow-md" style="background-color: var(--bg-card);"><h3 class="text-xl font-bold mb-4 text-center" data-lang-key="recordCalendar"></h3><div id="calendar-container"><p class="text-center">${T.fetchingData}</p></div></div>
                <div id="details-card" class="p-4 rounded-lg shadow-md" style="background-color: var(--bg-card);"><h3 class="text-xl font-bold mb-4 text-center" data-lang-key="recordDailyDetail"></h3><div id="daily-details" class="space-y-3 min-h-[5rem]"><p class="text-center">${T.fetchingData}</p></div></div>
            </div>
        `;
        updateLanguageUI(page);

        // 2. 獲取必要的 DOM 元素
        const statusContainer = document.getElementById('latest-status');
        const calContainer = document.getElementById('calendar-container');

        // 3. 分別獲取並渲染各部分數據，確保順序正確
        console.log("正在獲取最新狀態...");
        gasApi('getLatestStatus', { reptileName: state.currentReptile.name }).then(status => {
            if (status && statusContainer) {
                console.log("成功獲取最新狀態，正在渲染:", status);
                renderLatestStatus(status, statusContainer);
            } else if (statusContainer) {
                console.error("獲取最新狀態失敗。");
                statusContainer.innerHTML = `<p class="text-center text-red-500">無法載入最新狀態。</p>`;
            }
        });

        console.log("正在獲取記錄日期...");
        gasApi('getRecordDates', { reptileName: state.currentReptile.name }).then(recordDates => {
            if (recordDates && calContainer) {
                console.log("成功獲取記錄日期，正在渲染日曆:", recordDates);
                state.recordDates = new Set(recordDates);
                state.currentCalendarDate = new Date();
                renderCalendar(calContainer);
                
                const todayStr = formatDate(new Date());
                console.log("正在渲染今日 (" + todayStr + ") 的詳細記錄...");
                renderDailyDetails(todayStr); 
                
                // 使用 setTimeout 確保 DOM 更新後再選擇元素
                setTimeout(() => {
                    const todayButton = calContainer.querySelector(`button[data-date="${todayStr}"]`);
                    if (todayButton) {
                        console.log("正在標示今日按鈕。");
                        todayButton.classList.add('bg-emerald-500', 'text-white');
                    }
                }, 0);

            } else if (calContainer) {
                console.error("獲取記錄日期失敗。");
                calContainer.innerHTML = `<p class="text-center text-red-500">無法載入日曆資料。</p>`;
                const detailsContainer = document.getElementById('daily-details');
                if(detailsContainer) detailsContainer.innerHTML = '';
            }
        });
        console.log("--- 記錄頁面設定完畢 ---");
    }
    
    function renderLatestStatus(status, container) {
        const T = translations[state.language];
        const items = [
            { label: T.lastFed, value: status.lastFed, detail: status.lastFedDetail },
            { label: T.lastWater, value: status.lastWater },
            { label: T.lastPoop, value: status.lastPoop },
            { label: T.lastSubstrate, value: status.lastSubstrate },
        ];
        container.innerHTML = `
            <h3 class="text-xl font-bold mb-4 text-center" data-lang-key="recordStatus"></h3>
            <div class="grid grid-cols-2 gap-4">
            ${items.map(item => `<div class="p-3 rounded-md" style="background-color: var(--bg-main);"><p class="text-sm" style="color: var(--text-secondary);">${item.label}</p><p class="font-bold text-lg">${item.value || T.none}</p>${item.detail ? `<p class="text-xs" style="color: var(--text-secondary);">${item.detail}</p>` : ''}</div>`).join('')}
            </div>
        `;
        updateLanguageUI(container);
    }

    function renderCalendar(container) {
        const T = translations[state.language];
        const date = state.currentCalendarDate;
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        container.innerHTML = `
            <div class="flex justify-between items-center mb-2"><button id="prev-month" class="p-2 rounded-full" style="background-color: var(--bg-hover);">&lt;</button><h4 class="font-bold">${year} / ${month + 1}</h4><button id="next-month" class="p-2 rounded-full" style="background-color: var(--bg-hover);">&gt;</button></div>
            <div class="grid grid-cols-7 text-center text-xs font-bold" style="color: var(--text-secondary);">${T.weekdays.map(day => `<div>${day}</div>`).join('')}</div>
            <div class="grid grid-cols-7 text-center mt-2">${Array(firstDay).fill('<div></div>').join('')}${Array.from({length: daysInMonth}, (_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const hasRecord = state.recordDates.has(dateStr);
                return `<div class="p-1"><button data-date="${dateStr}" class="day-cell w-8 h-8 rounded-full transition relative">${day}${hasRecord ? '<span class="calendar-dot"></span>' : ''}</button></div>`;
            }).join('')}</div>
        `;
    }
    
    async function renderDailyDetails(dateStr) {
        const T = translations[state.language];
        const container = document.getElementById('daily-details');
        if (!container) return;
        container.innerHTML = `<p class="text-center">${T.fetchingData}</p>`;
        
        const records = await gasApi('getRecordsByDate', { reptileName: state.currentReptile.name, date: dateStr });

        if (!records || records.length === 0) {
            container.innerHTML = `<p class="text-center" style="color: var(--text-secondary);">${T.noRecord}</p>`;
            return;
        }

        container.innerHTML = records.map(rec => {
            const timestamp = rec.Timestamp ? new Date(rec.Timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            return `
            <div class="p-3 rounded-lg" style="background-color: var(--bg-main);">
                <p class="text-xs" style="color: var(--text-secondary);">${rec.Recorder} @ ${timestamp}</p>
                <div class="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
                    ${rec.Fed ? `<p><strong>${T.formFoodType}:</strong> ${rec.FoodType} (${rec.FoodQuantity})</p>` : ''}
                    <p><strong>${T.formTemp}:</strong> ${rec.Temperature}°C</p><p><strong>${T.formHumidity}:</strong> ${rec.Humidity}%</p>
                    <p><strong>${T.formWater}:</strong> ${rec.WaterChanged ? '✔' : '✘'}</p><p><strong>${T.formPoop}:</strong> ${rec.CleanedPoop ? '✔' : '✘'}</p>
                    <p><strong>${T.formSubstrate}:</strong> ${rec.SubstrateChanged ? '✔' : '✘'}</p>
                </div>
                ${rec.Notes ? `<p class="text-sm mt-2 pt-2" style="border-top: 1px solid var(--border-color);">${rec.Notes}</p>` : ''}
            </div>
        `}).join('');
    }

    // =================================================================
    // === 【核心】事件委派 (Event Delegation) ===
    // =================================================================
    function setupGlobalEventListener() {
        DOMElements.body.addEventListener('click', e => {
            const target = e.target;
            const button = target.closest('button');
            if (!button) return;

            // --- 全域按鈕 ---
            if (button.closest('.theme-toggle')) handleThemeToggle();
            if (button.closest('.lang-toggle')) handleLangToggle();
            if (button.id === 'back-button') navigateTo('home-page', setupHomePage);
            if (button.id === 'logout-button') window.location.reload();
            if (button.id === 'login-button') handleLogin();
            
            // --- 主頁面按鈕 (爬蟲卡片) ---
            if (button.dataset.action && button.closest('#home-page')) {
                const { action, id, name, image } = button.dataset;
                state.currentReptile = { id, name, imageUrl: image };
                if (action === 'feed') navigateTo('form-page', setupFormPage);
                if (action === 'camera') navigateTo('upload-page', setupUploadPage);
                if (action === 'records') navigateTo('records-page', setupRecordsPage);
            }

            // --- 上傳頁面按鈕 ---
            if (button.id === 'upload-button') {
                const fileInput = document.getElementById('file-upload');
                if (fileInput && fileInput.files[0]) handleFileUpload(fileInput.files[0]);
            }

            // --- 記錄頁面日曆按鈕 ---
            const calContainer = button.closest('#calendar-container');
            if (calContainer) {
                if (button.id === 'prev-month') {
                    state.currentCalendarDate.setMonth(state.currentCalendarDate.getMonth() - 1);
                    renderCalendar(calContainer);
                } else if (button.id === 'next-month') {
                    state.currentCalendarDate.setMonth(state.currentCalendarDate.getMonth() + 1);
                    renderCalendar(calContainer);
                } else if (button.classList.contains('day-cell')) {
                    document.querySelectorAll('.day-cell.bg-emerald-500').forEach(el => {
                        el.classList.remove('bg-emerald-500', 'text-white');
                    });
                    button.classList.add('bg-emerald-500', 'text-white');
                    renderDailyDetails(button.dataset.date);
                }
            }
        });

        DOMElements.body.addEventListener('submit', e => {
            if (e.target.id === 'feeding-form') {
                e.preventDefault();
                handleFormSubmit();
            }
        });

        DOMElements.body.addEventListener('change', e => {
            const target = e.target;
            if (target.id === 'form-fed-toggle') {
                document.getElementById('food-details').classList.toggle('hidden', !target.checked);
            }
            if (target.id === 'file-upload') {
                const file = target.files[0];
                if (!file) return;
                document.getElementById('file-name').textContent = file.name;
                const preview = document.getElementById('image-preview');
                preview.src = file.type.startsWith('image/') ? URL.createObjectURL(file) : 'https://placehold.co/600x400/555/FFF?text=Video';
                document.getElementById('file-preview-container').classList.remove('hidden');
                document.getElementById('upload-button').classList.remove('hidden');
            }
        });
    }

    // =================================================================
    // === 應用程式初始化 (App Initialization) ===
    // =================================================================
    function init() {
        initTheme();
        updateLanguageUI();
        setupGlobalEventListener();
    }

    init();
});


