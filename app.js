document.addEventListener('DOMContentLoaded', () => {
    // PWA Service Worker 註冊
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(() => console.log('Service Worker Registered'))
            .catch(error => console.log('Service Worker Registration Failed:', error));
    }

    const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxydQsag_m6PtDuh_z6ZU68QPRmXvnnw11yhH4vSp0aHEgBXCTaCeJaDlNYx-1kx_af_Q/exec'; // 重要：換成你部署後的 GAS Web App URL
    const views = {
        login: document.getElementById('login-view'),
        dashboard: document.getElementById('dashboard-view'),
        calendar: document.getElementById('calendar-view')
    };
    
    // --- 登入邏輯 ---
    const loginBtn = document.getElementById('login-btn');
    loginBtn.addEventListener('click', async () => {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        loginBtn.disabled = true;
        
        const response = await callGAS('login', { username, password });
        
        if (response.data.authenticated) {
            showView('dashboard');
            loadDashboard();
        } else {
            document.getElementById('error-message').textContent = response.data.message;
        }
        loginBtn.disabled = false;
    });

    // --- 儀表板邏輯 ---
    const logForm = document.getElementById('log-form');
    logForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.disabled = true;
        document.getElementById('submit-status').textContent = '提交中...';

        const formData = new FormData(logForm);
        const formDataObj = Object.fromEntries(formData.entries());

        const fileInput = document.getElementById('file-upload');
        let fileData = null;
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            fileData = await toBase64(file);
        }

        const payload = {
            formData: formDataObj,
            fileData: fileData,
            fileName: fileInput.files.length > 0 ? fileInput.files[0].name : null,
            fileMimeType: fileInput.files.length > 0 ? fileInput.files[0].type : null
        };
        
        const response = await callGAS('submitLog', payload);
        
        if(response.status === 'success') {
            document.getElementById('submit-status').textContent = response.data.message;
            logForm.reset();
        } else {
            document.getElementById('submit-status').textContent = `錯誤: ${response.message}`;
        }
        submitBtn.disabled = false;
    });

    // --- 日曆邏輯 ---
    let calendar;
    const calendarEl = document.getElementById('calendar');
    const calendarFilter = document.getElementById('calendar-reptile-filter');

    // 初始化日曆
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        events: [], // 初始為空
        dayCellContent: function(arg) {
            // 自定義日期單元格內容以顯示標記
            let html = `<div class="fc-daygrid-day-number">${arg.dayNumberText}</div>`;
            const event = arg.day.events.find(e => e); // 簡單找第一個事件
            if (event) {
                const status = event.extendedProps.status;
                html += `<div class="${status}-marker"></div>`;
            }
            return { html: html };
        },
        dateClick: function(info) {
             // 點擊有事件的日期
            const event = info.dayEl.querySelector('.fed-marker, .logged-marker, .abnormal-marker');
            if (event) {
                // 這裡需要改為從日曆的事件源中找到對應的詳細數據
                // 暫時簡化
                alert('顯示該日期的詳細資訊');
            }
        }
    });
    calendar.render();


    // --- 頁面導航 ---
    document.getElementById('show-calendar-btn').addEventListener('click', () => {
        showView('calendar');
        loadCalendarData();
    });
    document.getElementById('back-to-dashboard-btn').addEventListener('click', () => showView('dashboard'));
    
    // --- 共用函數 ---
    async function callGAS(action, payload) {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action, payload }),
            headers: { 'Content-Type': 'application/json' }
        });
        return await response.json();
    }
    
    function showView(viewName) {
        Object.values(views).forEach(v => v.style.display = 'none');
        views[viewName].style.display = 'block';
    }

    async function loadDashboard() {
        const response = await callGAS('getInitialData');
        if(response.status === 'success') {
            const { reptiles, loggers } = response.data;
            populateDropdown('reptile-name', reptiles);
            populateDropdown('logger-name', loggers);
            populateDropdown('calendar-reptile-filter', reptiles);
            // ... 同步填充其他響應式選單 ...
        }
    }

    async function loadCalendarData() {
        const reptileName = calendarFilter.value;
        const date = calendar.getDate(); // 獲取日曆當前月份
        const payload = {
            reptileName: reptileName,
            year: date.getFullYear(),
            month: date.getMonth() + 1
        };
        const response = await callGAS('getCalendarData', payload);
        if (response.status === 'success') {
            calendar.removeAllEvents(); // 清除舊事件
            calendar.addEventSource(response.data.map(d => ({
                start: d.date,
                allDay: true,
                extendedProps: {
                    status: d.status,
                    details: d.details
                }
            })));
        }
    }

    function populateDropdown(elementId, options) {
        const select = document.getElementById(elementId);
        select.innerHTML = '';
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            select.appendChild(option);
        });
    }

    // 將檔案轉為 Base64
    const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

});