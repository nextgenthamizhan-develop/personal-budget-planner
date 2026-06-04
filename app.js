// Capitalist Application State Manager

const DEFAULT_STATE = {
  transactions: [],
  budgets: {
    'Food': 0,
    'Rent': 0,
    'Utilities': 0,
    'Entertainment': 0,
    'Other': 0
  },
  loans: [],
  assets: [],
  liabilities: [],
  activeLoanId: null,
  currency: 'USD',
  categories: {
    expense: ['Food', 'Rent', 'Utilities', 'Entertainment', 'Other'],
    income: ['Salary', 'Investment', 'Savings', 'Other']
  }
};

let state = {};
let dbChart = null;
let assetChart = null;
let loanChart = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initDateIndicator();
  initNavigation();
  initCategoryOptions();
  initCurrencySelector();
  initReportConsole();
  renderAll();
});

// Setup current date in header
function initDateIndicator() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const today = new Date();
  document.getElementById('header-date').innerText = today.toLocaleDateString('en-US', options);
  
  // Set default dates in inputs to today
  const todayStr = today.toISOString().split('T')[0];
  const dateInputs = ['trans-date', 'loan-start-date'];
  dateInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = todayStr;
  });
}

// Currency Selector Initialization
function initCurrencySelector() {
  const selector = document.getElementById('currency-selector');
  if (selector) {
    selector.value = state.currency || 'USD';
  }
}

function handleCurrencyChange(val) {
  state.currency = val;
  saveState();
  renderAll();
  showToast(`Currency format updated to ${val}`, 'success');
}

function toggleMobileMenu() {
  const navLinks = document.querySelector('.nav-links');
  if (navLinks) {
    navLinks.classList.toggle('active');
  }
}

// Navigation handling
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = item.getAttribute('data-tab');
      navigateToTab(tabId);
    });
  });
}

function navigateToTab(tabId) {
  // Collapse mobile menu if active
  const navLinks = document.querySelector('.nav-links');
  if (navLinks) {
    navLinks.classList.remove('active');
  }

  // Update nav item state
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.nav-item[data-tab="${tabId}"]`).classList.add('active');

  // Update visible sections
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tabId}`).classList.add('active');

  // Update page header title
  const titleMap = {
    'dashboard': 'Financial Dashboard',
    'budget': 'Budget Planner & Tracker',
    'loans': 'Loan Maintenance & Amortization',
    'accounting': 'Ledger & Accounting',
    'reports': 'Reports & Financial Exports'
  };
  document.getElementById('page-title').innerText = titleMap[tabId] || 'Financial Planner';

  // Force chart renders when tabs become active to avoid visual glitches
  if (tabId === 'dashboard') {
    setTimeout(renderDashboardCharts, 100);
  } else if (tabId === 'loans') {
    setTimeout(() => {
      recalculateAmortization();
    }, 100);
  }
}

// LocalStorage helpers
function loadState() {
  const stored = localStorage.getItem('capitalist_state');
  if (stored) {
    try {
      state = JSON.parse(stored);
      // Auto-clear if they only have the default sample data (e.g. first transaction is 't1')
      if (state.transactions && state.transactions.length > 0 && state.transactions[0].id === 't1') {
        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        saveState();
      } else {
        // Backwards compatibility/migration checks
        if (!state.transactions) state.transactions = [];
        if (!state.budgets) state.budgets = {};
        if (!state.loans) state.loans = [];
        if (state.loans) {
          state.loans.forEach(l => {
            if (!l.interestType) l.interestType = 'reducing';
          });
        }
        if (!state.assets) state.assets = [];
        if (!state.liabilities) state.liabilities = [];
        if (!state.currency) state.currency = 'USD';
        if (!state.categories) {
          state.categories = {
            expense: ['Food', 'Rent', 'Utilities', 'Entertainment', 'Other'],
            income: ['Salary', 'Investment', 'Savings', 'Other']
          };
        }
      }
    } catch (e) {
      console.error("Error loading local storage state. Falling back to defaults.", e);
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  } else {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    saveState();
  }
}

function saveState() {
  localStorage.setItem('capitalist_state', JSON.stringify(state));
}

// Populate category dropdowns
function initCategoryOptions() {
  renderCategoryDropdowns();
}

function renderCategoryDropdowns() {
  // 1. Populate log transaction category select
  const transTypeEl = document.getElementById('trans-type');
  if (transTypeEl) {
    const transType = transTypeEl.value;
    const transCatSelect = document.getElementById('trans-category');
    if (transCatSelect) {
      const prevVal = transCatSelect.value;
      transCatSelect.innerHTML = '';
      const currentCats = state.categories[transType] || [];
      currentCats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.innerText = cat;
        transCatSelect.appendChild(opt);
      });
      if (currentCats.includes(prevVal)) {
        transCatSelect.value = prevVal;
      }
    }
  }

  // 2. Populate budget target category select (only expense categories)
  const budgetCatSelect = document.getElementById('budget-category');
  if (budgetCatSelect) {
    const prevVal = budgetCatSelect.value;
    budgetCatSelect.innerHTML = '';
    const expenseCats = state.categories.expense || [];
    expenseCats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.innerText = cat;
      budgetCatSelect.appendChild(opt);
    });
    if (expenseCats.includes(prevVal)) {
      budgetCatSelect.value = prevVal;
    }
  }

  // 3. Populate history filter category select (both expense & income categories)
  const filterCatSelect = document.getElementById('filter-category');
  if (filterCatSelect) {
    const prevVal = filterCatSelect.value;
    filterCatSelect.innerHTML = '<option value="all">All Categories</option>';
    
    // Combine both unique expense and income categories
    const allCats = [...state.categories.expense, ...state.categories.income];
    const uniqueCats = [...new Set(allCats)];
    
    uniqueCats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.innerText = cat;
      filterCatSelect.appendChild(opt);
    });
    
    if (prevVal && (uniqueCats.includes(prevVal) || prevVal === 'all')) {
      filterCatSelect.value = prevVal;
    } else {
      filterCatSelect.value = 'all';
    }
  }
}

// Main Render Hub
function renderAll() {
  renderCategoryDropdowns();
  renderCategoryManagement();
  renderDashboard();
  renderBudget();
  renderLoans();
  renderAccounting();
}

// ==============================================
// TAB RENDERING LOGIC
// ==============================================

function renderDashboard() {
  // 1. Calculations
  const assetsVal = state.assets.reduce((sum, a) => sum + Number(a.value), 0);
  
  // Calculate remaining loan principal dynamically as liability
  let totalLoanDebt = 0;
  state.loans.forEach(loan => {
    const schedule = calculateAmortizationSchedule(loan);
    if (schedule.length > 0) {
      // Find remaining balance of this loan. For simplicty, we estimate how many payments have passed based on startDate.
      const start = new Date(loan.startDate);
      const today = new Date();
      const diffMonths = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth();
      const paidMonths = Math.max(0, Math.min(loan.term, diffMonths));
      
      const currentMonthIndex = Math.min(paidMonths, schedule.length - 1);
      totalLoanDebt += schedule[currentMonthIndex] ? schedule[currentMonthIndex].balance : 0;
    }
  });

  const liabilitiesVal = state.liabilities.reduce((sum, l) => sum + Number(l.value), 0) + totalLoanDebt;
  const netWorthVal = assetsVal - liabilitiesVal;

  // Monthly Cashflow
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed

  const currentMonthTransactions = state.transactions.filter(t => {
    const tDate = new Date(t.date);
    return tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth;
  });

  const monthlyIncome = currentMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const monthlyExpense = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const monthlyCashflow = monthlyIncome - monthlyExpense;

  // Daily Spend (specifically for today)
  const todayStr = today.toISOString().split('T')[0];
  const dailySpend = state.transactions
    .filter(t => t.date === todayStr && t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // 2. DOM Updates
  document.getElementById('val-net-worth').innerText = formatCurrency(netWorthVal);
  document.getElementById('val-cash-flow').innerText = formatCurrency(monthlyCashflow);
  document.getElementById('val-daily-spend').innerText = formatCurrency(dailySpend);
  document.getElementById('val-loan-debt').innerText = formatCurrency(totalLoanDebt);

  // Set visual color cues for net worth
  const nwCard = document.getElementById('summary-net-worth');
  if (netWorthVal < 0) {
    nwCard.className = "card card-accent-danger";
  } else {
    nwCard.className = "card card-accent-indigo";
  }

  // Update loan count text
  document.getElementById('desc-loan-debt').innerText = `${state.loans.length} active loan${state.loans.length === 1 ? '' : 's'} tracked`;

  // Render recent activities
  const recentTbody = document.getElementById('dashboard-transactions-body');
  recentTbody.innerHTML = '';
  
  const sortedTransactions = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const recent = sortedTransactions.slice(0, 5);

  if (recent.length === 0) {
    recentTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No transactions recorded.</td></tr>`;
  } else {
    recent.forEach(t => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${formatDate(t.date)}</td>
        <td>${t.desc}</td>
        <td><span class="category-tag tag-${t.category.toLowerCase()}">${t.category}</span></td>
        <td class="${t.type === 'income' ? 'amount-income' : 'amount-expense'}">
          ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
        </td>
      `;
      recentTbody.appendChild(row);
    });
  }

  // Insights builder
  const insightsList = document.getElementById('financial-insights-list');
  insightsList.innerHTML = '';

  const insights = generateInsights(monthlyIncome, monthlyExpense, dailySpend, netWorthVal, totalLoanDebt);
  insights.forEach(ins => {
    const item = document.createElement('div');
    item.className = 'ledger-item';
    item.innerHTML = `
      <div class="ledger-info">
        <span class="ledger-name" style="color: ${ins.color}; font-size: 0.9rem;">${ins.title}</span>
        <span class="ledger-category">${ins.text}</span>
      </div>
    `;
    insightsList.appendChild(item);
  });

  renderDashboardCharts();
}

function renderDashboardCharts() {
  const ctx1 = document.getElementById('dashboardChart');
  if (!ctx1) return;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  // Aggregate current month spending by categories
  const categorySpent = { 'Food': 0, 'Rent': 0, 'Utilities': 0, 'Entertainment': 0, 'Other': 0 };
  state.transactions.forEach(t => {
    const tDate = new Date(t.date);
    if (tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth && t.type === 'expense') {
      const cat = categorySpent.hasOwnProperty(t.category) ? t.category : 'Other';
      categorySpent[cat] += Number(t.amount);
    }
  });

  const categories = Object.keys(categorySpent);
  const budgetLimits = categories.map(c => state.budgets[c] || 0);
  const actuals = categories.map(c => categorySpent[c]);

  if (dbChart) {
    dbChart.destroy();
  }

  dbChart = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: categories,
      datasets: [
        {
          label: 'Budget Limit',
          data: budgetLimits,
          backgroundColor: 'rgba(99, 102, 241, 0.4)',
          borderColor: 'rgba(99, 102, 241, 1)',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Actual Spending',
          data: actuals,
          backgroundColor: actuals.map((val, idx) => val > budgetLimits[idx] ? 'rgba(244, 63, 94, 0.75)' : 'rgba(16, 185, 129, 0.75)'),
          borderColor: actuals.map((val, idx) => val > budgetLimits[idx] ? 'rgba(244, 63, 94, 1)' : 'rgba(16, 185, 129, 1)'),
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#9ca3af' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af' }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#f3f4f6' }
        }
      }
    }
  });

  // Assets allocation Chart
  const ctx2 = document.getElementById('allocationChart');
  if (!ctx2) return;

  const typeAllocations = {};
  state.assets.forEach(a => {
    typeAllocations[a.type] = (typeAllocations[a.type] || 0) + Number(a.value);
  });

  const assetLabels = Object.keys(typeAllocations);
  const assetData = Object.values(typeAllocations);

  if (assetChart) {
    assetChart.destroy();
  }

  if (assetLabels.length === 0) {
    // Empty state fallback for chart
    assetLabels.push('No Assets');
    assetData.push(1);
  }

  assetChart = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: assetLabels,
      datasets: [{
        data: assetData,
        backgroundColor: [
          '#10b981', // emerald
          '#3b82f6', // blue
          '#8b5cf6', // purple
          '#f59e0b', // amber
          '#ec4899'  // pink
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#f3f4f6', boxWidth: 12 }
        }
      },
      cutout: '70%'
    }
  });
}

function renderBudget() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  // 1. Calculate actual spending per category for current month
  const categorySpent = { 'Food': 0, 'Rent': 0, 'Utilities': 0, 'Entertainment': 0, 'Other': 0 };
  state.transactions.forEach(t => {
    const tDate = new Date(t.date);
    if (tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth && t.type === 'expense') {
      const cat = categorySpent.hasOwnProperty(t.category) ? t.category : 'Other';
      categorySpent[cat] += Number(t.amount);
    }
  });

  // Render monthly budget bars
  const progressList = document.getElementById('category-progress-list');
  progressList.innerHTML = '';

  Object.keys(state.budgets).forEach(cat => {
    const limit = state.budgets[cat];
    const spent = categorySpent[cat] || 0;
    const percentage = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
    
    let progressClass = '';
    if (percentage >= 100) progressClass = 'danger';
    else if (percentage >= 80) progressClass = 'warning';

    const item = document.createElement('div');
    item.className = 'progress-item';
    item.innerHTML = `
      <div class="progress-labels">
        <span class="progress-name">${cat}</span>
        <span class="progress-values">${formatCurrency(spent)} of ${formatCurrency(limit)} (${percentage}%)</span>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar-fill ${progressClass}" style="width: ${percentage}%"></div>
      </div>
    `;
    progressList.appendChild(item);
  });

  // Render all transactions history table
  renderTransactions();
}

function renderTransactions() {
  const filterCat = document.getElementById('filter-category').value;
  const tbody = document.getElementById('full-transactions-body');
  tbody.innerHTML = '';

  const sortedTransactions = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const filtered = sortedTransactions.filter(t => {
    if (filterCat === 'all') return true;
    return t.category.toLowerCase() === filterCat.toLowerCase();
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No matched transactions.</td></tr>`;
    return;
  }

  filtered.forEach(t => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDate(t.date)}</td>
      <td>${t.desc}</td>
      <td><span class="category-tag tag-${t.category.toLowerCase()}">${t.category}</span></td>
      <td class="${t.type === 'income' ? 'amount-income' : 'amount-expense'}">
        ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
      </td>
      <td>
        <button class="delete-btn" onclick="deleteTransaction('${t.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderLoans() {
  const selector = document.getElementById('loan-selector');
  selector.innerHTML = '';

  const noLoansWarn = document.getElementById('no-loans-warning');
  const detailsCard = document.getElementById('loan-details-card');
  const chartCard = document.getElementById('loan-chart-card');
  const amortCard = document.getElementById('loan-amortization-card');

  if (state.loans.length === 0) {
    noLoansWarn.style.display = 'block';
    detailsCard.style.display = 'none';
    chartCard.style.display = 'none';
    amortCard.style.display = 'none';
    return;
  }

  noLoansWarn.style.display = 'none';
  detailsCard.style.display = 'block';
  chartCard.style.display = 'block';
  amortCard.style.display = 'block';

  // Add loans to dropdown
  state.loans.forEach(loan => {
    const opt = document.createElement('option');
    opt.value = loan.id;
    opt.innerText = `${loan.name} ($${loan.principal.toLocaleString()})`;
    selector.appendChild(opt);
  });

  // Ensure active loan state is valid
  if (!state.activeLoanId || !state.loans.find(l => l.id === state.activeLoanId)) {
    state.activeLoanId = state.loans[0].id;
  }
  
  selector.value = state.activeLoanId;

  // Setup delete button handler
  document.getElementById('delete-loan-btn').onclick = () => {
    deleteLoan(state.activeLoanId);
  };

  recalculateAmortization();
}

function recalculateAmortization() {
  const activeLoan = state.loans.find(l => l.id === state.activeLoanId);
  if (!activeLoan) return;

  const extraInput = document.getElementById('loan-extra-payment');
  const extraVal = Number(extraInput.value) || 0;

  const lumpSumAmount = Number(document.getElementById('loan-lumpsum-amount').value) || 0;
  const lumpSumMonth = Number(document.getElementById('loan-lumpsum-month').value) || 0;

  // 1. Calculate standard amortization values
  const standardSchedule = calculateAmortizationSchedule(activeLoan, 0, 0, 0);
  const totalInterestStandard = standardSchedule.reduce((sum, item) => sum + item.interest, 0);
  const minPayment = standardSchedule[0] ? standardSchedule[0].payment : 0;

  document.getElementById('loan-stat-interest-type').value = activeLoan.interestType || 'reducing';
  document.getElementById('loan-stat-min-payment').innerText = formatCurrency(minPayment);
  document.getElementById('loan-stat-total-interest').innerText = formatCurrency(totalInterestStandard);
  document.getElementById('loan-stat-total-payback').innerText = formatCurrency(activeLoan.principal + totalInterestStandard);

  // 2. Calculate simulated (extra payoff) amortization values
  const simulatedSchedule = calculateAmortizationSchedule(activeLoan, extraVal, lumpSumAmount, lumpSumMonth);
  const totalInterestSimulated = simulatedSchedule.reduce((sum, item) => sum + item.interest, 0);

  const monthsSaved = Math.max(0, standardSchedule.length - simulatedSchedule.length);
  const interestSaved = Math.max(0, totalInterestStandard - totalInterestSimulated);

  document.getElementById('loan-stat-saved-months').innerText = `${monthsSaved} month${monthsSaved === 1 ? '' : 's'}`;
  document.getElementById('loan-stat-saved-interest').innerText = formatCurrency(interestSaved);

  // 3. Render amortization body
  const tbody = document.getElementById('loan-amortization-body');
  tbody.innerHTML = '';

  simulatedSchedule.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.month}</td>
      <td>${formatCurrency(row.payment)}</td>
      <td>${formatCurrency(row.principalPaid)}</td>
      <td>${formatCurrency(row.interest)}</td>
      <td>${formatCurrency(row.cumulativeInterest || 0)}</td>
      <td>${formatCurrency(row.balance)}</td>
    `;
    tbody.appendChild(tr);
  });

  // 4. Update Remaining Balance Chart
  const ctx = document.getElementById('loanBalanceChart');
  if (!ctx) return;

  const labels = standardSchedule.map(r => `M${r.month}`);
  const standardBalances = standardSchedule.map(r => r.balance);
  const simulatedBalances = simulatedSchedule.map(r => r.balance);

  // Align length of arrays for Chart display
  while (simulatedBalances.length < standardBalances.length) {
    simulatedBalances.push(0);
  }

  if (loanChart) {
    loanChart.destroy();
  }

  loanChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Standard Plan',
          data: standardBalances,
          borderColor: 'rgba(99, 102, 241, 0.8)',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0
        },
        {
          label: 'Simulated (Extra Payoff)',
          data: simulatedBalances,
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#9ca3af' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af', maxTicksLimit: 12 }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#f3f4f6' }
        }
      }
    }
  });
}

function renderAccounting() {
  const assetsList = document.getElementById('assets-list');
  const liabilitiesList = document.getElementById('liabilities-list');
  
  assetsList.innerHTML = '';
  liabilitiesList.innerHTML = '';

  const totalAssets = state.assets.reduce((sum, a) => sum + Number(a.value), 0);
  
  // Calculate remaining loan principal dynamically as liability
  let totalLoanDebt = 0;
  state.loans.forEach(loan => {
    const schedule = calculateAmortizationSchedule(loan);
    if (schedule.length > 0) {
      const start = new Date(loan.startDate);
      const today = new Date();
      const diffMonths = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth();
      const paidMonths = Math.max(0, Math.min(loan.term, diffMonths));
      
      const currentMonthIndex = Math.min(paidMonths, schedule.length - 1);
      totalLoanDebt += schedule[currentMonthIndex] ? schedule[currentMonthIndex].balance : 0;
    }
  });

  const totalLiabilities = state.liabilities.reduce((sum, l) => sum + Number(l.value), 0) + totalLoanDebt;

  // Append regular assets
  state.assets.forEach(a => {
    const div = document.createElement('div');
    div.className = 'ledger-item';
    div.innerHTML = `
      <div class="ledger-info">
        <span class="ledger-name">${a.name}</span>
        <span class="ledger-category">${a.type}</span>
      </div>
      <div class="ledger-action">
        <span class="ledger-value" style="color: var(--color-success);">${formatCurrency(a.value)}</span>
        <button class="delete-btn" onclick="deleteAsset('${a.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    `;
    assetsList.appendChild(div);
  });

  // Append regular liabilities
  state.liabilities.forEach(l => {
    const div = document.createElement('div');
    div.className = 'ledger-item';
    div.innerHTML = `
      <div class="ledger-info">
        <span class="ledger-name">${l.name}</span>
        <span class="ledger-category">${l.type}</span>
      </div>
      <div class="ledger-action">
        <span class="ledger-value" style="color: var(--color-danger);">${formatCurrency(l.value)}</span>
        <button class="delete-btn" onclick="deleteLiability('${l.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    `;
    liabilitiesList.appendChild(div);
  });

  // Append loan debts dynamically as liabilities
  state.loans.forEach(loan => {
    const schedule = calculateAmortizationSchedule(loan);
    let remBal = loan.principal;
    if (schedule.length > 0) {
      const start = new Date(loan.startDate);
      const today = new Date();
      const diffMonths = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth();
      const paidMonths = Math.max(0, Math.min(loan.term, diffMonths));
      const currentMonthIndex = Math.min(paidMonths, schedule.length - 1);
      remBal = schedule[currentMonthIndex] ? schedule[currentMonthIndex].balance : 0;
    }
    
    if (remBal <= 0) return; // Skip if fully paid off

    const div = document.createElement('div');
    div.className = 'ledger-item';
    div.innerHTML = `
      <div class="ledger-info">
        <span class="ledger-name">${loan.name} (Debt Balance)</span>
        <span class="ledger-category">Loan Liability (Amortized)</span>
      </div>
      <div class="ledger-action">
        <span class="ledger-value" style="color: var(--color-danger);">${formatCurrency(remBal)}</span>
        <span style="font-size: 0.7rem; color: var(--text-muted); padding: 0.25rem;">(Auto Sync)</span>
      </div>
    `;
    liabilitiesList.appendChild(div);
  });

  // Value Footers
  document.getElementById('total-assets-val').innerText = formatCurrency(totalAssets);
  document.getElementById('total-liabilities-val').innerText = formatCurrency(totalLiabilities);
}

// ==============================================
// SUBMIT AND ACTION HANDLERS
// ==============================================

function handleTransactionSubmit(event) {
  event.preventDefault();
  const type = document.getElementById('trans-type').value;
  const amount = Number(document.getElementById('trans-amount').value);
  const category = document.getElementById('trans-category').value;
  const date = document.getElementById('trans-date').value;
  const desc = document.getElementById('trans-desc').value;

  const newTrans = {
    id: 't_' + Date.now(),
    type,
    amount,
    category,
    date,
    desc
  };

  state.transactions.push(newTrans);
  saveState();
  renderAll();

  // Reset Form
  document.getElementById('trans-amount').value = '';
  document.getElementById('trans-desc').value = '';
  showToast(`Successfully logged ${type} of ${formatCurrency(amount)}`, 'success');
}

function handleBudgetTargetSubmit(event) {
  event.preventDefault();
  const category = document.getElementById('budget-category').value;
  const limit = Number(document.getElementById('budget-limit').value);

  state.budgets[category] = limit;
  saveState();
  renderAll();

  document.getElementById('budget-limit').value = '';
  showToast(`Updated ${category} monthly limit to ${formatCurrency(limit)}`, 'success');
}

function handleLoanSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('loan-name').value;
  const principal = Number(document.getElementById('loan-principal').value);
  const rate = Number(document.getElementById('loan-rate').value);
  const term = Number(document.getElementById('loan-term').value);
  const interestType = document.getElementById('loan-interest-type').value;
  const startDate = document.getElementById('loan-start-date').value;

  const id = 'l_' + Date.now();
  const newLoan = { id, name, principal, rate, term, interestType, startDate };

  state.loans.push(newLoan);
  state.activeLoanId = id;

  saveState();
  renderAll();

  // Reset form
  document.getElementById('loan-name').value = '';
  document.getElementById('loan-principal').value = '';
  document.getElementById('loan-rate').value = '';
  document.getElementById('loan-term').value = '';

  showToast(`Created Loan Profile: ${name}`, 'success');
}

function switchActiveLoan(loanId) {
  state.activeLoanId = loanId;
  saveState();
  recalculateAmortization();
}

function handleLoanTypeChange(newType) {
  const activeLoan = state.loans.find(l => l.id === state.activeLoanId);
  if (activeLoan) {
    activeLoan.interestType = newType;
    saveState();
    recalculateAmortization();
    const typeLabelMap = {
      'reducing': 'Reducing Balance (Balance Amount Interest)',
      'daily_reducing': 'Daily Reducing (Daily Rest)',
      'flat': 'Fixed Interest (Flat Rate)'
    };
    showToast(`Loan type updated to ${typeLabelMap[newType]}`, 'success');
  }
}

function handleAssetSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('asset-name').value;
  const type = document.getElementById('asset-type').value;
  const value = Number(document.getElementById('asset-value').value);

  const newAsset = {
    id: 'a_' + Date.now(),
    name,
    type,
    value
  };

  state.assets.push(newAsset);
  saveState();
  renderAll();

  document.getElementById('asset-name').value = '';
  document.getElementById('asset-value').value = '';
  showToast(`Logged Asset: ${name}`, 'success');
}

function handleLiabilitySubmit(event) {
  event.preventDefault();
  const name = document.getElementById('liability-name').value;
  const type = document.getElementById('liability-type').value;
  const value = Number(document.getElementById('liability-value').value);

  const newLiability = {
    id: 'l_' + Date.now(),
    name,
    type,
    value
  };

  state.liabilities.push(newLiability);
  saveState();
  renderAll();

  document.getElementById('liability-name').value = '';
  document.getElementById('liability-value').value = '';
  showToast(`Logged Liability: ${name}`, 'success');
}

// ==============================================
// DELETE PROCEDURES
// ==============================================

function deleteTransaction(id) {
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveState();
  renderAll();
  showToast('Transaction deleted', 'warning');
}

function deleteLoan(id) {
  if (confirm("Are you sure you want to delete this loan profile?")) {
    state.loans = state.loans.filter(l => l.id !== id);
    if (state.activeLoanId === id) {
      state.activeLoanId = state.loans[0] ? state.loans[0].id : null;
    }
    saveState();
    renderAll();
    showToast('Loan profile deleted', 'danger');
  }
}

function deleteAsset(id) {
  state.assets = state.assets.filter(a => a.id !== id);
  saveState();
  renderAll();
  showToast('Asset deleted', 'warning');
}

function deleteLiability(id) {
  state.liabilities = state.liabilities.filter(l => l.id !== id);
  saveState();
  renderAll();
  showToast('Liability deleted', 'warning');
}

// ==============================================
// CORE ALGORITHMIC CALCULATIONS
// ==============================================

function calculateAmortizationSchedule(loan, extraPayment = 0, lumpSumAmount = 0, lumpSumMonth = 0) {
  const principal = Number(loan.principal);
  const annualRate = Number(loan.rate);
  const term = Number(loan.term);
  const type = loan.interestType || 'reducing';

  if (type === 'flat') {
    const r = annualRate / 100;
    const totalInterest = principal * r * (term / 12);
    const monthlyInterest = totalInterest / term;
    const monthlyPrincipal = principal / term;

    const schedule = [];
    let balance = principal;
    let cumulativeInterest = 0;

    for (let month = 1; month <= term; month++) {
      if (balance <= 0) break;

      let principalPaid = monthlyPrincipal;
      let interestPaid = monthlyInterest;

      // Account for extra payment
      principalPaid += extraPayment;

      // Account for lump sum
      if (month === lumpSumMonth) {
        principalPaid += lumpSumAmount;
      }

      if (principalPaid > balance) {
        principalPaid = balance;
      }

      balance = Math.max(0, balance - principalPaid);
      cumulativeInterest += interestPaid;

      schedule.push({
        month,
        payment: interestPaid + principalPaid,
        principalPaid,
        interest: interestPaid,
        cumulativeInterest: Math.round(cumulativeInterest * 100) / 100,
        balance: Math.round(balance * 100) / 100
      });
    }
    return schedule;
  } else if (type === 'daily_reducing') {
    const n = term;
    const rMonthly = annualRate / 12 / 100;

    let emi = 0;
    if (rMonthly > 0) {
      emi = principal * (rMonthly * Math.pow(1 + rMonthly, n)) / (Math.pow(1 + rMonthly, n) - 1);
    } else {
      emi = principal / n;
    }

    const schedule = [];
    let balance = principal;
    let currentDate = new Date(loan.startDate || new Date());
    let cumulativeInterest = 0;

    for (let month = 1; month <= n; month++) {
      if (balance <= 0) break;

      const yr = currentDate.getFullYear();
      const mth = currentDate.getMonth();
      const daysInMonth = new Date(yr, mth + 1, 0).getDate();

      const interest = balance * (annualRate / 100) * (daysInMonth / 365);
      let principalPaid = emi - interest;

      // Account for extra payment
      principalPaid += extraPayment;

      // Account for lump sum
      if (month === lumpSumMonth) {
        principalPaid += lumpSumAmount;
      }

      if (principalPaid > balance) {
        principalPaid = balance;
      }

      balance = Math.max(0, balance - principalPaid);
      cumulativeInterest += interest;

      schedule.push({
        month,
        payment: interest + principalPaid,
        principalPaid,
        interest,
        cumulativeInterest: Math.round(cumulativeInterest * 100) / 100,
        balance: Math.round(balance * 100) / 100
      });

      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    return schedule;
  } else {
    const r = annualRate / 12 / 100; // monthly rate
    const n = term; // total periods

    let monthlyPayment = 0;
    if (r > 0) {
      monthlyPayment = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    } else {
      monthlyPayment = principal / n;
    }

    const schedule = [];
    let balance = principal;
    let cumulativeInterest = 0;

    for (let month = 1; month <= n; month++) {
      if (balance <= 0) break;

      const interest = balance * r;
      let principalPaid = monthlyPayment - interest;
      
      // Account for extra payment
      principalPaid += extraPayment;

      // Account for lump sum
      if (month === lumpSumMonth) {
        principalPaid += lumpSumAmount;
      }

      // Boundary check so balance doesn't go below 0
      if (principalPaid > balance) {
        principalPaid = balance;
      }

      balance = Math.max(0, balance - principalPaid);
      cumulativeInterest += interest;
      
      schedule.push({
        month,
        payment: interest + principalPaid,
        principalPaid,
        interest,
        cumulativeInterest: Math.round(cumulativeInterest * 100) / 100,
        balance: Math.round(balance * 100) / 100
      });
    }

    return schedule;
  }
}

// Net Worth Insights Generator
function generateInsights(income, expense, daily, netWorth, loanDebt) {
  const insights = [];

  // Cashflow Insight
  if (expense > income) {
    insights.push({
      title: 'Deficit Warning',
      text: `Your expenses exceeded your income this month by ${formatCurrency(expense - income)}. Consider auditing discretionary categories.`,
      color: 'var(--color-danger)'
    });
  } else if (income > 0) {
    const savingsRate = Math.round(((income - expense) / income) * 100);
    insights.push({
      title: 'Healthy Savings Rate',
      text: `You have saved ${savingsRate}% of your income this month. Keep it up!`,
      color: 'var(--color-success)'
    });
  }

  // Daily Limit advice
  if (daily > 100) {
    insights.push({
      title: 'Elevated Daily Activity',
      text: `Today's transactions (${formatCurrency(daily)}) are above average. Pay extra attention to secondary spend variables.`,
      color: 'var(--color-warning)'
    });
  } else {
    insights.push({
      title: 'Daily Budget Check',
      text: `Daily spending is low. You are preserving valuable cash flow velocity.`,
      color: 'var(--color-success)'
    });
  }

  // Debt/Equity Insight
  if (loanDebt > 0 && netWorth > 0) {
    const debtRatio = Math.round((loanDebt / (netWorth + loanDebt)) * 100);
    if (debtRatio > 40) {
      insights.push({
        title: 'High Debt Leverage',
        text: `Your debt makes up ${debtRatio}% of total capital structure. Simulating extra payments on loans could yield risk-free yields.`,
        color: 'var(--color-warning)'
      });
    } else {
      insights.push({
        title: 'Conservative Leverage',
        text: `Your loan-to-equity ratio is stable (${debtRatio}%). Ensure remaining cash works actively in assets.`,
        color: 'var(--color-info)'
      });
    }
  }

  // Generic fallback if empty
  if (insights.length === 0) {
    insights.push({
      title: 'System Initialized',
      text: 'Log your daily transactions and asset indexes to generate specific advice profiles.',
      color: 'var(--color-primary)'
    });
  }

  return insights;
}

// ==============================================
// UTILITY FUNCTIONS & FORMATTERS
// ==============================================

const CURRENCY_CONFIGS = {
  USD: { locale: 'en-US', code: 'USD' },
  LKR: { locale: 'en-LK', code: 'LKR' },
  EUR: { locale: 'de-DE', code: 'EUR' },
  GBP: { locale: 'en-GB', code: 'GBP' },
  INR: { locale: 'en-IN', code: 'INR' },
  JPY: { locale: 'ja-JP', code: 'JPY' }
};

function formatCurrency(amount) {
  const currency = state.currency || 'USD';
  const conf = CURRENCY_CONFIGS[currency] || CURRENCY_CONFIGS.USD;
  return new Intl.NumberFormat(conf.locale, {
    style: 'currency',
    currency: conf.code
  }).format(amount);
}

function formatDate(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  
  toastMsg.innerText = message;
  toast.className = `toast show ${type}`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// ==============================================
// BACKUP AND SYSTEM SETTINGS
// ==============================================

// ==============================================
// REPORTS AND EXPORT CENTER MODULES
// ==============================================

function exportPDFReport() {
  const monthIdx = Number(document.getElementById('report-month').value);
  const year = Number(document.getElementById('report-year').value);
  const monthName = document.getElementById('report-month').options[monthIdx].text;
  
  // Filter transactions for that specific month & year
  const monthlyTrans = state.transactions.filter(t => {
    const tDate = new Date(t.date);
    return tDate.getFullYear() === year && tDate.getMonth() === monthIdx;
  });
  
  const incomeVal = monthlyTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
  const expenseVal = monthlyTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
  const netFlow = incomeVal - expenseVal;
  
  const assetsVal = state.assets.reduce((sum, a) => sum + Number(a.value), 0);
  
  // Calculate remaining loan principal dynamically as liability
  let totalLoanDebt = 0;
  state.loans.forEach(loan => {
    const schedule = calculateAmortizationSchedule(loan);
    if (schedule.length > 0) {
      const start = new Date(loan.startDate);
      const reportDate = new Date(year, monthIdx, 28); // end of month
      const diffMonths = (reportDate.getFullYear() - start.getFullYear()) * 12 + reportDate.getMonth() - start.getMonth();
      const paidMonths = Math.max(0, Math.min(loan.term, diffMonths));
      
      const currentMonthIndex = Math.min(paidMonths, schedule.length - 1);
      totalLoanDebt += schedule[currentMonthIndex] ? schedule[currentMonthIndex].balance : 0;
    }
  });

  const liabilitiesVal = state.liabilities.reduce((sum, l) => sum + Number(l.value), 0) + totalLoanDebt;
  const netWorth = assetsVal - liabilitiesVal;

  // Render HTML in print container
  const printContainer = document.getElementById('print-report-container');
  
  let assetsRows = state.assets.map(a => `
    <tr>
      <td>${a.name}</td>
      <td>${a.type}</td>
      <td>${formatCurrency(a.value)}</td>
    </tr>
  `).join('');
  
  if (state.assets.length === 0) assetsRows = `<tr><td colspan="3" style="text-align:center;">No assets logged</td></tr>`;

  let liabilitiesRows = state.liabilities.map(l => `
    <tr>
      <td>${l.name}</td>
      <td>${l.type}</td>
      <td>${formatCurrency(l.value)}</td>
    </tr>
  `).join('');
  
  // Append active loans
  state.loans.forEach(loan => {
    const schedule = calculateAmortizationSchedule(loan);
    let remBal = loan.principal;
    if (schedule.length > 0) {
      const start = new Date(loan.startDate);
      const reportDate = new Date(year, monthIdx, 28);
      const diffMonths = (reportDate.getFullYear() - start.getFullYear()) * 12 + reportDate.getMonth() - start.getMonth();
      const paidMonths = Math.max(0, Math.min(loan.term, diffMonths));
      const currentMonthIndex = Math.min(paidMonths, schedule.length - 1);
      remBal = schedule[currentMonthIndex] ? schedule[currentMonthIndex].balance : 0;
    }
    if (remBal > 0) {
      liabilitiesRows += `
        <tr>
          <td>${loan.name} (Debt Balance)</td>
          <td>Loan Liability</td>
          <td>${formatCurrency(remBal)}</td>
        </tr>
      `;
    }
  });
  
  if (liabilitiesRows === '') liabilitiesRows = `<tr><td colspan="3" style="text-align:center;">No liabilities logged</td></tr>`;

  let transactionRows = monthlyTrans.map(t => `
    <tr>
      <td>${formatDate(t.date)}</td>
      <td>${t.desc}</td>
      <td>${t.category}</td>
      <td class="${t.type === 'income' ? 'amount-income' : 'amount-expense'}">
        ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
      </td>
    </tr>
  `).join('');

  if (monthlyTrans.length === 0) {
    transactionRows = `<tr><td colspan="4" style="text-align:center; color:#666;">No transactions logged in ${monthName} ${year}</td></tr>`;
  }

  printContainer.innerHTML = `
    <div class="print-header">
      <div>
        <h1 class="print-title">CAPITALIST</h1>
        <span class="print-subtitle">Personal Financial Statement</span>
      </div>
      <div style="text-align: right;">
        <h3 style="font-size:12pt; margin-bottom:4px;">Period: ${monthName} ${year}</h3>
        <p style="font-size:8pt; color:#6b7280;">Generated on: ${new Date().toLocaleDateString()}</p>
      </div>
    </div>

    <div class="print-section">
      <h2>1. Executive Summary</h2>
      <div class="print-grid">
        <div class="print-stat-box">
          <span class="print-stat-label">Net Worth</span>
          <div class="print-stat-value">${formatCurrency(netWorth)}</div>
        </div>
        <div class="print-stat-box">
          <span class="print-stat-label">Monthly Cash Flow</span>
          <div class="print-stat-value" style="color: ${netFlow >= 0 ? '#047857' : '#b91c1c'}">${formatCurrency(netFlow)}</div>
        </div>
        <div class="print-stat-box">
          <span class="print-stat-label">Total Assets</span>
          <div class="print-stat-value">${formatCurrency(assetsVal)}</div>
        </div>
        <div class="print-stat-box">
          <span class="print-stat-label">Total Liabilities & Debt</span>
          <div class="print-stat-value">${formatCurrency(liabilitiesVal)}</div>
        </div>
      </div>
    </div>

    <div class="print-section">
      <h2>2. Balance Sheet Ledger</h2>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
        <div>
          <h3 style="font-size: 10.5pt; margin-bottom: 0.5rem; color:#047857; font-weight:600;">Assets</h3>
          <table class="print-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Category</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              ${assetsRows}
            </tbody>
          </table>
        </div>
        <div>
          <h3 style="font-size: 10.5pt; margin-bottom: 0.5rem; color:#b91c1c; font-weight:600;">Liabilities & Debt</h3>
          <table class="print-table">
            <thead>
              <tr>
                <th>Liability</th>
                <th>Category</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              ${liabilitiesRows}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="print-section" style="page-break-before: always;">
      <h2>3. Transaction History (${monthName} ${year})</h2>
      <table class="print-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${transactionRows}
        </tbody>
      </table>
    </div>

    <div class="print-footer">
      <span>Capitalist Local Ledger Report</span>
      <span>Confidential & Private</span>
      <span>Page 1 of 1</span>
    </div>
  `;

  // Trigger print dialog
  window.print();
}

function exportExcelReport() {
  const monthIdx = Number(document.getElementById('report-month').value);
  const year = Number(document.getElementById('report-year').value);
  const monthName = document.getElementById('report-month').options[monthIdx].text;

  // Filter transactions
  const monthlyTrans = state.transactions.filter(t => {
    const tDate = new Date(t.date);
    return tDate.getFullYear() === year && tDate.getMonth() === monthIdx;
  });

  const assetsVal = state.assets.reduce((sum, a) => sum + Number(a.value), 0);
  const liabilitiesVal = state.liabilities.reduce((sum, l) => sum + Number(l.value), 0);

  // Construct CSV content
  let csvContent = "";
  
  // Header
  csvContent += `"CAPITALIST FINANCIAL REPORT - ${monthName.toUpperCase()} ${year}"\n`;
  csvContent += `"Generated on:","${new Date().toISOString().split('T')[0]}"\n\n`;

  // Summary Metrics
  csvContent += `"EXECUTIVE SUMMARY"\n`;
  csvContent += `"Metric","Value"\n`;
  
  let totalLoanDebt = 0;
  state.loans.forEach(loan => {
    const schedule = calculateAmortizationSchedule(loan);
    if (schedule.length > 0) {
      const start = new Date(loan.startDate);
      const reportDate = new Date(year, monthIdx, 28);
      const diffMonths = (reportDate.getFullYear() - start.getFullYear()) * 12 + reportDate.getMonth() - start.getMonth();
      const paidMonths = Math.max(0, Math.min(loan.term, diffMonths));
      const currentMonthIndex = Math.min(paidMonths, schedule.length - 1);
      totalLoanDebt += schedule[currentMonthIndex] ? schedule[currentMonthIndex].balance : 0;
    }
  });

  const netWorth = assetsVal - (liabilitiesVal + totalLoanDebt);
  const totalIncome = monthlyTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = monthlyTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);

  csvContent += `"Net Worth","${netWorth.toFixed(2)}"\n`;
  csvContent += `"Total Assets","${assetsVal.toFixed(2)}"\n`;
  csvContent += `"Total Liabilities","${(liabilitiesVal + totalLoanDebt).toFixed(2)}"\n`;
  csvContent += `"Monthly Income","${totalIncome.toFixed(2)}"\n`;
  csvContent += `"Monthly Expenses","${totalExpense.toFixed(2)}"\n`;
  csvContent += `"Net Cash Flow","${(totalIncome - totalExpense).toFixed(2)}"\n\n`;

  // Assets Sheet
  csvContent += `"BALANCE SHEET: ASSETS"\n`;
  csvContent += `"Asset Name","Subcategory","Current Value"\n`;
  state.assets.forEach(a => {
    csvContent += `"${a.name}","${a.type}","${a.value.toFixed(2)}"\n`;
  });
  csvContent += `\n`;

  // Liabilities Sheet
  csvContent += `"BALANCE SHEET: LIABILITIES & DEBT"\n`;
  csvContent += `"Liability Name","Subcategory","Outstanding Balance"\n`;
  state.liabilities.forEach(l => {
    csvContent += `"${l.name}","${l.type}","${l.value.toFixed(2)}"\n`;
  });
  state.loans.forEach(loan => {
    const schedule = calculateAmortizationSchedule(loan);
    let remBal = loan.principal;
    if (schedule.length > 0) {
      const start = new Date(loan.startDate);
      const reportDate = new Date(year, monthIdx, 28);
      const diffMonths = (reportDate.getFullYear() - start.getFullYear()) * 12 + reportDate.getMonth() - start.getMonth();
      const paidMonths = Math.max(0, Math.min(loan.term, diffMonths));
      const currentMonthIndex = Math.min(paidMonths, schedule.length - 1);
      remBal = schedule[currentMonthIndex] ? schedule[currentMonthIndex].balance : 0;
    }
    if (remBal > 0) {
      csvContent += `"${loan.name} (Debt)","Loan Amortization","${remBal.toFixed(2)}"\n`;
    }
  });
  csvContent += `\n`;

  // Transaction Ledger
  csvContent += `"TRANSACTION LEDGER - ${monthName.toUpperCase()} ${year}"\n`;
  csvContent += `"Date","Description","Category","Type","Amount"\n`;
  monthlyTrans.forEach(t => {
    csvContent += `"${t.date}","${t.desc.replace(/"/g, '""')}","${t.category}","${t.type}","${t.amount.toFixed(2)}"\n`;
  });

  // Download logic
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute("href", url);
  link.setAttribute("download", `capitalist_ledger_${year}_${monthIdx + 1}.csv`);
  link.click();
  showToast('Downloaded Excel ledger data', 'success');
}

function exportWordReport() {
  const monthIdx = Number(document.getElementById('report-month').value);
  const year = Number(document.getElementById('report-year').value);
  const monthName = document.getElementById('report-month').options[monthIdx].text;

  const monthlyTrans = state.transactions.filter(t => {
    const tDate = new Date(t.date);
    return tDate.getFullYear() === year && tDate.getMonth() === monthIdx;
  });

  const assetsVal = state.assets.reduce((sum, a) => sum + Number(a.value), 0);
  const liabilitiesVal = state.liabilities.reduce((sum, l) => sum + Number(l.value), 0);
  
  let totalLoanDebt = 0;
  state.loans.forEach(loan => {
    const schedule = calculateAmortizationSchedule(loan);
    if (schedule.length > 0) {
      const start = new Date(loan.startDate);
      const reportDate = new Date(year, monthIdx, 28);
      const diffMonths = (reportDate.getFullYear() - start.getFullYear()) * 12 + reportDate.getMonth() - start.getMonth();
      const paidMonths = Math.max(0, Math.min(loan.term, diffMonths));
      const currentMonthIndex = Math.min(paidMonths, schedule.length - 1);
      totalLoanDebt += schedule[currentMonthIndex] ? schedule[currentMonthIndex].balance : 0;
    }
  });

  const totalIncome = monthlyTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = monthlyTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
  const netFlow = totalIncome - totalExpense;

  const netWorth = assetsVal - (liabilitiesVal + totalLoanDebt);

  // Generate HTML for Word
  let docHTML = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <title>Capitalist Executive Finance Report</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        h1 { color: #4f46e5; text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; }
        h2 { color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
        th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; }
        th { background-color: #f3f4f6; font-weight: bold; }
        .success { color: #047857; font-weight: bold; }
        .danger { color: #b91c1c; font-weight: bold; }
        .metric-card { background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
      </style>
    </head>
    <body>
      <h1>CAPITALIST FINANCIAL REPORT</h1>
      <p style='text-align: center; font-style: italic;'>Statement Period: ${monthName} ${year} | Generated: ${new Date().toLocaleDateString()}</p>
      
      <h2>1. EXECUTIVE STATEMENT SUMMARY</h2>
      <div class="metric-card">
        <p><strong>Net Worth Position:</strong> ${formatCurrency(netWorth)}</p>
        <p><strong>Cash Flow Velocity (Monthly Surplus):</strong> <span class="${netFlow >= 0 ? 'success' : 'danger'}">${formatCurrency(netFlow)}</span></p>
        <p><strong>Aggregate Asset Holdings:</strong> ${formatCurrency(assetsVal)}</p>
        <p><strong>Aggregate Outstanding Liabilities:</strong> ${formatCurrency(liabilitiesVal + totalLoanDebt)}</p>
      </div>

      <h2>2. BALANCE SHEET SPECIFICATION</h2>
      <h3>Assets Ledger</h3>
      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Category</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          ${state.assets.map(a => `<tr><td>${a.name}</td><td>${a.type}</td><td>${formatCurrency(a.value)}</td></tr>`).join('')}
        </tbody>
      </table>

      <h3>Liabilities & Outstanding Debts</h3>
      <table>
        <thead>
          <tr>
            <th>Liability</th>
            <th>Category</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          ${state.liabilities.map(l => `<tr><td>${l.name}</td><td>${l.type}</td><td>${formatCurrency(l.value)}</td></tr>`).join('')}
          ${state.loans.map(loan => {
            const schedule = calculateAmortizationSchedule(loan);
            let rem = loan.principal;
            if (schedule.length > 0) {
              const start = new Date(loan.startDate);
              const reportDate = new Date(year, monthIdx, 28);
              const diffMonths = (reportDate.getFullYear() - start.getFullYear()) * 12 + reportDate.getMonth() - start.getMonth();
              const paidMonths = Math.max(0, Math.min(loan.term, diffMonths));
              const currentMonthIndex = Math.min(paidMonths, schedule.length - 1);
              rem = schedule[currentMonthIndex] ? schedule[currentMonthIndex].balance : 0;
            }
            return rem > 0 ? `<tr><td>${loan.name} (Amortized Debt)</td><td>Loan Amortization</td><td>${formatCurrency(rem)}</td></tr>` : '';
          }).join('')}
        </tbody>
      </table>

      <h2>3. STRATEGIC INSIGHTS & REMARKS</h2>
      <ul>
        ${generateInsights(totalIncome, totalExpense, 0, netWorth, totalLoanDebt).map(ins => `<li><strong>${ins.title}:</strong> ${ins.text}</li>`).join('')}
      </ul>
      
      <p style='margin-top: 50px; text-align: center; font-size: 10px; color:#9ca3af;'>Created with Capitalist Ledger Software. All data processed client-side. Confidential.</p>
    </body>
    </html>
  `;

  // Download logic
  const blob = new Blob([docHTML], { type: 'application/msword;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute("href", url);
  link.setAttribute("download", `capitalist_ledger_executive_report_${year}_${monthIdx + 1}.doc`);
  link.click();
  showToast('Downloaded Word document report', 'success');
}

function exportPNGCharts() {
  let downloadedCount = 0;
  
  if (dbChart) {
    const url = dbChart.toBase64Image();
    const link = document.createElement('a');
    link.href = url;
    link.download = `capitalist_budget_spending_chart.png`;
    link.click();
    downloadedCount++;
  }
  
  if (assetChart) {
    const url = assetChart.toBase64Image();
    const link = document.createElement('a');
    link.href = url;
    link.download = `capitalist_asset_allocation_chart.png`;
    link.click();
    downloadedCount++;
  }

  if (downloadedCount > 0) {
    showToast(`Successfully downloaded ${downloadedCount} chart images as PNG`, 'success');
  } else {
    showToast('No active charts to download. Create some budgets or assets first.', 'warning');
  }
}

function resetLocalStorage() {
  if (confirm("WARNING: This will permanently delete all logs, budget limits, assets, and active loans. Are you absolutely sure?")) {
    localStorage.removeItem('capitalist_state');
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    saveState();
    renderAll();
    showToast('Application reset to factory defaults', 'danger');
    navigateToTab('dashboard');
  }
}

// Report Exporter Console Helper Functions
function initReportConsole() {
  const formatSelector = document.getElementById('report-format');
  if (formatSelector) {
    updateReportDescription(formatSelector.value);
  }
}

function updateReportDescription(val) {
  const descEl = document.getElementById('report-format-desc');
  const btnEl = document.getElementById('report-export-btn');
  if (!descEl) return;
  
  const descriptions = {
    pdf: {
      text: 'Generates a professional printable financial statement. Opens directly in the browser print/PDF layout.',
      btnText: 'Generate & Save PDF Statement',
      btnClass: 'btn btn-primary'
    },
    csv: {
      text: 'Compiles all monthly transaction details, current asset values, and loan amortization logs into an Excel-ready document.',
      btnText: 'Download Excel Spreadsheet (.csv)',
      btnClass: 'btn btn-success'
    },
    doc: {
      text: 'Creates a rich-text executive summary of cash flow velocity, debt ratios, and budget advice profiles.',
      btnText: 'Download Word Document (.doc)',
      btnClass: 'btn btn-info'
    },
    png: {
      text: 'Extracts and saves the current dashboard expense bars and asset allocations as high-resolution images.',
      btnText: 'Download PNG Chart Images',
      btnClass: 'btn btn-warning'
    }
  };
  
  const selected = descriptions[val] || descriptions.pdf;
  descEl.innerText = selected.text;
  if (btnEl) {
    btnEl.innerText = selected.btnText;
    btnEl.className = selected.btnClass;
  }
}

function triggerReportExport() {
  const format = document.getElementById('report-format').value;
  if (format === 'pdf') {
    exportPDFReport();
  } else if (format === 'csv') {
    exportExcelReport();
  } else if (format === 'doc') {
    exportWordReport();
  } else if (format === 'png') {
    exportPNGCharts();
  }
}

// Category Management Handlers
function renderCategoryManagement() {
  const catListDiv = document.getElementById('custom-categories-list');
  if (!catListDiv) return;
  
  catListDiv.innerHTML = '';
  
  // Render expense categories
  state.categories.expense.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'ledger-item';
    item.style.padding = '0.5rem 0.75rem';
    item.innerHTML = `
      <div class="ledger-info">
        <span class="ledger-name" style="font-size: 0.85rem;">${cat}</span>
        <span class="ledger-category" style="color: var(--color-danger); font-size: 0.7rem;">Expense</span>
      </div>
      <button class="delete-btn" onclick="deleteCategory('expense', '${cat}')" ${['Food', 'Rent', 'Utilities', 'Entertainment', 'Other'].includes(cat) ? 'disabled style="opacity: 0.3; cursor: not-allowed;" title="Core category cannot be deleted"' : ''}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    `;
    catListDiv.appendChild(item);
  });

  // Render income categories
  state.categories.income.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'ledger-item';
    item.style.padding = '0.5rem 0.75rem';
    item.innerHTML = `
      <div class="ledger-info">
        <span class="ledger-name" style="font-size: 0.85rem;">${cat}</span>
        <span class="ledger-category" style="color: var(--color-success); font-size: 0.7rem;">Income</span>
      </div>
      <button class="delete-btn" onclick="deleteCategory('income', '${cat}')" ${['Salary', 'Investment', 'Savings', 'Other'].includes(cat) ? 'disabled style="opacity: 0.3; cursor: not-allowed;" title="Core category cannot be deleted"' : ''}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    `;
    catListDiv.appendChild(item);
  });
}

function handleCategorySubmit(event) {
  event.preventDefault();
  const type = document.getElementById('new-cat-type').value;
  const nameInput = document.getElementById('new-cat-name');
  const name = nameInput.value.trim();
  
  if (!name) return;
  
  const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
  
  if (state.categories.expense.includes(formattedName) || state.categories.income.includes(formattedName)) {
    showToast('Category name already exists!', 'danger');
    return;
  }
  
  state.categories[type].push(formattedName);
  
  if (type === 'expense') {
    state.budgets[formattedName] = 0;
  }
  
  saveState();
  nameInput.value = '';
  
  renderAll();
  showToast(`Added custom category: ${formattedName}`, 'success');
}

function deleteCategory(type, name) {
  if (confirm(`Are you sure you want to delete the category "${name}"? Existing transactions will retain this category.`)) {
    state.categories[type] = state.categories[type].filter(c => c !== name);
    
    if (type === 'expense' && state.budgets.hasOwnProperty(name)) {
      delete state.budgets[name];
    }
    
    saveState();
    renderAll();
    showToast(`Deleted category: ${name}`, 'warning');
  }
}
