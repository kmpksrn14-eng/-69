/* app.js */

// Constants
const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1-J7D5APDRZOTz_X1cqOCvJb3KHdZ4QQcfAJGbrHCQh4/export?format=csv";

// Accurate fallback/demo data in case of offline or Google Sheets access block
const FALLBACK_DATA = [
    { name: "อบรมเชิงปฏิบัติการสร้างสื่อดิจิทัล", person: "นางสาวอรนุช สมบัติ", dept: "วิชาการ", budget: 85000, spent: 10500, balance: 74500, progress: 12.35, status: "อยู่ระหว่างดำเนินการ" },
    { name: "พัฒนาทักษะการเรียนรู้ด้วย AI", person: "นายปกรณ์ อินทรา", dept: "วิทยาศาสตร์และเทคโนโลยี", budget: 120000, spent: 32000, balance: 88000, progress: 26.67, status: "อยู่ระหว่างดำเนินการ" },
    { name: "กิจกรรมเรียนรู้ร่วมชุมชน", person: "นางสาวจิตราภรณ์ ทองแท้", dept: "สังคมศึกษา", budget: 60000, spent: 0, balance: 60000, progress: 0, status: "ยังไม่ดำเนินการ" },
    { name: "อบรมพัฒนาบุคลากร", person: "นางสาวกฤติยา พลหาญ", dept: "งบประมาณและสินทรัพย์", budget: 20000, spent: 20000, balance: 0, progress: 100, status: "ดำเนินการแล้ว" },
    { name: "อบรมภาวะผู้นำให้นักเรียน", person: "นางสาวกฤติยา พลหาญ", dept: "วิชาการ", budget: 20000, spent: 0, balance: 20000, progress: 0, status: "ยังไม่ดำเนินการ" },
    { name: "เสริมสร้างศักยภาพครูด้วยนวัตกรรม 2", person: "นางสาวกฤติยา พลหาญ", dept: "วิชาการ", budget: 20000, spent: 10000, balance: 10000, progress: 50, status: "อยู่ระหว่างดำเนินการ" }
];

// App State
let state = {
    projects: [],
    filteredProjects: [],
    departments: [],
    sortKey: 'name',
    sortDirection: 'asc',
    theme: 'light',
    charts: {
        budgetComparison: null,
        statusDoughnut: null,
        departmentBudget: null
    }
};

// DOM Elements
const kpiTotalProjects = document.getElementById('kpiTotalProjects');
const kpiTotalBudget = document.getElementById('kpiTotalBudget');
const kpiTotalSpent = document.getElementById('kpiTotalSpent');
const kpiTotalRemaining = document.getElementById('kpiTotalRemaining');
const kpiBudgetSpentBar = document.getElementById('kpiBudgetSpentBar');
const kpiBudgetSpentPercent = document.getElementById('kpiBudgetSpentPercent');
const kpiBudgetRemainingPercent = document.getElementById('kpiBudgetRemainingPercent');

const statusCountCompleted = document.getElementById('statusCountCompleted');
const statusCountInProgress = document.getElementById('statusCountInProgress');
const statusCountNotStarted = document.getElementById('statusCountNotStarted');
const statusAvgProgress = document.getElementById('statusAvgProgress');

const searchInput = document.getElementById('searchInput');
const filterDept = document.getElementById('filterDept');
const filterStatus = document.getElementById('filterStatus');
const btnResetFilters = document.getElementById('btnResetFilters');

const projectsTable = document.getElementById('projectsTable');
const projectsTableBody = document.getElementById('projectsTableBody');
const tableSkeleton = document.getElementById('tableSkeleton');
const emptyState = document.getElementById('emptyState');

const btnRefresh = document.getElementById('btnRefresh');
const btnThemeToggle = document.getElementById('btnThemeToggle');
const themeIcon = document.getElementById('themeIcon');
const syncIndicator = document.getElementById('syncIndicator');
const lastUpdatedText = document.getElementById('lastUpdatedText');

// Initial Setup
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    loadData();
    setupEventListeners();
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    state.theme = savedTheme;
    
    if (savedTheme === 'dark') {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        themeIcon.setAttribute('data-lucide', 'sun');
    } else {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        themeIcon.setAttribute('data-lucide', 'moon');
    }
    lucide.createIcons();
}

function toggleTheme() {
    if (state.theme === 'light') {
        state.theme = 'dark';
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        themeIcon.setAttribute('data-lucide', 'sun');
    } else {
        state.theme = 'light';
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        themeIcon.setAttribute('data-lucide', 'moon');
    }
    localStorage.setItem('theme', state.theme);
    lucide.createIcons();
    
    // Redraw charts with theme-specific colors
    renderCharts();
}

// Event Listeners
function setupEventListeners() {
    // Refresh button
    btnRefresh.addEventListener('click', () => {
        loadData(true);
    });

    // Theme toggle
    btnThemeToggle.addEventListener('click', toggleTheme);

    // Filter controls
    searchInput.addEventListener('input', applyFilters);
    filterDept.addEventListener('change', applyFilters);
    filterStatus.addEventListener('change', applyFilters);
    
    btnResetFilters.addEventListener('click', () => {
        searchInput.value = '';
        filterDept.value = '';
        filterStatus.value = '';
        applyFilters();
    });

    // Sortable table headers
    document.querySelectorAll('.data-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.getAttribute('data-sort');
            handleSort(key);
        });
    });
}

// Fetch and Load Data
async function loadData(isRefresh = false) {
    showLoadingState();
    
    try {
        // Fetch CSV from Google Sheets (adding a cache buster timestamp to fulfill "reload on access" requirement)
        const cacheBuster = new Date().getTime();
        const fetchUrl = `${GOOGLE_SHEET_CSV_URL}&_cb=${cacheBuster}`;
        
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error("Network response was not ok");
        
        const csvText = await response.text();
        
        // Parse CSV using PapaParse
        Papa.parse(csvText, {
            skipEmptyLines: true,
            complete: function(results) {
                if (results.data && results.data.length > 0) {
                    processParsedData(results.data);
                    updateLastUpdatedStatus(true);
                } else {
                    throw new Error("No data parsed from sheet");
                }
            },
            error: function(err) {
                console.error("PapaParse error:", err);
                useFallbackData("ข้อมูลในระบบไม่ถูกต้อง โหลดข้อมูลจำลองแทน");
            }
        });
        
    } catch (error) {
        console.error("Fetch error:", error);
        useFallbackData("ไม่สามารถเชื่อมต่อ Google Sheets ได้ โหลดข้อมูลสำรองสำเร็จ");
    }
}

// Set up UI Loading State
function showLoadingState() {
    btnRefresh.classList.add('loading');
    btnRefresh.disabled = true;
    tableSkeleton.style.display = 'block';
    projectsTable.style.display = 'none';
    emptyState.style.display = 'none';
    
    syncIndicator.className = "pulse-indicator status-orange";
    lastUpdatedText.textContent = "กำลังอัปเดตข้อมูล...";
}

// Populate UI when Google sheet fails
function useFallbackData(message) {
    state.projects = JSON.parse(JSON.stringify(FALLBACK_DATA));
    populateDepartmentFilter();
    applyFilters();
    renderCharts();
    
    btnRefresh.classList.remove('loading');
    btnRefresh.disabled = false;
    tableSkeleton.style.display = 'none';
    projectsTable.style.display = 'table';
    
    syncIndicator.className = "pulse-indicator status-green";
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH');
    lastUpdatedText.textContent = `${message} (${timeStr})`;
}

// Update Last Updated Timestamp
function updateLastUpdatedStatus(success) {
    btnRefresh.classList.remove('loading');
    btnRefresh.disabled = false;
    tableSkeleton.style.display = 'none';
    projectsTable.style.display = 'table';
    
    if (success) {
        syncIndicator.className = "pulse-indicator status-green";
        const now = new Date();
        const timeStr = now.toLocaleTimeString('th-TH');
        lastUpdatedText.textContent = `อัปเดตล่าสุด: ${timeStr} น.`;
    }
}

// Parse Rows and Detect Headers Defensive Coding
function processParsedData(rawRows) {
    let parsed = [];
    
    rawRows.forEach((row, index) => {
        // Skip empty rows or rows that don't contain enough columns
        if (row.length < 5) return;
        
        // Row header check
        const col3Val = row[3] ? row[3].toString().trim() : "";
        if (
            col3Val.includes("งบประมาณ") || 
            col3Val.includes("ราคา") || 
            (isNaN(col3Val.replace(/,/g, '')) && col3Val !== "" && index === 0)
        ) {
            // This is a header row, skip it
            return;
        }
        
        // Map columns correctly (robust mapping)
        const name = row[0] ? row[0].trim() : "ไม่มีชื่อโครงการ";
        const person = row[1] ? row[1].trim() : "ไม่ระบุ";
        const dept = row[2] ? row[2].trim() : "ไม่ระบุกลุ่มงาน";
        
        const budget = row[3] ? parseFloat(row[3].toString().replace(/,/g, '')) || 0 : 0;
        const spent = row[4] ? parseFloat(row[4].toString().replace(/,/g, '')) || 0 : 0;
        
        // Calculate balance if empty/missing
        const balance = row[5] ? parseFloat(row[5].toString().replace(/,/g, '')) || (budget - spent) : (budget - spent);
        const progress = row[6] ? parseFloat(row[6].toString().replace(/,/g, '')) || 0 : 0;
        const status = row[7] ? row[7].trim() : "ยังไม่ดำเนินการ";
        
        parsed.push({
            name,
            person,
            dept,
            budget,
            spent,
            balance,
            progress,
            status
        });
    });
    
    // Update State
    state.projects = parsed;
    
    populateDepartmentFilter();
    applyFilters();
    renderCharts();
}

// Populate the Department Select Filter dynamically
function populateDepartmentFilter() {
    const depts = [...new Set(state.projects.map(p => p.dept))].filter(d => d);
    state.departments = depts.sort();
    
    // Clear select options keeping the first default option
    filterDept.innerHTML = '<option value="">ทุกกลุ่มงาน/ฝ่าย</option>';
    
    state.departments.forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept;
        opt.textContent = dept;
        filterDept.appendChild(opt);
    });
}

// Helper to Format Currency
function formatCurrency(num) {
    return new Intl.NumberFormat('th-TH', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

// Calculate and Update KPI Card Metrics
function updateKPIs(dataList) {
    const total = dataList.length;
    let totalBudget = 0;
    let totalSpent = 0;
    let totalBalance = 0;
    let totalProgressSum = 0;
    
    let completedCount = 0;
    let inProgressCount = 0;
    let notStartedCount = 0;
    
    dataList.forEach(p => {
        totalBudget += p.budget;
        totalSpent += p.spent;
        totalBalance += p.balance;
        totalProgressSum += p.progress;
        
        if (p.status === "ดำเนินการแล้ว") {
            completedCount++;
        } else if (p.status === "อยู่ระหว่างดำเนินการ") {
            inProgressCount++;
        } else {
            notStartedCount++;
        }
    });
    
    const avgProgress = total > 0 ? (totalProgressSum / total).toFixed(1) : "0.0";
    
    // Update Text Content
    kpiTotalProjects.textContent = total;
    kpiTotalBudget.textContent = formatCurrency(totalBudget) + " บาท";
    kpiTotalSpent.textContent = formatCurrency(totalSpent) + " บาท";
    kpiTotalRemaining.textContent = formatCurrency(totalBalance) + " บาท";
    
    // Update spent progress bar
    const spentPercent = totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 0;
    kpiBudgetSpentPercent.textContent = `${spentPercent}%`;
    kpiBudgetSpentBar.style.width = `${spentPercent}%`;
    
    // Update remaining budget text
    const remainingPercent = totalBudget > 0 ? ((totalBalance / totalBudget) * 100).toFixed(1) : 0;
    kpiBudgetRemainingPercent.textContent = `คิดเป็น ${remainingPercent}% ของงบทั้งหมด`;
    
    // Update bottom stats bar
    statusCountCompleted.textContent = completedCount;
    statusCountInProgress.textContent = inProgressCount;
    statusCountNotStarted.textContent = notStartedCount;
    statusAvgProgress.textContent = `${avgProgress}%`;
}

// Filter and Search Logic
function applyFilters() {
    const searchQuery = searchInput.value.toLowerCase().trim();
    const selectedDept = filterDept.value;
    const selectedStatus = filterStatus.value;
    
    state.filteredProjects = state.projects.filter(project => {
        const matchesSearch = 
            project.name.toLowerCase().includes(searchQuery) || 
            project.person.toLowerCase().includes(searchQuery);
            
        const matchesDept = !selectedDept || project.dept === selectedDept;
        const matchesStatus = !selectedStatus || project.status === selectedStatus;
        
        return matchesSearch && matchesDept && matchesStatus;
    });
    
    // Sort and render table
    sortData();
    renderTable();
    
    // Note: Overall Dashboard KPIs and charts reflect the overall school tracking,
    // but updating KPIs relative to filters can sometimes be helpful. Let's make KPIs
    // reflect the currently filtered subset of projects so that executives can drill down!
    // This is a premium touch. Let's do that!
    updateKPIs(state.filteredProjects);
}

// Sorting logic
function handleSort(key) {
    if (state.sortKey === key) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortKey = key;
        state.sortDirection = 'asc';
    }
    
    // Update Sort icon markers in headers
    document.querySelectorAll('.data-table th.sortable').forEach(th => {
        const icon = th.querySelector('.sort-icon');
        if (th.getAttribute('data-sort') === state.sortKey) {
            icon.setAttribute('data-lucide', state.sortDirection === 'asc' ? 'chevron-up' : 'chevron-down');
            th.classList.add('active-sort');
        } else {
            icon.setAttribute('data-lucide', 'chevrons-up-down');
            th.classList.remove('active-sort');
        }
    });
    lucide.createIcons();
    
    sortData();
    renderTable();
}

function sortData() {
    state.filteredProjects.sort((a, b) => {
        let valA, valB;
        
        switch (state.sortKey) {
            case 'name':
                valA = a.name;
                valB = b.name;
                return state.sortDirection === 'asc' 
                    ? valA.localeCompare(valB, 'th') 
                    : valB.localeCompare(valA, 'th');
            case 'person':
                valA = a.person;
                valB = b.person;
                return state.sortDirection === 'asc' 
                    ? valA.localeCompare(valB, 'th') 
                    : valB.localeCompare(valA, 'th');
            case 'dept':
                valA = a.dept;
                valB = b.dept;
                return state.sortDirection === 'asc' 
                    ? valA.localeCompare(valB, 'th') 
                    : valB.localeCompare(valA, 'th');
            case 'budget':
                valA = a.budget;
                valB = b.budget;
                break;
            case 'spent':
                valA = a.spent;
                valB = b.spent;
                break;
            case 'balance':
                valA = a.balance;
                valB = b.balance;
                break;
            case 'progress':
                valA = a.progress;
                valB = b.progress;
                break;
            case 'status':
                valA = a.status;
                valB = b.status;
                return state.sortDirection === 'asc' 
                    ? valA.localeCompare(valB, 'th') 
                    : valB.localeCompare(valA, 'th');
            default:
                return 0;
        }
        
        if (valA < valB) return state.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return state.sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

// Render Data Table
function renderTable() {
    projectsTableBody.innerHTML = '';
    
    if (state.filteredProjects.length === 0) {
        projectsTable.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }
    
    projectsTable.style.display = 'table';
    emptyState.style.display = 'none';
    
    state.filteredProjects.forEach(p => {
        const tr = document.createElement('tr');
        
        // Status Badge Mapping
        let statusBadgeClass = '';
        if (p.status === 'ดำเนินการแล้ว') statusBadgeClass = 'completed';
        else if (p.status === 'อยู่ระหว่างดำเนินการ') statusBadgeClass = 'in-progress';
        else statusBadgeClass = 'not-started';
        
        // Progress Color bar
        let progressBarColorClass = 'color-blue';
        if (p.progress >= 100) progressBarColorClass = 'color-green';
        else if (p.progress > 0) progressBarColorClass = 'color-orange';
        
        tr.innerHTML = `
            <td style="font-weight: 500;">${p.name}</td>
            <td>${p.person}</td>
            <td><span style="color: var(--text-secondary);">${p.dept}</span></td>
            <td class="text-right font-numeric" style="font-weight: 500;">${formatCurrency(p.budget)}</td>
            <td class="text-right font-numeric" style="color: var(--kpi-orange-icon);">${formatCurrency(p.spent)}</td>
            <td class="text-right font-numeric" style="color: var(--kpi-green-icon); font-weight: 500;">${formatCurrency(p.balance)}</td>
            <td class="table-progress-cell">
                <div class="table-progress-info">
                    <span class="font-numeric">${p.progress}%</span>
                </div>
                <div class="table-progress-bar">
                    <div class="table-progress-fill progress-bar-fill ${progressBarColorClass}" style="width: ${p.progress}%"></div>
                </div>
            </td>
            <td>
                <span class="badge ${statusBadgeClass}">
                    <span class="badge-dot"></span>
                    ${p.status}
                </span>
            </td>
        `;
        
        projectsTableBody.appendChild(tr);
    });
    
    lucide.createIcons();
}

// Chart Renderings
function renderCharts() {
    const isDark = state.theme === 'dark';
    
    // Theme chart config
    const textColor = isDark ? '#cbd5e1' : '#475569';
    const gridColor = isDark ? '#1e293b' : '#f1f5f9';
    
    Chart.defaults.color = textColor;
    Chart.defaults.font.family = "'Sarabun', sans-serif";
    
    // --- Chart 1: Budget Comparison (Bar) ---
    if (state.charts.budgetComparison) {
        state.charts.budgetComparison.destroy();
    }
    
    const chartData = state.filteredProjects.slice(0, 8); // show top 8 for space
    const projectLabels = chartData.map(p => p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name);
    const budgets = chartData.map(p => p.budget);
    const spents = chartData.map(p => p.spent);
    
    const ctxComparison = document.getElementById('budgetComparisonChart').getContext('2d');
    state.charts.budgetComparison = new Chart(ctxComparison, {
        type: 'bar',
        data: {
            labels: projectLabels,
            datasets: [
                {
                    label: 'งบประมาณตั้งไว้ (บาท)',
                    data: budgets,
                    backgroundColor: isDark ? '#2563eb' : '#3b82f6',
                    borderRadius: 6,
                    borderWidth: 0,
                    barPercentage: 0.8,
                    categoryPercentage: 0.7
                },
                {
                    label: 'เบิกจ่ายจริง (บาท)',
                    data: spents,
                    backgroundColor: isDark ? '#ea580c' : '#f97316',
                    borderRadius: 6,
                    borderWidth: 0,
                    barPercentage: 0.8,
                    categoryPercentage: 0.7
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { family: "'Kanit', sans-serif", size: 12 }
                    }
                },
                tooltip: {
                    titleFont: { family: "'Kanit', sans-serif", size: 13 },
                    bodyFont: { family: "'Sarabun', sans-serif", size: 12 }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxRotation: 30, minRotation: 30 }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        callback: function(value) {
                            return value >= 1000 ? (value / 1000) + 'k' : value;
                        }
                    }
                }
            }
        }
    });
    
    // --- Chart 2: Status Doughnut ---
    if (state.charts.statusDoughnut) {
        state.charts.statusDoughnut.destroy();
    }
    
    let completed = 0, inProgress = 0, notStarted = 0;
    state.filteredProjects.forEach(p => {
        if (p.status === "ดำเนินการแล้ว") completed++;
        else if (p.status === "อยู่ระหว่างดำเนินการ") inProgress++;
        else notStarted++;
    });
    
    const ctxDoughnut = document.getElementById('statusDoughnutChart').getContext('2d');
    state.charts.statusDoughnut = new Chart(ctxDoughnut, {
        type: 'doughnut',
        data: {
            labels: ['ดำเนินการแล้ว', 'อยู่ระหว่างดำเนินการ', 'ยังไม่ดำเนินการ'],
            datasets: [{
                data: [completed, inProgress, notStarted],
                backgroundColor: [
                    '#16a34a', // green
                    '#ca8a04', // amber/orange
                    '#64748b'  // slate
                ],
                borderWidth: isDark ? 2 : 1,
                borderColor: isDark ? '#1e293b' : '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        font: { family: "'Kanit', sans-serif", size: 11 },
                        boxWidth: 12
                    }
                }
            },
            cutout: '65%'
        }
    });

    // --- Chart 3: Department Budget (Horizontal Bar) ---
    if (state.charts.departmentBudget) {
        state.charts.departmentBudget.destroy();
    }
    
    // Aggregate budget by dept
    const deptBudgets = {};
    state.filteredProjects.forEach(p => {
        deptBudgets[p.dept] = (deptBudgets[p.dept] || 0) + p.budget;
    });
    
    const deptLabels = Object.keys(deptBudgets);
    const deptData = Object.values(deptBudgets);
    
    const ctxDept = document.getElementById('departmentBudgetChart').getContext('2d');
    state.charts.departmentBudget = new Chart(ctxDept, {
        type: 'bar',
        data: {
            labels: deptLabels,
            datasets: [{
                label: 'งบประมาณรวม (บาท)',
                data: deptData,
                backgroundColor: [
                    '#7c3aed', // purple
                    '#06b6d4', // cyan
                    '#ec4899', // pink
                    '#eab308'  // yellow
                ],
                borderRadius: 4,
                borderWidth: 0,
                barThickness: 16
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: {
                        callback: function(value) {
                            return value >= 1000 ? (value / 1000) + 'k' : value;
                        }
                    }
                },
                y: {
                    grid: { display: false }
                }
            }
        }
    });
}
