const STORAGE_KEY = "easy-expense-tracker-v1";
const BUDGET_KEY = "easy-expense-budget-v1";

const categories = ["Food", "Transport", "Home", "Health", "Shopping", "Bills", "Entertainment", "Other"];
const categoryColors = {
  Food: "#0d8f72",
  Transport: "#0c7c8c",
  Home: "#4969d1",
  Health: "#c83c4d",
  Shopping: "#d88817",
  Bills: "#724cc8",
  Entertainment: "#d4558b",
  Other: "#647184"
};

const state = {
  expenses: loadExpenses(),
  editingId: null,
  search: "",
  category: "all",
  budget: Number(localStorage.getItem(BUDGET_KEY) || 0)
};

const els = {
  form: document.querySelector("#expenseForm"),
  formTitle: document.querySelector("#formTitle"),
  submitBtn: document.querySelector("#submitBtn"),
  cancelEditBtn: document.querySelector("#cancelEditBtn"),
  description: document.querySelector("#description"),
  amount: document.querySelector("#amount"),
  date: document.querySelector("#date"),
  category: document.querySelector("#category"),
  budget: document.querySelector("#budget"),
  search: document.querySelector("#search"),
  categoryFilter: document.querySelector("#categoryFilter"),
  expenseList: document.querySelector("#expenseList"),
  resultCount: document.querySelector("#resultCount"),
  totalSpent: document.querySelector("#totalSpent"),
  monthSpent: document.querySelector("#monthSpent"),
  budgetLeft: document.querySelector("#budgetLeft"),
  largestCategory: document.querySelector("#largestCategory"),
  chart: document.querySelector("#categoryChart"),
  chartTotal: document.querySelector("#chartTotal"),
  legend: document.querySelector("#legend"),
  exportBtn: document.querySelector("#exportBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  emptyTemplate: document.querySelector("#emptyTemplate")
};

els.date.value = new Date().toISOString().slice(0, 10);
els.budget.value = state.budget || "";

els.form.addEventListener("submit", handleSubmit);
els.cancelEditBtn.addEventListener("click", stopEditing);
els.search.addEventListener("input", () => {
  state.search = els.search.value.trim().toLowerCase();
  render();
});
els.categoryFilter.addEventListener("change", () => {
  state.category = els.categoryFilter.value;
  render();
});
els.budget.addEventListener("input", () => {
  state.budget = Number(els.budget.value || 0);
  localStorage.setItem(BUDGET_KEY, String(state.budget));
  render();
});
els.exportBtn.addEventListener("click", exportCsv);
els.resetBtn.addEventListener("click", clearAll);

render();

function handleSubmit(event) {
  event.preventDefault();

  const expense = {
    id: state.editingId || crypto.randomUUID(),
    description: els.description.value.trim(),
    amount: Number(els.amount.value),
    date: els.date.value,
    category: els.category.value
  };

  if (!expense.description || !expense.amount || expense.amount <= 0 || !expense.date) {
    return;
  }

  if (state.editingId) {
    state.expenses = state.expenses.map((item) => item.id === state.editingId ? expense : item);
  } else {
    state.expenses = [expense, ...state.expenses];
  }

  saveExpenses();
  stopEditing();
  els.form.reset();
  els.date.value = new Date().toISOString().slice(0, 10);
  els.budget.value = state.budget || "";
  render();
}

function editExpense(id) {
  const expense = state.expenses.find((item) => item.id === id);
  if (!expense) return;

  state.editingId = id;
  els.formTitle.textContent = "Edit expense";
  els.submitBtn.lastChild.textContent = " Update expense";
  els.cancelEditBtn.classList.remove("hidden");
  els.description.value = expense.description;
  els.amount.value = expense.amount;
  els.date.value = expense.date;
  els.category.value = expense.category;
  els.description.focus();
}

function deleteExpense(id) {
  state.expenses = state.expenses.filter((item) => item.id !== id);
  saveExpenses();
  if (state.editingId === id) stopEditing();
  render();
}

function stopEditing() {
  state.editingId = null;
  els.formTitle.textContent = "Add expense";
  els.submitBtn.lastChild.textContent = " Save expense";
  els.cancelEditBtn.classList.add("hidden");
}

function clearAll() {
  if (!state.expenses.length) return;
  const confirmed = window.confirm("Clear all saved expenses?");
  if (!confirmed) return;

  state.expenses = [];
  saveExpenses();
  stopEditing();
  render();
}

function filteredExpenses() {
  return state.expenses.filter((expense) => {
    const matchesSearch = [expense.description, expense.category, expense.date].join(" ").toLowerCase().includes(state.search);
    const matchesCategory = state.category === "all" || expense.category === state.category;
    return matchesSearch && matchesCategory;
  });
}

function render() {
  const visible = filteredExpenses();
  const totals = getTotals(state.expenses);
  const visibleTotal = visible.reduce((sum, item) => sum + item.amount, 0);
  const thisMonth = getThisMonthTotal(state.expenses);
  const budgetLeft = state.budget - thisMonth;

  els.totalSpent.textContent = money(totals.total);
  els.monthSpent.textContent = money(thisMonth);
  els.budgetLeft.textContent = state.budget ? money(budgetLeft) : "Set budget";
  els.budgetLeft.style.color = budgetLeft < 0 && state.budget ? "var(--red)" : "";
  els.largestCategory.textContent = totals.largest || "None";
  els.chartTotal.textContent = money(visibleTotal);
  els.resultCount.textContent = `${visible.length} ${visible.length === 1 ? "item" : "items"}`;

  renderList(visible);
  renderChart(visible);
}

function renderList(expenses) {
  els.expenseList.innerHTML = "";

  if (!expenses.length) {
    els.expenseList.append(els.emptyTemplate.content.cloneNode(true));
    return;
  }

  expenses
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((expense) => {
      const item = document.createElement("li");
      item.className = "expense-item";
      item.innerHTML = `
        <div>
          <span class="expense-title">${escapeHtml(expense.description)}</span>
          <span class="expense-meta">${escapeHtml(expense.category)} · ${formatDate(expense.date)}</span>
        </div>
        <span class="amount">${money(expense.amount)}</span>
        <div class="row-actions">
          <button class="icon-button" type="button" aria-label="Edit ${escapeHtml(expense.description)}" title="Edit">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>
          </button>
          <button class="icon-button danger" type="button" aria-label="Delete ${escapeHtml(expense.description)}" title="Delete">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>
          </button>
        </div>
      `;

      const [editButton, deleteButton] = item.querySelectorAll("button");
      editButton.addEventListener("click", () => editExpense(expense.id));
      deleteButton.addEventListener("click", () => deleteExpense(expense.id));
      els.expenseList.append(item);
    });
}

function renderChart(expenses) {
  const ctx = els.chart.getContext("2d");
  const width = els.chart.width;
  const height = els.chart.height;
  const centerX = width / 2;
  const centerY = 118;
  const radius = 86;
  const totals = categories
    .map((category) => ({
      category,
      total: expenses.filter((expense) => expense.category === category).reduce((sum, expense) => sum + expense.amount, 0)
    }))
    .filter((entry) => entry.total > 0);
  const grandTotal = totals.reduce((sum, entry) => sum + entry.total, 0);

  ctx.clearRect(0, 0, width, height);

  if (!grandTotal) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#d9e0ea";
    ctx.lineWidth = 24;
    ctx.stroke();
    ctx.fillStyle = "#647184";
    ctx.font = "700 15px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("No data", centerX, centerY + 5);
    els.legend.innerHTML = "";
    return;
  }

  let angle = -Math.PI / 2;
  totals.forEach((entry) => {
    const slice = (entry.total / grandTotal) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, angle, angle + slice);
    ctx.strokeStyle = categoryColors[entry.category];
    ctx.lineWidth = 28;
    ctx.stroke();
    angle += slice;
  });

  ctx.fillStyle = "#17212b";
  ctx.font = "850 18px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(money(grandTotal), centerX, centerY - 2);
  ctx.fillStyle = "#647184";
  ctx.font = "700 12px system-ui";
  ctx.fillText("filtered", centerX, centerY + 20);

  els.legend.innerHTML = totals
    .map((entry) => `
      <div class="legend-row">
        <span class="swatch" style="background:${categoryColors[entry.category]}"></span>
        <span>${entry.category}</span>
        <span>${money(entry.total)}</span>
      </div>
    `)
    .join("");
}

function getTotals(expenses) {
  const byCategory = new Map();
  let total = 0;

  expenses.forEach((expense) => {
    total += expense.amount;
    byCategory.set(expense.category, (byCategory.get(expense.category) || 0) + expense.amount);
  });

  let largest = "";
  let largestAmount = 0;
  byCategory.forEach((amount, category) => {
    if (amount > largestAmount) {
      largest = category;
      largestAmount = amount;
    }
  });

  return { total, largest };
}

function getThisMonthTotal(expenses) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return expenses
    .filter((expense) => expense.date.startsWith(monthKey))
    .reduce((sum, expense) => sum + expense.amount, 0);
}

function exportCsv() {
  if (!state.expenses.length) return;

  const headers = ["Date", "Description", "Category", "Amount"];
  const rows = state.expenses.map((expense) => [
    expense.date,
    expense.description,
    expense.category,
    expense.amount.toFixed(2)
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "expenses.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function loadExpenses() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.expenses));
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
