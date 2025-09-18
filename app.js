document.addEventListener('DOMContentLoaded', () => {
    // PWA Service Worker 註冊 (使用相對路徑)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(() => console.log('Service Worker 已註冊'))
            .catch(error => console.log('Service Worker 註冊失敗:', error));
    }

    // ===============================================================
    // 設定
    // ===============================================================
    // ！！！！請務必換成您自己部署後的 Google Apps Script Web App URL
    const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxDxGdP0G-zd-aqsWdHBzVBf2RjCoUXaB2xTcUV9K8O91Fvwerp_jDGdgv8VdycBHQR/exec';

    // ===============================================================
    // DOM 元素獲取
    // ===============================================================
    const views = {
        login: document.getElementById('login-view'),
        dashboard: document.getElementById('dashboard-view'),
        calendar: document.getElementById('calendar-view')
    };
    const loginBtn = document.getElementById('login-btn');
    const logForm = document.getElementById('log-form');
    const calendarEl = document.getElementById('calendar');
    const modal = document.getElementById('details-modal');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.querySelector('.close-button');
    const reptileSidebarList = document.getElementById('reptile-list-sidebar');
    const reptileMobileSelector = document.getElementById('reptile-selector-mobile');
    const formReptileSelector = document.getElementById('reptile-name');

    let calendar; // 用於存放 FullCalendar 實例
    let currentReptiles = []; // 用於存放爬蟲列表

    // ===============================================================
    // 事件監聽
    // ===============================================================
    loginBtn.addEventListener('click', handleLogin);
    logForm.addEventListener('submit', handleFormSubmit);
    
    // 導航按鈕
    document.getElementById('show-calendar-btn').addEventListener('click', () => showView('calendar'));
    document.getElementById('back-to-dashboard-btn').addEventListener('click', () => showView('dashboard'));
    
    // 日曆篩選器變更時，重新載入數據
    document.getElementById('calendar-reptile-filter').addEventListener('change', loadCalendarData);

    // Modal 關閉按鈕
    closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });
    
    // 響應式選單同步
    reptileSidebarList.addEventListener('click', handleSidebarClick);
    reptileMobileSelector.addEventListener('change', handleMobileSelectorChange);

    // ===============================================================
    // 主要函式
    // ===============================================================
    
    /**
     * 處理登入邏輯
     */
    async function handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorMsg = document.getElementById('error-message');

        if (!username || !password) {
            errorMsg.textContent = '請輸入帳號和密碼。';
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = '登入中...';
        errorMsg.textContent = '';

        try {
            const response = await callGAS('login', { username, password });
            if (response.data.authenticated) {
                showView('dashboard');
                await loadDashboard();
                initializeCalendar();
            } else {
                errorMsg.textContent = response.data.message || '登入失敗。';
            }
        } catch (error) {
            errorMsg.textContent = '請求失敗，請檢查網絡連線或聯繫管理員。';
            console.error('Login error:', error);
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = '登入';
        }
    }

    /**
     * 處理表單提交
     */
    async function handleFormSubmit(e) {
        e.preventDefault();
        const submitBtn = document.getElementById('submit-btn');
        const statusEl = document.getElementById('submit-status');

        submitBtn.disabled = true;
        statusEl.textContent = '提交中，請稍候...';

        const formData = new FormData(logForm);
        const formDataObj = Object.fromEntries(formData.entries());

        const fileInput = document.getElementById('file-upload');
        let filePayload = {};
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            filePayload = {
                fileData: await toBase64(file),
                fileName: file.name,
                fileMimeType: file.type
            };
        }

        try {
            const response = await callGAS('submitLog', { formData: formDataObj, ...filePayload });
            statusEl.textContent = response.data.message;
            statusEl.style.color = 'green';
            logForm.reset();
            document.getElementById('record-date').valueAsDate = new Date(); // 重設日期為今天
        } catch (error) {
            statusEl.textContent = `提交失敗: ${error.message}`;
            statusEl.style.color = 'var(--error-color)';
            console.error('Submit error:', error);
        } finally {
            submitBtn.disabled = false;
            setTimeout(() => { statusEl.textContent = ''; }, 5000);
        }
    }

    /**
     * 載入儀表板初始數據 (爬蟲和記錄人列表)
     */
    async function loadDashboard() {
        const response = await callGAS('getInitialData');
        const { reptiles, loggers } = response.data;
        currentReptiles = reptiles;

        // 填充下拉選單
        populateDropdown('logger-name', loggers);
        populateDropdown('calendar-reptile-filter', reptiles);
        
        // 填充表單中的爬蟲選單（雖然它會被同步，但先填充好）
        populateDropdown('reptile-name', reptiles);

        // 填充響應式選單
        populateDropdown(reptileMobileSelector, reptiles);
        populateSidebar(reptiles);
        
        // 預設選中第一個爬蟲
        if (reptiles.length > 0) {
            setActiveReptile(reptiles[0]);
        }
        
        // 設定預設日期為今天
        document.getElementById('record-date').valueAsDate = new Date();
    }
    
    /**
     * 初始化日曆
     */
    function initializeCalendar() {
        if (calendar) return; // 如果已初始化，則不再執行

        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            events: [],
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: ''
            },
            dayCellDidMount: function(arg) {
                // 為有事件的日子添加標記
                const eventsOnDay = calendar.getEvents().filter(event => {
                    const eventDate = new Date(event.start).toISOString().split('T')[0];
                    const cellDate = arg.date.toISOString().split('T')[0];
                    return eventDate === cellDate;
                });

                if (eventsOnDay.length > 0) {
                    // 只取第一個事件的狀態作為代表
                    const status = eventsOnDay[0].extendedProps.status;
                    const marker = document.createElement('div');
                    marker.className = `calendar-marker ${status}-marker`;
                    arg.el.querySelector('.fc-daygrid-day-frame').appendChild(marker);
                }
            },
            dateClick: function(info) {
                const eventsOnDay = calendar.getEvents().filter(event => {
                    const eventDate = new Date(event.start).toISOString().split('T')[0];
                    return eventDate === info.dateStr;
                });
                
                if (eventsOnDay.length > 0) {
                    showDetailsModal(eventsOnDay[0].extendedProps.details);
                }
            },
            // 月份改變時重新載入數據
            datesSet: function() {
                loadCalendarData();
            }
        });
        calendar.render();
    }

    /**
     * 載入日曆數據
     */
    async function loadCalendarData() {
        if (!calendar) return;

        const reptileName = document.getElementById('calendar-reptile-filter').value;
        if (!reptileName) return;

        const date = calendar.getDate();
        const payload = {
            reptileName: reptileName,
            year: date.getFullYear(),
            month: date.getMonth() + 1
        };

        const response = await callGAS('getCalendarData', payload);
        calendar.removeAllEvents();
        const eventSource = response.data.map(d => ({
            start: d.date,
            allDay: true,
            extendedProps: {
                status: d.status,
                details: d.details
            }
        }));
        calendar.addEventSource(eventSource);
    }
    
    // ===============================================================
    // UI 輔助函式
    // ===============================================================

    function showView(viewName) {
        Object.values(views).forEach(v => v.classList.remove('active-view'));
        views[viewName].classList.add('active-view');
        
        // 如果是顯示日曆，則載入數據
        if (viewName === 'calendar' && currentReptiles.length > 0) {
             document.getElementById('calendar-reptile-filter').value = formReptileSelector.value;
             loadCalendarData();
        }
    }

    function populateDropdown(element, options) {
        const select = (typeof element === 'string') ? document.getElementById(element) : element;
        select.innerHTML = '';
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            select.appendChild(option);
        });
    }
    
    function populateSidebar(reptiles) {
        reptileSidebarList.innerHTML = '';
        reptiles.forEach(reptile => {
            const li = document.createElement('li');
            li.textContent = reptile;
            li.dataset.reptile = reptile;
            reptileSidebarList.appendChild(li);
        });
    }

    function setActiveReptile(reptileName) {
        // 更新表單中的隱藏欄位值
        formReptileSelector.value = reptileName;

        // 更新側邊欄樣式
        reptileSidebarList.querySelectorAll('li').forEach(li => {
            li.classList.toggle('active', li.dataset.reptile === reptileName);
        });
        
        // 更新手機下拉選單
        reptileMobileSelector.value = reptileName;
    }
    
    function handleSidebarClick(e) {
        if (e.target.tagName === 'LI') {
            const reptileName = e.target.dataset.reptile;
            setActiveReptile(reptileName);
        }
    }

    function handleMobileSelectorChange(e) {
        setActiveReptile(e.target.value);
    }

    function showDetailsModal(details) {
        let content = '';
        for (const [key, value] of Object.entries(details)) {
            if (key === '照片連結' && value) {
                content += `<p><strong>${key}:</strong></p><a href="${value}" target="_blank"><img src="${value}" alt="飼養照片"></a>`;
            } else if (value) {
                content += `<p><strong>${key}:</strong> ${value instanceof Date ? value.toLocaleDateString() : value}</p>`;
            }
        }
        modalBody.innerHTML = content;
        modal.style.display = 'block';
    }

    // ===============================================================
    // 工具函式
    // ===============================================================
    
    /**
     * 統一呼叫後端 GAS API 的函式
     */
    async function callGAS(action, payload = {}) {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        if (result.status === 'error') {
            console.error('GAS Error:', result.message);
            throw new Error(result.message);
        }
        return result;
    }

    /**
     * 將檔案轉為 Base64 編碼
     */
    const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
});

