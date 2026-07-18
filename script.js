/* Premium Booking Logic for Arceus Booking */
const bookingForm = document.getElementById('bookingForm');
const statusForm = document.getElementById('statusForm');
const submitBtn = document.getElementById('submitBtn');
const cooldownPanel = document.getElementById('cooldownPanel');
const cooldownTimer = document.getElementById('cooldownTimer');
const successOverlay = document.getElementById('successOverlay');
const successTaskId = document.getElementById('successTaskId');
const successDateTime = document.getElementById('successDateTime');
const closeSuccessBtn = document.getElementById('closeSuccessBtn');
const copyTaskBtn = document.getElementById('copyTaskBtn');
const statusResult = document.getElementById('statusResult');
const adminLoginOverlay = document.getElementById('adminLoginOverlay');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminPanel = document.getElementById('adminPanel');
const closeAdminBtn = document.getElementById('closeAdminBtn');
const adminSummary = document.getElementById('adminSummary');
const adminCards = document.getElementById('adminCards');
const adminSearchInput = document.getElementById('adminSearchInput');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const pageLoader = document.getElementById('pageLoader');
const statTotal = document.getElementById('statTotal');
const statActive = document.getElementById('statActive');
const scrollTriggers = document.querySelectorAll('[data-scroll]');

const STORAGE_KEY = 'arceusBookings';
const COOLDOWN_HOURS = 2;
const ADMIN_USER = 'Aashu';
const ADMIN_PASS = 'P23112009';
let bookings = [];
let activeCooldownId = null;
let countdownInterval = null;
let tabSequence = 0;
let tabTimer = null;

/* Utility Methods */
const getBookings = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
const saveBookings = (entries) => localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const getNextTaskId = () => {
  const latest = bookings.slice().sort((a, b) => b.createdAt - a.createdAt)[0];
  const nextIndex = latest ? Number(latest.taskId.replace('ARCEUS', '')) + 1 : 1;
  return `ARCEUS${String(nextIndex).padStart(3, '0')}`;
};

const showError = (field, message) => {
  const errorEl = document.querySelector(`[data-error-for="${field}"]`);
  if (errorEl) errorEl.textContent = message;
};

const clearErrors = () => {
  document.querySelectorAll('.error-message').forEach((el) => el.textContent = '');
};

const updateStats = () => {
  statTotal.textContent = bookings.length;
  statActive.textContent = bookings.filter((entry) => entry.status === 'Pending').length;
};

const getCooldownForTelegram = (telegramId) => {
  const activeBooking = bookings.find((entry) => entry.telegramId === telegramId && entry.cooldownExpires && entry.cooldownExpires > Date.now());
  return activeBooking || null;
};

const updateCooldownDisplay = (entry) => {
  if (!entry) {
    cooldownPanel.classList.add('hidden');
    submitBtn.disabled = false;
    return;
  }
  cooldownPanel.classList.remove('hidden');
  submitBtn.disabled = true;
  const remaining = entry.cooldownExpires - Date.now();
  if (remaining <= 0) {
    cooldownPanel.classList.add('hidden');
    submitBtn.disabled = false;
    clearInterval(countdownInterval);
    return;
  }
  const hours = String(Math.floor(remaining / 3600000)).padStart(2, '0');
  const minutes = String(Math.floor((remaining % 3600000) / 60000)).padStart(2, '0');
  const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
  cooldownTimer.textContent = `${hours}:${minutes}:${seconds}`;
};

const runCooldownLoop = (entry) => {
  if (countdownInterval) clearInterval(countdownInterval);
  updateCooldownDisplay(entry);
  if (!entry) return;
  countdownInterval = setInterval(() => {
    const latest = getCooldownForTelegram(entry.telegramId);
    if (!latest) {
      updateCooldownDisplay(null);
      clearInterval(countdownInterval);
      return;
    }
    updateCooldownDisplay(latest);
  }, 1000);
};

const showOverlay = (overlay) => {
  overlay.classList.remove('hidden');
};

const hideOverlay = (overlay) => {
  overlay.classList.add('hidden');
};

const renderStatusCard = (booking) => {
  if (!booking) {
    statusResult.innerHTML = '<div class="status-card"><h4>No booking found</h4><p>Please verify your Task ID and try again.</p></div>';
    return;
  }
  statusResult.innerHTML = `
    <div class="status-card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">
        <h4>${booking.taskId}</h4>
        <span class="status-badge ${booking.status.toLowerCase()}">${booking.status}</span>
      </div>
      <p><span>User Name:</span> ${booking.userName}</p>
      <p><span>Telegram Name:</span> ${booking.telegramName}</p>
      <p><span>Telegram ID:</span> ${booking.telegramId}</p>
      <p><span>Package:</span> ${booking.packageType} — ${booking.taskType}</p>
      <p><span>Quantity:</span> ${booking.quantity}</p>
      <p><span>Booked On:</span> ${formatDate(booking.createdAt)}</p>
      <p><span>Cooldown Remaining:</span> ${booking.cooldownExpires && booking.cooldownExpires > Date.now() ? `${Math.floor((booking.cooldownExpires - Date.now()) / 60000)} min` : 'None'}</p>
    </div>
  `;
};

const buildAdminSummary = () => {
  const total = bookings.length;
  const pending = bookings.filter((entry) => entry.status === 'Pending').length;
  const approved = bookings.filter((entry) => entry.status === 'Approved').length;
  const rejected = bookings.filter((entry) => entry.status === 'Rejected').length;
  const todayCount = bookings.filter((entry) => {
    const created = new Date(entry.createdAt);
    const today = new Date();
    return created.toDateString() === today.toDateString();
  }).length;
  adminSummary.innerHTML = `
    <div class="summary-card"><span>Total Bookings</span><strong>${total}</strong></div>
    <div class="summary-card"><span>Pending</span><strong>${pending}</strong></div>
    <div class="summary-card"><span>Approved</span><strong>${approved}</strong></div>
    <div class="summary-card"><span>Rejected</span><strong>${rejected}</strong></div>
    <div class="summary-card"><span>Today's Orders</span><strong>${todayCount}</strong></div>
  `;
};

const renderAdminCards = (filterText = '') => {
  const normalized = filterText.trim().toLowerCase();
  const filtered = bookings.filter((entry) => {
    if (!normalized) return true;
    return [entry.taskId, entry.telegramId, entry.userName].some((value) => value.toLowerCase().includes(normalized));
  });

  if (!filtered.length) {
    adminCards.innerHTML = '<div class="admin-card"><p>No matches found.</p></div>';
    return;
  }

  adminCards.innerHTML = filtered.map((entry) => {
    const remaining = entry.cooldownExpires && entry.cooldownExpires > Date.now()
      ? Math.floor((entry.cooldownExpires - Date.now()) / 60000) + ' min'
      : 'None';
    return `
      <div class="admin-card" data-id="${entry.taskId}">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
          <h4>${entry.taskId}</h4>
          <span class="status-block ${entry.status.toLowerCase()}">${entry.status}</span>
        </div>
        <div class="card-row">
          <div><span>User Name</span><strong>${entry.userName}</strong></div>
          <div><span>Telegram Name</span><strong>${entry.telegramName}</strong></div>
        </div>
        <div class="card-row">
          <div><span>Telegram ID</span><strong>${entry.telegramId}</strong></div>
          <div><span>Package</span><strong>${entry.packageType}</strong></div>
        </div>
        <div class="card-row">
          <div><span>Quantity</span><strong>${entry.quantity}</strong></div>
          <div><span>Booked</span><strong>${formatDate(entry.createdAt)}</strong></div>
        </div>
        <div class="card-row">
          <div><span>Cooldown</span><strong>${remaining}</strong></div>
          <div><span>Task Type</span><strong>${entry.taskType}</strong></div>
        </div>
        <div class="admin-actions">
          <button class="secondary-btn admin-btn" data-action="approve">Approve</button>
          <button class="secondary-btn admin-btn" data-action="reject">Reject</button>
          <button class="secondary-btn admin-btn" data-action="delete">Delete</button>
          <button class="ghost-btn admin-btn" data-action="reset">Reset Cooldown</button>
        </div>
      </div>
    `;
  }).join('');
};

const exportBookingsCsv = () => {
  if (!bookings.length) return;
  const headers = ['Task ID', 'User Name', 'Telegram Name', 'Telegram ID', 'Task Type', 'Package', 'Quantity', 'Status', 'Booked On', 'Cooldown Expires'];
  const rows = bookings.map((entry) => [
    entry.taskId,
    entry.userName,
    entry.telegramName,
    entry.telegramId,
    entry.taskType,
    entry.packageType,
    entry.quantity,
    entry.status,
    formatDate(entry.createdAt),
    entry.cooldownExpires ? formatDate(entry.cooldownExpires) : 'None'
  ]);
  const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'arceus-bookings.csv';
  link.click();
  URL.revokeObjectURL(link.href);
};

/* Form validation and submit handler */
bookingForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearErrors();

  const userName = document.getElementById('userName').value.trim();
  const telegramName = document.getElementById('telegramName').value.trim();
  const telegramId = document.getElementById('telegramId').value.trim();
  const taskType = document.getElementById('taskType').value;
  const packageType = document.getElementById('packageType').value;
  const quantityValue = document.getElementById('quantity').value;
  const quantity = Number(quantityValue);
  let isValid = true;

  if (!userName) {
    showError('userName', 'Please enter your name.');
    isValid = false;
  }
  if (!telegramName) {
    showError('telegramName', 'Please enter your Telegram name.');
    isValid = false;
  }
  if (!telegramId) {
    showError('telegramId', 'Telegram ID is required.');
    isValid = false;
  } else if (!telegramId.startsWith('@')) {
    showError('telegramId', 'Telegram ID must start with @.');
    isValid = false;
  }
  if (!taskType) {
    showError('taskType', 'Choose a task type.');
    isValid = false;
  }
  if (!packageType) {
    showError('packageType', 'Choose a package.');
    isValid = false;
  }
  if (!quantityValue || Number.isNaN(quantity)) {
    showError('quantity', 'Quantity is required.');
    isValid = false;
  } else if (quantity < 5 || quantity > 10) {
    showError('quantity', 'Quantity must be between 5 and 10.');
    isValid = false;
  }

  if (!isValid) return;

  const existingBooking = getCooldownForTelegram(telegramId);
  if (existingBooking) {
    activeCooldownId = existingBooking.taskId;
    runCooldownLoop(existingBooking);
    return;
  }

  const newBooking = {
    taskId: getNextTaskId(),
    userName,
    telegramName,
    telegramId,
    taskType,
    packageType,
    quantity,
    status: 'Pending',
    createdAt: Date.now(),
    cooldownExpires: Date.now() + COOLDOWN_HOURS * 60 * 60 * 1000
  };

  bookings.unshift(newBooking);
  saveBookings(bookings);
  updateStats();
  renderAdminCards(adminSearchInput.value);
  buildAdminSummary();
  showOverlay(successOverlay);
  successTaskId.textContent = newBooking.taskId;
  successDateTime.textContent = formatDate(newBooking.createdAt);
  bookingForm.reset();
  runCooldownLoop(newBooking);
});

bookingForm.addEventListener('reset', () => {
  clearErrors();
  cooldownPanel.classList.add('hidden');
});

statusForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const taskId = document.getElementById('statusTaskId').value.trim().toUpperCase();
  const booking = bookings.find((entry) => entry.taskId === taskId);
  renderStatusCard(booking);
});

copyTaskBtn.addEventListener('click', async () => {
  const value = successTaskId.textContent;
  if (!value) return;
  await navigator.clipboard.writeText(value);
  copyTaskBtn.textContent = 'Copied';
  setTimeout(() => { copyTaskBtn.textContent = 'Copy Task ID'; }, 1500);
});

closeSuccessBtn.addEventListener('click', () => hideOverlay(successOverlay));

/* Admin login trigger using TAB key sequence */
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  tabSequence += 1;
  clearTimeout(tabTimer);
  tabTimer = setTimeout(() => { tabSequence = 0; }, 3200);
  if (tabSequence === 9) {
    showOverlay(adminLoginOverlay);
    tabSequence = 0;
  }
});

adminLoginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const username = document.getElementById('adminUser').value.trim();
  const password = document.getElementById('adminPass').value.trim();
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    hideOverlay(adminLoginOverlay);
    showOverlay(adminPanel);
    buildAdminSummary();
    renderAdminCards();
    return;
  }
  alert('Invalid admin credentials.');
});

closeAdminBtn.addEventListener('click', () => hideOverlay(adminPanel));

adminSearchInput.addEventListener('input', () => renderAdminCards(adminSearchInput.value));
exportCsvBtn.addEventListener('click', exportBookingsCsv);

adminCards.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const card = button.closest('.admin-card');
  const taskId = card?.dataset.id;
  const action = button.dataset.action;
  if (!taskId || !action) return;

  const index = bookings.findIndex((entry) => entry.taskId === taskId);
  if (index === -1) return;
  const booking = bookings[index];

  switch (action) {
    case 'approve':
      booking.status = 'Approved';
      break;
    case 'reject':
      booking.status = 'Rejected';
      break;
    case 'delete':
      bookings.splice(index, 1);
      break;
    case 'reset':
      booking.cooldownExpires = Date.now();
      break;
  }
  saveBookings(bookings);
  updateStats();
  buildAdminSummary();
  renderAdminCards(adminSearchInput.value);
});

scrollTriggers.forEach((button) => {
  button.addEventListener('click', () => {
    const target = document.getElementById(button.dataset.scroll);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

window.addEventListener('load', () => {
  bookings = getBookings();
  updateStats();
  renderAdminCards();
  buildAdminSummary();
  setTimeout(() => {
    pageLoader.style.display = 'none';
  }, 600);
});

window.addEventListener('beforeunload', () => {
  if (countdownInterval) clearInterval(countdownInterval);
});
