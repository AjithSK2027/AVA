const API_BASE = window.C18_API_BASE || "";
const STORAGE_KEY = "c18-pms-state-v1";
const SESSION_KEY = "c18-pms-session-v1";
const APP_VERSION = 1;
const SYNC_INTERVAL_MS = 8000;

const BOOKING_SOURCES = [
  "Direct",
  "WhatsApp",
  "Phone Call",
  "Travel Agent",
  "Booking.com",
  "Airbnb",
  "MakeMyTrip",
  "Walk-in"
];

const BOOKING_STATUSES = [
  "Inquiry",
  "Tentative Hold",
  "Confirmed",
  "Checked In",
  "Checked Out",
  "Cancelled",
  "No Show",
  "Blocked"
];

const BLOCKING_STATUSES = new Set(["Tentative Hold", "Confirmed", "Checked In", "Blocked"]);
const CALENDAR_STATUSES = new Set(["Inquiry", "Tentative Hold", "Confirmed", "Checked In", "Checked Out", "Blocked"]);
const REVENUE_STATUSES = new Set(["Confirmed", "Checked In", "Checked Out"]);
const OCCUPANCY_STATUSES = new Set(["Confirmed", "Checked In", "Checked Out"]);

const viewMeta = {
  dashboard: ["Dashboard", "Live operations"],
  availability: ["Availability", "Room calendar"],
  bookings: ["Bookings", "Reservation desk"],
  search: ["Search Availability", "Instant inventory"],
  reports: ["Reports", "Occupancy and revenue"],
  admin: ["Admin", "Properties and agents"]
};

const integrations = [
  ["Booking.com API", "Ready for channel sync"],
  ["Airbnb API", "Ready for iCal/API sync"],
  ["WhatsApp notifications", "Webhook slot prepared"],
  ["Payment gateway", "Checkout slot prepared"],
  ["Google Calendar sync", "Calendar slot prepared"]
];

const state = {
  data: null,
  user: null,
  activeView: "dashboard",
  calendarMode: "month",
  calendarAnchor: todayIso(),
  draggedBookingId: null
};

const els = {};
const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  await refreshSnapshot();
  setupInitialFormDates();
  populateLoginUsers();
  bindEvents();
  restoreSession();
  renderAll();
  startLiveSync();
}

function cacheElements() {
  [
    "loginView", "loginForm", "loginUser", "loginPin", "appView", "userName", "userRole",
    "syncStatus", "logoutBtn", "viewTitle", "viewSubtitle", "openBookingBtn",
    "mobileBookingBtn", "exportBookingsBtn", "dashboardMetrics", "arrivalsList",
    "departuresList", "occupancyBars", "dashboardRevenue", "upcomingList",
    "notificationList", "calendarPropertyFilter", "calendarRoomTypeFilter", "calendarPrev",
    "calendarToday", "calendarNext", "calendarLabel", "availabilityCalendar",
    "bookingSearch", "bookingPropertyFilter", "bookingStatusFilter", "bookingSourceFilter",
    "bookingTable", "availabilitySearchForm", "searchCheckIn", "searchCheckOut",
    "searchProperty", "searchRoomType", "availabilityResults", "reportRange",
    "reportProperty", "reportSummary", "occupancyReport", "revenueReport",
    "bookingReport", "exportCsvBtn", "exportExcelBtn", "exportPdfBtn", "propertyForm",
    "propertyName", "propertyList", "roomTypeForm", "typeProperty", "roomTypeName",
    "roomForm", "roomProperty", "roomType", "roomName", "roomCapacity", "roomList",
    "agentForm", "agentName", "agentRole", "agentPin", "agentList", "blockForm",
    "blockProperty", "blockRoom", "blockFrom", "blockTo", "blockNotes", "integrationList",
    "bookingModal", "bookingForm", "modalTitle", "bookingId", "guestName",
    "guestPhone", "guestEmail", "guestCount", "checkInDate", "checkOutDate",
    "bookingProperty", "bookingRoomType", "bookingRoom", "bookingSource",
    "bookingStatus", "totalAmount", "amountPaid", "balanceDue", "specialNotes",
    "conflictWarning", "bookingHistory", "deleteBookingBtn", "cancelBookingBtn", "toast"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.loginForm.addEventListener("submit", handleLogin);
  els.logoutBtn.addEventListener("click", logout);
  els.openBookingBtn.addEventListener("click", () => openBookingModal());
  els.mobileBookingBtn.addEventListener("click", () => openBookingModal());
  els.exportBookingsBtn.addEventListener("click", () => exportBookings("csv"));

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeBookingModal);
  });

  els.bookingModal.addEventListener("click", (event) => {
    if (event.target === els.bookingModal) closeBookingModal();
  });

  els.calendarPropertyFilter.addEventListener("change", () => {
    populateAllSelects();
    renderAvailability();
  });
  els.calendarRoomTypeFilter.addEventListener("change", renderAvailability);
  document.querySelectorAll("[data-calendar-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.calendarMode = button.dataset.calendarMode;
      document.querySelectorAll("[data-calendar-mode]").forEach((b) => b.classList.toggle("active", b === button));
      renderAvailability();
    });
  });
  els.calendarPrev.addEventListener("click", () => moveCalendar(-1));
  els.calendarToday.addEventListener("click", () => {
    state.calendarAnchor = todayIso();
    renderAvailability();
  });
  els.calendarNext.addEventListener("click", () => moveCalendar(1));

  ["input", "change"].forEach((eventName) => {
    els.bookingSearch.addEventListener(eventName, renderBookings);
    els.bookingPropertyFilter.addEventListener(eventName, renderBookings);
    els.bookingStatusFilter.addEventListener(eventName, renderBookings);
    els.bookingSourceFilter.addEventListener(eventName, renderBookings);
  });

  els.availabilitySearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderSearchResults();
  });
  els.searchProperty.addEventListener("change", () => {
    populateAllSelects();
    renderSearchResults();
  });
  els.searchRoomType.addEventListener("change", renderSearchResults);
  els.searchCheckIn.addEventListener("change", renderSearchResults);
  els.searchCheckOut.addEventListener("change", renderSearchResults);

  els.reportRange.addEventListener("change", renderReports);
  els.reportProperty.addEventListener("change", renderReports);
  els.exportCsvBtn.addEventListener("click", () => exportBookings("csv"));
  els.exportExcelBtn.addEventListener("click", () => exportBookings("excel"));
  els.exportPdfBtn.addEventListener("click", () => window.print());

  els.bookingForm.addEventListener("submit", saveBookingFromForm);
  [
    els.checkInDate, els.checkOutDate, els.bookingProperty, els.bookingRoomType,
    els.bookingRoom, els.bookingStatus, els.totalAmount, els.amountPaid
  ].forEach((input) => input.addEventListener("change", handleBookingFormChange));
  els.totalAmount.addEventListener("input", updateBalanceAndConflict);
  els.amountPaid.addEventListener("input", updateBalanceAndConflict);
  els.deleteBookingBtn.addEventListener("click", deleteCurrentBooking);
  els.cancelBookingBtn.addEventListener("click", cancelCurrentBooking);

  els.propertyForm.addEventListener("submit", saveProperty);
  els.roomTypeForm.addEventListener("submit", saveRoomType);
  els.roomForm.addEventListener("submit", saveRoom);
  els.agentForm.addEventListener("submit", saveAgent);
  els.blockForm.addEventListener("submit", saveBlock);
  els.roomProperty.addEventListener("change", () => populateAdminRoomTypes());
  els.blockProperty.addEventListener("change", () => populateBlockRooms());

  document.addEventListener("click", handleActionClick);
  bindCalendarDrag();

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || API_BASE || !state.user) return;
    state.data = normalizeData(JSON.parse(event.newValue));
    renderAll();
    showToast("Availability updated in another tab");
  });
}

function bindCalendarDrag() {
  els.availabilityCalendar.addEventListener("dragstart", (event) => {
    const chip = event.target.closest("[data-booking-id]");
    if (!chip) return;
    state.draggedBookingId = chip.dataset.bookingId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", state.draggedBookingId);
  });

  els.availabilityCalendar.addEventListener("dragover", (event) => {
    const cell = event.target.closest(".availability-cell");
    if (!cell) return;
    event.preventDefault();
    cell.classList.add("drag-over");
  });

  els.availabilityCalendar.addEventListener("dragleave", (event) => {
    const cell = event.target.closest(".availability-cell");
    if (cell) cell.classList.remove("drag-over");
  });

  els.availabilityCalendar.addEventListener("drop", async (event) => {
    const cell = event.target.closest(".availability-cell");
    if (!cell) return;
    event.preventDefault();
    cell.classList.remove("drag-over");
    const bookingId = event.dataTransfer.getData("text/plain") || state.draggedBookingId;
    state.draggedBookingId = null;
    await moveBookingToCell(bookingId, cell.dataset.roomId, cell.dataset.date);
  });
}

function handleActionClick(event) {
  const actionNode = event.target.closest("[data-action]");
  if (!actionNode) return;
  const action = actionNode.dataset.action;
  const id = actionNode.dataset.id;

  if (action === "edit-booking") {
    openBookingModal(getBooking(id));
  }
  if (action === "quick-book") {
    const room = getRoom(id);
    openBookingModal(null, {
      propertyId: room.propertyId,
      roomType: room.roomType,
      roomId: room.id,
      checkIn: els.searchCheckIn.value,
      checkOut: els.searchCheckOut.value
    });
  }
  if (action === "toggle-room") {
    mutate("toggleRoom", { id, active: actionNode.dataset.active !== "true" });
  }
  if (action === "toggle-user") {
    mutate("toggleUser", { id, active: actionNode.dataset.active !== "true" });
  }
}

function restoreSession() {
  const savedUserId = sessionStorage.getItem(SESSION_KEY);
  if (!savedUserId) return;
  const user = getUser(savedUserId);
  if (!user || !user.isActive) return;
  state.user = sanitizeUser(user);
  showApp();
}

async function handleLogin(event) {
  event.preventDefault();
  const userId = els.loginUser.value;
  const pin = els.loginPin.value.trim();
  if (!userId || !pin) {
    showToast("Select a user and enter PIN", true);
    return;
  }

  try {
    if (API_BASE) {
      const response = await apiPost("login", { userId, pin });
      state.user = response.user;
      await refreshSnapshot();
    } else {
      const user = getUser(userId);
      if (!user || !user.isActive || String(user.pin) !== pin) throw new Error("Invalid user or PIN");
      state.user = sanitizeUser(user);
    }
    sessionStorage.setItem(SESSION_KEY, state.user.id);
    els.loginPin.value = "";
    showApp();
    showToast(`Welcome, ${state.user.name}`);
  } catch (error) {
    showToast(error.message || "Login failed", true);
  }
}

function showApp() {
  els.loginView.hidden = true;
  els.appView.hidden = false;
  els.userName.textContent = state.user.name;
  els.userRole.textContent = titleCase(state.user.role);
  document.querySelectorAll(".admin-nav").forEach((node) => {
    node.hidden = state.user.role !== "admin";
  });
  if (state.activeView === "admin" && state.user.role !== "admin") state.activeView = "dashboard";
  switchView(state.activeView);
  renderAll();
}

function logout() {
  state.user = null;
  sessionStorage.removeItem(SESSION_KEY);
  els.appView.hidden = true;
  els.loginView.hidden = false;
  showToast("Signed out");
}

function switchView(view) {
  if (view === "admin" && state.user?.role !== "admin") {
    showToast("Admin access required", true);
    return;
  }
  state.activeView = view;
  document.querySelectorAll(".view").forEach((node) => node.classList.remove("active"));
  document.getElementById(`${view}View`)?.classList.add("active");
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  els.viewTitle.textContent = viewMeta[view][0];
  els.viewSubtitle.textContent = viewMeta[view][1];
  renderAll();
}

async function refreshSnapshot() {
  if (API_BASE) {
    try {
      const response = await apiGet("snapshot");
      state.data = normalizeData(response.data || response);
      els.syncStatus.textContent = `Cloud sync ${formatTime(new Date())}`;
      return;
    } catch (error) {
      if (!state.data) state.data = loadLocalData();
      els.syncStatus.textContent = "Cloud unavailable, using local data";
      console.error(error);
      return;
    }
  }

  state.data = loadLocalData();
  if (els.syncStatus) els.syncStatus.textContent = "Local demo mode";
}

function startLiveSync() {
  setInterval(async () => {
    if (!state.user) return;
    if (API_BASE) {
      await refreshSnapshot();
      renderAll();
      return;
    }
    const latest = loadLocalData();
    if (latest.updatedAt !== state.data.updatedAt) {
      state.data = latest;
      renderAll();
    }
  }, SYNC_INTERVAL_MS);
}

async function mutate(action, payload) {
  try {
    if (API_BASE) {
      const response = await apiPost(action, { ...payload, actorUserId: state.user.id });
      if (response.data) state.data = normalizeData(response.data);
      else await refreshSnapshot();
    } else {
      const response = localAction(action, payload);
      state.data = normalizeData(response.data);
    }
    renderAll();
    showToast(successMessage(action));
    return true;
  } catch (error) {
    showToast(error.message || "Action failed", true);
    return false;
  }
}

function localAction(action, payload) {
  const data = loadLocalData();
  const actor = getUserFromData(data, state.user.id);

  if (!actor) throw new Error("Session expired");

  if (action === "createBooking") {
    const booking = normalizeBookingPayload(payload.booking);
    assertNoConflict(booking, data);
    booking.id = uid("booking");
    booking.createdAt = nowIso();
    booking.updatedAt = nowIso();
    booking.agentId = actor.id;
    booking.agentName = actor.name;
    booking.balanceDue = balanceFor(booking);
    data.bookings.unshift(booking);
    addLog(data, booking.id, actor.name, `Created booking as ${booking.status}`);
    addNotification(data, "New booking", `${booking.guestName} at ${roomName(booking.roomId, data)}`);
  }

  if (action === "updateBooking") {
    const next = normalizeBookingPayload(payload.booking);
    assertNoConflict(next, data);
    const index = data.bookings.findIndex((booking) => booking.id === next.id);
    if (index < 0) throw new Error("Booking not found");
    const previous = data.bookings[index];
    data.bookings[index] = {
      ...previous,
      ...next,
      updatedAt: nowIso(),
      agentId: previous.agentId || actor.id,
      agentName: previous.agentName || actor.name,
      balanceDue: balanceFor(next)
    };
    addLog(data, next.id, actor.name, `Updated booking to ${next.status}`);
    if (previous.status !== "Cancelled" && next.status === "Cancelled") {
      addNotification(data, "Booking cancelled", `${next.guestName} at ${roomName(next.roomId, data)}`);
    }
  }

  if (action === "cancelBooking") {
    const booking = data.bookings.find((item) => item.id === payload.id);
    if (!booking) throw new Error("Booking not found");
    booking.status = "Cancelled";
    booking.cancelledAt = nowIso();
    booking.updatedAt = nowIso();
    addLog(data, booking.id, actor.name, "Cancelled booking");
    addNotification(data, "Booking cancelled", `${booking.guestName} at ${roomName(booking.roomId, data)}`);
  }

  if (action === "deleteBooking") {
    if (actor.role !== "admin") throw new Error("Only admins can delete bookings");
    const index = data.bookings.findIndex((booking) => booking.id === payload.id);
    if (index < 0) throw new Error("Booking not found");
    data.bookings.splice(index, 1);
  }

  if (action === "upsertProperty") {
    requireAdmin(actor);
    const name = clean(payload.name);
    if (!name) throw new Error("Property name is required");
    if (data.properties.some((property) => same(property.name, name))) throw new Error("Property already exists");
    data.properties.push({ id: uid("property"), name, roomTypes: [], active: true });
  }

  if (action === "upsertRoomType") {
    requireAdmin(actor);
    const property = data.properties.find((item) => item.id === payload.propertyId);
    const roomType = clean(payload.roomType);
    if (!property) throw new Error("Property not found");
    if (!roomType) throw new Error("Room type is required");
    if (!property.roomTypes.some((item) => same(item, roomType))) property.roomTypes.push(roomType);
  }

  if (action === "upsertRoom") {
    requireAdmin(actor);
    const property = data.properties.find((item) => item.id === payload.propertyId);
    if (!property) throw new Error("Property not found");
    const roomType = clean(payload.roomType);
    const name = clean(payload.name);
    const capacity = Math.max(1, Number(payload.capacity || 1));
    if (!roomType || !name) throw new Error("Room type and room name are required");
    if (!property.roomTypes.some((item) => same(item, roomType))) property.roomTypes.push(roomType);
    data.rooms.push({ id: uid("room"), propertyId: property.id, roomType, name, capacity, active: true });
  }

  if (action === "toggleRoom") {
    requireAdmin(actor);
    const room = data.rooms.find((item) => item.id === payload.id);
    if (!room) throw new Error("Room not found");
    room.active = Boolean(payload.active);
  }

  if (action === "upsertUser") {
    requireAdmin(actor);
    const name = clean(payload.name);
    const role = payload.role === "admin" ? "admin" : "agent";
    const pin = clean(payload.pin);
    if (!name || !pin) throw new Error("Agent name and PIN are required");
    data.users.push({ id: uid("user"), name, role, pin, isActive: true });
  }

  if (action === "toggleUser") {
    requireAdmin(actor);
    const user = data.users.find((item) => item.id === payload.id);
    if (!user) throw new Error("Agent not found");
    if (user.id === actor.id && payload.active === false) throw new Error("You cannot deactivate your own account");
    user.isActive = Boolean(payload.active);
  }

  if (action === "blockRoom") {
    requireAdmin(actor);
    const room = data.rooms.find((item) => item.id === payload.roomId);
    if (!room) throw new Error("Room not found");
    const booking = {
      id: uid("booking"),
      guestName: "Blocked",
      phone: "",
      email: "",
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
      guests: 0,
      propertyId: room.propertyId,
      roomType: room.roomType,
      roomId: room.id,
      source: "Direct",
      status: "Blocked",
      totalAmount: 0,
      amountPaid: 0,
      balanceDue: 0,
      notes: clean(payload.notes),
      agentId: actor.id,
      agentName: actor.name,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    assertNoConflict(booking, data);
    data.bookings.unshift(booking);
    addLog(data, booking.id, actor.name, "Blocked room");
  }

  saveLocalData(data);
  return { success: true, data };
}

function renderAll() {
  if (!state.data) return;
  populateAllSelects();
  populateLoginUsers();
  if (!state.user) {
    refreshIcons();
    return;
  }
  renderDashboard();
  renderAvailability();
  renderBookings();
  renderSearchResults();
  renderReports();
  renderAdmin();
  refreshIcons();
}

function renderDashboard() {
  const stats = getDashboardStats();
  const metrics = [
    ["Today's arrivals", stats.arrivals.length, "Check-ins"],
    ["Today's departures", stats.departures.length, "Check-outs"],
    ["Current occupancy", `${stats.occupancyPercent}%`, `${stats.occupiedRooms}/${stats.totalRooms} rooms`],
    ["Available rooms", stats.availableRooms, "Right now"],
    ["Upcoming bookings", stats.upcoming.length, "Next 14 days"],
    ["Month revenue", money.format(stats.monthRevenue), "Confirmed stays"]
  ];

  els.dashboardMetrics.innerHTML = metrics.map(([label, value, hint]) => `
    <article class="metric-card">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(hint)}</span>
    </article>
  `).join("");

  renderBookingList(els.arrivalsList, stats.arrivals, "No arrivals today.");
  renderBookingList(els.departuresList, stats.departures, "No departures today.");
  renderBookingList(els.upcomingList, stats.upcoming.slice(0, 8), "No upcoming bookings.");

  els.occupancyBars.innerHTML = stats.propertyOccupancy.map((item) => barHtml(item.name, item.percent, `${item.occupied}/${item.total} rooms`)).join("");
  els.dashboardRevenue.innerHTML = `
    <div class="money-tile"><small>Total amount</small><strong>${money.format(stats.totalRevenue)}</strong></div>
    <div class="money-tile"><small>Paid</small><strong>${money.format(stats.totalPaid)}</strong></div>
    <div class="money-tile"><small>Balance due</small><strong>${money.format(stats.totalBalance)}</strong></div>
    <div class="money-tile"><small>This month</small><strong>${money.format(stats.monthRevenue)}</strong></div>
  `;

  const notifications = getNotifications().slice(0, 7);
  els.notificationList.innerHTML = notifications.length
    ? notifications.map((item) => `<div class="notification-item"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.body)} - ${formatDateTime(item.at)}</small></div>`).join("")
    : emptyHtml("No notifications.");
}

function renderBookingList(container, bookings, emptyText) {
  container.innerHTML = bookings.length
    ? bookings.map((booking) => `
      <button class="feed-item as-button" type="button" data-action="edit-booking" data-id="${escapeHtml(booking.id)}">
        <strong>${escapeHtml(booking.guestName)}</strong>
        <small>${escapeHtml(roomName(booking.roomId))} - ${formatStay(booking)}</small>
      </button>
    `).join("")
    : emptyHtml(emptyText);
}

function renderAvailability() {
  const { dates, label } = getCalendarRange();
  const propertyId = els.calendarPropertyFilter.value;
  const roomType = els.calendarRoomTypeFilter.value;
  const rooms = getActiveRooms({ propertyId, roomType });
  const minCol = state.calendarMode === "week" ? 132 : 92;

  els.calendarLabel.textContent = label;
  if (!rooms.length) {
    els.availabilityCalendar.innerHTML = emptyHtml("No rooms match the selected filters.");
    return;
  }

  let html = `<div class="calendar-grid" style="grid-template-columns:210px repeat(${dates.length}, minmax(${minCol}px, 1fr));">`;
  html += `<div class="calendar-cell room-head">Rooms</div>`;
  dates.forEach((date) => {
    html += `<div class="calendar-cell date-head ${date === todayIso() ? "today" : ""}">
      <strong>${escapeHtml(formatDayNumber(date))}</strong>
      <span>${escapeHtml(formatWeekday(date))}</span>
    </div>`;
  });

  rooms.forEach((room) => {
    const property = getProperty(room.propertyId);
    html += `<div class="calendar-cell room-cell">
      <strong>${escapeHtml(room.name)}</strong>
      <span>${escapeHtml(property?.name || "")} - ${escapeHtml(room.roomType)} - ${room.capacity} pax</span>
    </div>`;
    dates.forEach((date) => {
      const booking = getCalendarBooking(room.id, date);
      const classes = booking ? statusClass(booking.status) : "available";
      html += `<div class="calendar-cell availability-cell ${classes}" data-room-id="${escapeHtml(room.id)}" data-date="${escapeHtml(date)}">`;
      if (booking) {
        html += `<div class="booking-chip ${classes}" draggable="true" data-action="edit-booking" data-id="${escapeHtml(booking.id)}" data-booking-id="${escapeHtml(booking.id)}">
          <span>${escapeHtml(booking.guestName)}</span>
          <small>${escapeHtml(shortStatus(booking.status))}</small>
        </div>`;
      } else {
        html += `<span class="available-dot" title="Available"></span>`;
      }
      html += `</div>`;
    });
  });
  html += `</div>`;
  els.availabilityCalendar.innerHTML = html;
  refreshIcons();
}

function renderBookings() {
  const bookings = getFilteredBookings();
  els.bookingTable.innerHTML = bookings.length
    ? bookings.map((booking) => {
      const room = getRoom(booking.roomId);
      const property = getProperty(booking.propertyId);
      return `<tr>
        <td><strong>${escapeHtml(booking.guestName)}</strong><br><small>${escapeHtml(booking.phone || booking.email || "")}</small></td>
        <td>${formatStay(booking)}<br><small>${nightsBetween(booking.checkIn, booking.checkOut)} night(s)</small></td>
        <td>${escapeHtml(room?.name || "")}<br><small>${escapeHtml(property?.name || "")} - ${escapeHtml(booking.roomType)}</small></td>
        <td>${escapeHtml(booking.source)}<br><small>${escapeHtml(booking.agentName || "")}</small></td>
        <td><span class="status-pill ${statusClass(booking.status)}">${escapeHtml(booking.status)}</span></td>
        <td>${money.format(Number(booking.balanceDue || 0))}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-soft" type="button" data-action="edit-booking" data-id="${escapeHtml(booking.id)}"><i data-lucide="pencil"></i>Edit</button>
          </div>
        </td>
      </tr>`;
    }).join("")
    : `<tr><td colspan="7">${emptyHtml("No bookings match your filters.")}</td></tr>`;
  refreshIcons();
}

function renderSearchResults() {
  if (!els.searchCheckIn.value || !els.searchCheckOut.value) return;
  const checkIn = els.searchCheckIn.value;
  const checkOut = els.searchCheckOut.value;
  const propertyId = els.searchProperty.value;
  const roomType = els.searchRoomType.value;

  if (checkOut <= checkIn) {
    els.availabilityResults.innerHTML = `<div class="result-column">${emptyHtml("Check-out must be after check-in.")}</div>`;
    return;
  }

  const rooms = getActiveRooms({ propertyId, roomType });
  const available = rooms.filter((room) => !findConflicts({ roomId: room.id, checkIn, checkOut, status: "Confirmed" }).length);
  const occupied = rooms.filter((room) => {
    const conflicts = findConflicts({ roomId: room.id, checkIn, checkOut, status: "Confirmed" });
    return conflicts.some((booking) => booking.status !== "Tentative Hold");
  });
  const holds = getBookings().filter((booking) => {
    if (booking.status !== "Tentative Hold") return false;
    if (propertyId && booking.propertyId !== propertyId) return false;
    if (roomType && booking.roomType !== roomType) return false;
    return rangesOverlap(checkIn, checkOut, booking.checkIn, booking.checkOut);
  });
  const alternatives = suggestAlternatives(checkIn, checkOut, propertyId, roomType, null).slice(0, 6);

  els.availabilityResults.innerHTML = `
    <section class="result-column">
      <h3>Available rooms</h3>
      ${available.length ? available.map(roomResultHtml).join("") : emptyHtml("No available rooms.")}
    </section>
    <section class="result-column">
      <h3>Occupied rooms</h3>
      ${occupied.length ? occupied.map((room) => roomResultHtml(room, false)).join("") : emptyHtml("No occupied rooms.")}
      <h3>Tentative holds</h3>
      ${holds.length ? holds.map((booking) => `<div class="room-result"><strong>${escapeHtml(roomName(booking.roomId))}</strong><small>${escapeHtml(booking.guestName)} - ${formatStay(booking)}</small></div>`).join("") : emptyHtml("No holds for this search.")}
    </section>
    <section class="result-column">
      <h3>Suggested alternatives</h3>
      ${alternatives.length ? alternatives.map(roomResultHtml).join("") : emptyHtml("No alternatives found.")}
    </section>
  `;
  refreshIcons();
}

function roomResultHtml(room, canBook = true) {
  const property = getProperty(room.propertyId);
  return `<div class="room-result">
    <strong>${escapeHtml(room.name)}</strong>
    <small>${escapeHtml(property?.name || "")} - ${escapeHtml(room.roomType)} - ${room.capacity} pax</small>
    ${canBook ? `<button class="btn btn-soft" type="button" data-action="quick-book" data-id="${escapeHtml(room.id)}"><i data-lucide="plus"></i>Book</button>` : ""}
  </div>`;
}

function renderReports() {
  const range = getReportRange();
  const propertyId = els.reportProperty.value;
  const rooms = getActiveRooms({ propertyId });
  const bookings = getBookings().filter((booking) => {
    if (propertyId && booking.propertyId !== propertyId) return false;
    return rangesOverlap(range.start, range.end, booking.checkIn, booking.checkOut);
  });
  const revenueBookings = bookings.filter((booking) => REVENUE_STATUSES.has(booking.status));
  const totalRevenue = sum(revenueBookings, "totalAmount");
  const totalPaid = sum(revenueBookings, "amountPaid");
  const totalBalance = sum(revenueBookings, "balanceDue");
  const occupiedNights = bookings.reduce((total, booking) => {
    if (!OCCUPANCY_STATUSES.has(booking.status)) return total;
    return total + overlapNights(range.start, range.end, booking.checkIn, booking.checkOut);
  }, 0);
  const totalNights = Math.max(1, rooms.length * nightsBetween(range.start, range.end));
  const occupancyPercent = Math.round((occupiedNights / totalNights) * 100);

  els.reportSummary.innerHTML = [
    ["Occupancy", `${occupancyPercent}%`, `${occupiedNights}/${totalNights} room nights`],
    ["Revenue", money.format(totalRevenue), "Property-wise total"],
    ["Paid", money.format(totalPaid), "Collected amount"],
    ["Balance", money.format(totalBalance), "Due amount"],
    ["Future", getBookings().filter((booking) => booking.checkIn >= todayIso() && activeBooking(booking)).length, "Upcoming"],
    ["Cancelled", getBookings().filter((booking) => booking.status === "Cancelled").length, "All time"]
  ].map(([label, value, hint]) => `<article class="metric-card"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><span>${escapeHtml(hint)}</span></article>`).join("");

  els.occupancyReport.innerHTML = propertyOccupancy(range.start, range.end, propertyId).map((item) => barHtml(item.name, item.percent, `${item.occupiedNights}/${item.totalNights} room nights`)).join("");
  els.revenueReport.innerHTML = [
    ...groupRevenue("propertyId", revenueBookings).map((item) => barHtml(item.label, percentOf(item.value, totalRevenue), money.format(item.value))),
    ...groupRevenue("agentName", revenueBookings).map((item) => barHtml(`Agent: ${item.label}`, percentOf(item.value, totalRevenue), money.format(item.value))),
    ...groupRevenue("source", revenueBookings).map((item) => barHtml(`Source: ${item.label}`, percentOf(item.value, totalRevenue), money.format(item.value)))
  ].join("") || emptyHtml("No revenue in this period.");
  els.bookingReport.innerHTML = bookingReportItems().map((item) => `<div class="list-item"><strong>${escapeHtml(item.label)}</strong><small>${item.count} booking(s)</small></div>`).join("");
}

function renderAdmin() {
  if (state.user.role !== "admin") return;

  els.propertyList.innerHTML = state.data.properties.map((property) => {
    const rooms = state.data.rooms.filter((room) => room.propertyId === property.id);
    return `<div class="property-item">
      <div><strong>${escapeHtml(property.name)}</strong><small>${property.roomTypes.length} room type(s), ${rooms.length} room(s)</small></div>
    </div>`;
  }).join("");

  els.roomList.innerHTML = state.data.rooms.map((room) => {
    const property = getProperty(room.propertyId);
    return `<div class="room-item">
      <div><strong>${escapeHtml(room.name)}</strong><small>${escapeHtml(property?.name || "")} - ${escapeHtml(room.roomType)} - ${room.capacity} pax</small></div>
      <button class="btn btn-soft" type="button" data-action="toggle-room" data-id="${escapeHtml(room.id)}" data-active="${room.active ? "true" : "false"}">${room.active ? "Mark inactive" : "Activate"}</button>
    </div>`;
  }).join("");

  els.agentList.innerHTML = state.data.users.map((user) => `<div class="agent-item">
    <div><strong>${escapeHtml(user.name)}</strong><small>${titleCase(user.role)} - ${user.isActive ? "Active" : "Inactive"}</small></div>
    <button class="btn btn-soft" type="button" data-action="toggle-user" data-id="${escapeHtml(user.id)}" data-active="${user.isActive ? "true" : "false"}">${user.isActive ? "Deactivate" : "Activate"}</button>
  </div>`).join("");

  els.integrationList.innerHTML = integrations.map(([name, status]) => `<div class="integration-card"><div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(status)}</span></div><span class="status-pill blocked">Future</span></div>`).join("");
}

function populateLoginUsers() {
  if (!state.data || !els.loginUser) return;
  const current = els.loginUser.value;
  setOptions(els.loginUser, state.data.users.filter((user) => user.isActive).map((user) => ({
    value: user.id,
    label: `${user.name} - ${titleCase(user.role)}`
  })), "Select user", current);
}

function populateAllSelects() {
  if (!state.data) return;
  const propertyOptions = state.data.properties.filter((property) => property.active !== false).map((property) => ({ value: property.id, label: property.name }));
  const statusOptions = BOOKING_STATUSES.map((status) => ({ value: status, label: status }));
  const sourceOptions = BOOKING_SOURCES.map((source) => ({ value: source, label: source }));

  setOptions(els.calendarPropertyFilter, propertyOptions, "All properties", els.calendarPropertyFilter.value, true);
  setOptions(els.calendarRoomTypeFilter, roomTypeOptions(els.calendarPropertyFilter.value), "All room types", els.calendarRoomTypeFilter.value, true);
  setOptions(els.bookingPropertyFilter, propertyOptions, "All properties", els.bookingPropertyFilter.value, true);
  setOptions(els.bookingStatusFilter, statusOptions, "All statuses", els.bookingStatusFilter.value, true);
  setOptions(els.bookingSourceFilter, sourceOptions, "All sources", els.bookingSourceFilter.value, true);
  setOptions(els.searchProperty, propertyOptions, "All properties", els.searchProperty.value, true);
  setOptions(els.searchRoomType, roomTypeOptions(els.searchProperty.value), "All room types", els.searchRoomType.value, true);
  setOptions(els.reportProperty, propertyOptions, "All properties", els.reportProperty.value, true);
  setOptions(els.typeProperty, propertyOptions, null, els.typeProperty.value);
  setOptions(els.roomProperty, propertyOptions, null, els.roomProperty.value);
  setOptions(els.blockProperty, propertyOptions, null, els.blockProperty.value);
  populateAdminRoomTypes();
  populateBlockRooms();
}

function populateBookingSelects(booking = null, defaults = {}) {
  const properties = state.data.properties.filter((property) => property.active !== false || property.id === booking?.propertyId);
  const propertyId = booking?.propertyId || defaults.propertyId || properties[0]?.id || "";
  setOptions(els.bookingProperty, properties.map((property) => ({ value: property.id, label: property.name })), null, propertyId);
  populateBookingRoomTypes(booking?.roomType || defaults.roomType);
  populateBookingRooms(booking?.roomId || defaults.roomId);
  setOptions(els.bookingSource, BOOKING_SOURCES.map((source) => ({ value: source, label: source })), null, booking?.source || defaults.source || "Direct");
  const statuses = state.user.role === "admin" ? BOOKING_STATUSES : BOOKING_STATUSES.filter((status) => status !== "Blocked");
  setOptions(els.bookingStatus, statuses.map((status) => ({ value: status, label: status })), null, booking?.status || defaults.status || "Confirmed");
}

function populateBookingRoomTypes(selectedRoomType) {
  setOptions(els.bookingRoomType, roomTypeOptions(els.bookingProperty.value), null, selectedRoomType);
}

function populateBookingRooms(selectedRoomId) {
  const propertyId = els.bookingProperty.value;
  const roomType = els.bookingRoomType.value;
  const rooms = state.data.rooms.filter((room) => room.propertyId === propertyId && room.roomType === roomType && room.active !== false);
  setOptions(els.bookingRoom, rooms.map((room) => ({ value: room.id, label: `${room.name} (${room.capacity} pax)` })), null, selectedRoomId);
}

function populateAdminRoomTypes() {
  const options = roomTypeOptions(els.roomProperty.value);
  setOptions(els.roomType, options, null, els.roomType.value);
}

function populateBlockRooms() {
  const rooms = getActiveRooms({ propertyId: els.blockProperty.value });
  setOptions(els.blockRoom, rooms.map((room) => ({ value: room.id, label: `${room.name} - ${room.roomType}` })), null, els.blockRoom.value);
}

function setOptions(select, options, placeholder, selectedValue, includeBlank = false) {
  if (!select) return;
  const selected = selectedValue ?? select.value;
  const rows = [];
  if (placeholder || includeBlank) rows.push(`<option value="">${escapeHtml(placeholder || "All")}</option>`);
  options.forEach((option) => {
    rows.push(`<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`);
  });
  select.innerHTML = rows.join("");
  if (Array.from(select.options).some((option) => option.value === selected)) select.value = selected;
  else select.value = select.options[0]?.value || "";
}

function openBookingModal(booking = null, defaults = {}) {
  populateBookingSelects(booking, defaults);
  const checkIn = booking?.checkIn || defaults.checkIn || todayIso();
  const checkOut = booking?.checkOut || defaults.checkOut || addDaysIso(checkIn, 1);

  els.modalTitle.textContent = booking ? "Edit booking" : "New booking";
  els.bookingId.value = booking?.id || "";
  els.guestName.value = booking?.guestName || defaults.guestName || "";
  els.guestPhone.value = booking?.phone || "";
  els.guestEmail.value = booking?.email || "";
  els.guestCount.value = booking?.guests ?? defaults.guests ?? 2;
  els.checkInDate.value = checkIn;
  els.checkOutDate.value = checkOut;
  els.totalAmount.value = booking?.totalAmount ?? 0;
  els.amountPaid.value = booking?.amountPaid ?? 0;
  els.specialNotes.value = booking?.notes || defaults.notes || "";
  els.deleteBookingBtn.hidden = !booking || state.user.role !== "admin";
  els.cancelBookingBtn.hidden = !booking || ["Cancelled", "Checked Out", "No Show"].includes(booking.status);
  renderBookingHistory(booking?.id);
  updateBalanceAndConflict();
  els.bookingModal.hidden = false;
  refreshIcons();
  els.guestName.focus();
}

function closeBookingModal() {
  els.bookingModal.hidden = true;
  els.bookingForm.reset();
  els.conflictWarning.hidden = true;
}

function handleBookingFormChange(event) {
  if (event.target === els.bookingProperty) {
    populateBookingRoomTypes();
    populateBookingRooms();
  }
  if (event.target === els.bookingRoomType) {
    populateBookingRooms();
  }
  updateBalanceAndConflict();
}

async function saveBookingFromForm(event) {
  event.preventDefault();
  const booking = collectBookingForm();
  if (booking.checkOut <= booking.checkIn) {
    showToast("Check-out must be after check-in", true);
    return;
  }
  const room = getRoom(booking.roomId);
  if (room && booking.guests > room.capacity && booking.status !== "Blocked") {
    showToast(`Room capacity is ${room.capacity} guests`, true);
    return;
  }
  const conflicts = findConflicts(booking);
  if (conflicts.length) {
    showConflict(conflicts, booking);
    showToast("Conflict found. Choose another room or date.", true);
    return;
  }
  const action = booking.id ? "updateBooking" : "createBooking";
  const ok = await mutate(action, { booking });
  if (ok) closeBookingModal();
}

function collectBookingForm() {
  return {
    id: els.bookingId.value || "",
    guestName: clean(els.guestName.value),
    phone: clean(els.guestPhone.value),
    email: clean(els.guestEmail.value),
    checkIn: els.checkInDate.value,
    checkOut: els.checkOutDate.value,
    guests: Number(els.guestCount.value || 0),
    propertyId: els.bookingProperty.value,
    roomType: els.bookingRoomType.value,
    roomId: els.bookingRoom.value,
    source: els.bookingSource.value,
    status: els.bookingStatus.value,
    totalAmount: Number(els.totalAmount.value || 0),
    amountPaid: Number(els.amountPaid.value || 0),
    balanceDue: Number(els.balanceDue.value || 0),
    notes: clean(els.specialNotes.value)
  };
}

function updateBalanceAndConflict() {
  const total = Number(els.totalAmount.value || 0);
  const paid = Number(els.amountPaid.value || 0);
  els.balanceDue.value = Math.max(0, total - paid);
  const booking = collectBookingForm();
  const conflicts = findConflicts(booking);
  if (conflicts.length) showConflict(conflicts, booking);
  else els.conflictWarning.hidden = true;
}

function showConflict(conflicts, booking) {
  const alternatives = suggestAlternatives(booking.checkIn, booking.checkOut, booking.propertyId, booking.roomType, booking.id).slice(0, 3);
  const conflictText = conflicts.map((item) => `${item.guestName} (${formatStay(item)})`).join(", ");
  const altText = alternatives.length ? ` Suggested: ${alternatives.map((room) => room.name).join(", ")}.` : " No same-type alternatives are free.";
  els.conflictWarning.textContent = `Conflict: ${conflictText}.${altText}`;
  els.conflictWarning.hidden = false;
}

function renderBookingHistory(bookingId) {
  if (!bookingId) {
    els.bookingHistory.hidden = true;
    els.bookingHistory.innerHTML = "";
    return;
  }
  const logs = state.data.logs.filter((log) => log.bookingId === bookingId).sort((a, b) => b.at.localeCompare(a.at));
  els.bookingHistory.hidden = !logs.length;
  els.bookingHistory.innerHTML = logs.map((log) => `<div><strong>${escapeHtml(log.message)}</strong><br><small>${escapeHtml(log.actorName)} - ${formatDateTime(log.at)}</small></div>`).join("");
}

async function cancelCurrentBooking() {
  const id = els.bookingId.value;
  if (!id) return;
  const ok = confirm("Cancel this booking?");
  if (!ok) return;
  if (await mutate("cancelBooking", { id })) closeBookingModal();
}

async function deleteCurrentBooking() {
  const id = els.bookingId.value;
  if (!id) return;
  const ok = confirm("Delete this booking permanently?");
  if (!ok) return;
  if (await mutate("deleteBooking", { id })) closeBookingModal();
}

async function moveBookingToCell(bookingId, roomId, checkIn) {
  const booking = getBooking(bookingId);
  const room = getRoom(roomId);
  if (!booking || !room || !checkIn) return;
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const next = {
    ...booking,
    roomId: room.id,
    propertyId: room.propertyId,
    roomType: room.roomType,
    checkIn,
    checkOut: addDaysIso(checkIn, Math.max(1, nights))
  };
  const conflicts = findConflicts(next);
  if (conflicts.length) {
    showToast(`Conflict with ${conflicts[0].guestName}`, true);
    return;
  }
  await mutate("updateBooking", { booking: next });
}

async function saveProperty(event) {
  event.preventDefault();
  await mutate("upsertProperty", { name: els.propertyName.value });
  els.propertyForm.reset();
}

async function saveRoomType(event) {
  event.preventDefault();
  await mutate("upsertRoomType", { propertyId: els.typeProperty.value, roomType: els.roomTypeName.value });
  els.roomTypeForm.reset();
}

async function saveRoom(event) {
  event.preventDefault();
  await mutate("upsertRoom", {
    propertyId: els.roomProperty.value,
    roomType: els.roomType.value,
    name: els.roomName.value,
    capacity: els.roomCapacity.value
  });
  els.roomName.value = "";
  els.roomCapacity.value = 2;
}

async function saveAgent(event) {
  event.preventDefault();
  await mutate("upsertUser", {
    name: els.agentName.value,
    role: els.agentRole.value,
    pin: els.agentPin.value
  });
  els.agentForm.reset();
}

async function saveBlock(event) {
  event.preventDefault();
  if (els.blockTo.value <= els.blockFrom.value) {
    showToast("Block end date must be after start date", true);
    return;
  }
  await mutate("blockRoom", {
    roomId: els.blockRoom.value,
    checkIn: els.blockFrom.value,
    checkOut: els.blockTo.value,
    notes: els.blockNotes.value
  });
  els.blockNotes.value = "";
}

function exportBookings(type) {
  const bookings = getFilteredBookings();
  const rows = bookings.map((booking) => ({
    Guest: booking.guestName,
    Phone: booking.phone,
    Email: booking.email,
    CheckIn: booking.checkIn,
    CheckOut: booking.checkOut,
    Guests: booking.guests,
    Property: getProperty(booking.propertyId)?.name || "",
    RoomType: booking.roomType,
    Room: roomName(booking.roomId),
    Source: booking.source,
    Status: booking.status,
    TotalAmount: booking.totalAmount,
    AmountPaid: booking.amountPaid,
    BalanceDue: booking.balanceDue,
    Notes: booking.notes
  }));

  if (type === "excel") {
    const html = `<table>${rowsToHtml(rows)}</table>`;
    downloadFile(`c18-bookings-${todayIso()}.xls`, html, "application/vnd.ms-excel");
    return;
  }

  downloadFile(`c18-bookings-${todayIso()}.csv`, rowsToCsv(rows), "text/csv;charset=utf-8");
}

function getDashboardStats() {
  const today = todayIso();
  const monthStart = startOfMonth(today);
  const monthEnd = addDaysIso(endOfMonth(today), 1);
  const rooms = getActiveRooms();
  const bookings = getBookings();
  const unavailableToday = bookings.filter((booking) => BLOCKING_STATUSES.has(booking.status) && rangesOverlap(today, addDaysIso(today, 1), booking.checkIn, booking.checkOut));
  const occupiedToday = bookings.filter((booking) => ["Confirmed", "Checked In"].includes(booking.status) && rangesOverlap(today, addDaysIso(today, 1), booking.checkIn, booking.checkOut));
  const unavailableRoomIds = new Set(unavailableToday.map((booking) => booking.roomId));
  const occupiedRoomIds = new Set(occupiedToday.map((booking) => booking.roomId));
  const arrivals = bookings.filter((booking) => booking.checkIn === today && activeBooking(booking));
  const departures = bookings.filter((booking) => booking.checkOut === today && activeBooking(booking));
  const upcoming = bookings.filter((booking) => booking.checkIn >= today && booking.checkIn <= addDaysIso(today, 14) && activeBooking(booking)).sort(sortByCheckIn);
  const revenueBookings = bookings.filter((booking) => REVENUE_STATUSES.has(booking.status));
  const monthRevenue = revenueBookings
    .filter((booking) => rangesOverlap(monthStart, monthEnd, booking.checkIn, booking.checkOut))
    .reduce((total, booking) => total + Number(booking.totalAmount || 0), 0);

  return {
    totalRooms: rooms.length,
    occupiedRooms: occupiedRoomIds.size,
    availableRooms: Math.max(0, rooms.length - unavailableRoomIds.size),
    occupancyPercent: rooms.length ? Math.round((occupiedRoomIds.size / rooms.length) * 100) : 0,
    arrivals,
    departures,
    upcoming,
    monthRevenue,
    totalRevenue: sum(revenueBookings, "totalAmount"),
    totalPaid: sum(revenueBookings, "amountPaid"),
    totalBalance: sum(revenueBookings, "balanceDue"),
    propertyOccupancy: state.data.properties.map((property) => {
      const propertyRooms = rooms.filter((room) => room.propertyId === property.id);
      const occupied = propertyRooms.filter((room) => occupiedRoomIds.has(room.id)).length;
      return {
        name: property.name,
        total: propertyRooms.length,
        occupied,
        percent: propertyRooms.length ? Math.round((occupied / propertyRooms.length) * 100) : 0
      };
    })
  };
}

function propertyOccupancy(start, end, propertyId = "") {
  const properties = propertyId ? state.data.properties.filter((property) => property.id === propertyId) : state.data.properties;
  return properties.map((property) => {
    const rooms = getActiveRooms({ propertyId: property.id });
    const bookings = getBookings().filter((booking) => booking.propertyId === property.id && OCCUPANCY_STATUSES.has(booking.status));
    const occupiedNights = bookings.reduce((total, booking) => total + overlapNights(start, end, booking.checkIn, booking.checkOut), 0);
    const totalNights = Math.max(1, rooms.length * nightsBetween(start, end));
    return {
      name: property.name,
      occupiedNights,
      totalNights,
      percent: Math.round((occupiedNights / totalNights) * 100)
    };
  });
}

function groupRevenue(key, bookings) {
  const grouped = {};
  bookings.forEach((booking) => {
    let label = booking[key] || "Unknown";
    if (key === "propertyId") label = getProperty(booking.propertyId)?.name || "Unknown";
    grouped[label] = (grouped[label] || 0) + Number(booking.totalAmount || 0);
  });
  return Object.entries(grouped).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function bookingReportItems() {
  const today = todayIso();
  return [
    { label: "Future bookings", count: getBookings().filter((booking) => booking.checkIn >= today && activeBooking(booking)).length },
    { label: "Completed bookings", count: getBookings().filter((booking) => booking.status === "Checked Out").length },
    { label: "Cancelled bookings", count: getBookings().filter((booking) => booking.status === "Cancelled").length }
  ];
}

function getFilteredBookings() {
  const query = clean(els.bookingSearch.value).toLowerCase();
  const propertyId = els.bookingPropertyFilter.value;
  const status = els.bookingStatusFilter.value;
  const source = els.bookingSourceFilter.value;
  return getBookings().filter((booking) => {
    if (propertyId && booking.propertyId !== propertyId) return false;
    if (status && booking.status !== status) return false;
    if (source && booking.source !== source) return false;
    if (query) {
      const haystack = [
        booking.guestName, booking.phone, booking.email, booking.source, booking.status,
        booking.roomType, roomName(booking.roomId), getProperty(booking.propertyId)?.name
      ].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  }).sort((a, b) => b.checkIn.localeCompare(a.checkIn));
}

function getCalendarRange() {
  const anchor = state.calendarAnchor;
  if (state.calendarMode === "week") {
    const start = startOfWeek(anchor);
    const end = addDaysIso(start, 6);
    return {
      dates: datesInclusive(start, end),
      label: `${formatShortDate(start)} to ${formatShortDate(end)}`
    };
  }
  const start = startOfMonth(anchor);
  const end = endOfMonth(anchor);
  return {
    dates: datesInclusive(start, end),
    label: monthYear(anchor)
  };
}

function moveCalendar(direction) {
  if (state.calendarMode === "week") {
    state.calendarAnchor = addDaysIso(state.calendarAnchor, direction * 7);
  } else {
    const date = parseDate(state.calendarAnchor);
    state.calendarAnchor = formatIsoDate(new Date(date.getFullYear(), date.getMonth() + direction, 1));
  }
  renderAvailability();
}

function getReportRange() {
  const today = todayIso();
  if (els.reportRange.value === "daily") return { start: today, end: addDaysIso(today, 1) };
  if (els.reportRange.value === "weekly") {
    const start = startOfWeek(today);
    return { start, end: addDaysIso(start, 7) };
  }
  return { start: startOfMonth(today), end: addDaysIso(endOfMonth(today), 1) };
}

function getNotifications() {
  const today = todayIso();
  const reminders = getBookings().flatMap((booking) => {
    const items = [];
    if (booking.checkIn === today && activeBooking(booking)) {
      items.push({ title: "Check-in reminder", body: `${booking.guestName} at ${roomName(booking.roomId)}`, at: nowIso() });
    }
    if (booking.checkOut === today && activeBooking(booking)) {
      items.push({ title: "Check-out reminder", body: `${booking.guestName} at ${roomName(booking.roomId)}`, at: nowIso() });
    }
    return items;
  });
  return [...reminders, ...state.data.notifications].sort((a, b) => b.at.localeCompare(a.at));
}

function suggestAlternatives(checkIn, checkOut, propertyId, roomType, excludeId) {
  const sameType = getActiveRooms({ propertyId, roomType });
  const sameProperty = getActiveRooms({ propertyId }).filter((room) => room.roomType !== roomType);
  const otherProperties = getActiveRooms({ roomType }).filter((room) => !propertyId || room.propertyId !== propertyId);
  return [...sameType, ...sameProperty, ...otherProperties].filter((room, index, arr) => {
    if (arr.findIndex((item) => item.id === room.id) !== index) return false;
    return !findConflicts({ roomId: room.id, checkIn, checkOut, status: "Confirmed", id: excludeId }).length;
  });
}

function findConflicts(input, data = state.data) {
  if (!input || !data || !BLOCKING_STATUSES.has(input.status)) return [];
  if (!input.roomId || !input.checkIn || !input.checkOut || input.checkOut <= input.checkIn) return [];
  return data.bookings.filter((booking) => {
    if (booking.id && input.id && booking.id === input.id) return false;
    if (booking.roomId !== input.roomId) return false;
    if (!BLOCKING_STATUSES.has(booking.status)) return false;
    return rangesOverlap(input.checkIn, input.checkOut, booking.checkIn, booking.checkOut);
  });
}

function assertNoConflict(booking, data) {
  const conflicts = findConflicts(booking, data);
  if (conflicts.length) throw new Error(`Booking conflicts with ${conflicts[0].guestName}`);
}

function getCalendarBooking(roomId, date) {
  const priority = {
    "Checked In": 1,
    Confirmed: 2,
    "Tentative Hold": 3,
    Blocked: 4,
    "Checked Out": 5,
    Inquiry: 6
  };
  return getBookings()
    .filter((booking) => booking.roomId === roomId && CALENDAR_STATUSES.has(booking.status) && booking.checkIn <= date && booking.checkOut > date)
    .sort((a, b) => (priority[a.status] || 99) - (priority[b.status] || 99))[0];
}

function getBookings() {
  return state.data?.bookings || [];
}

function getBooking(id) {
  return getBookings().find((booking) => booking.id === id);
}

function getProperty(id) {
  return state.data?.properties.find((property) => property.id === id);
}

function getRoom(id) {
  return state.data?.rooms.find((room) => room.id === id);
}

function getUser(id) {
  return state.data?.users.find((user) => user.id === id);
}

function getUserFromData(data, id) {
  return data.users.find((user) => user.id === id);
}

function getActiveRooms(filters = {}) {
  return (state.data?.rooms || [])
    .filter((room) => room.active !== false)
    .filter((room) => !filters.propertyId || room.propertyId === filters.propertyId)
    .filter((room) => !filters.roomType || room.roomType === filters.roomType)
    .sort((a, b) => {
      const pa = getProperty(a.propertyId)?.name || "";
      const pb = getProperty(b.propertyId)?.name || "";
      return pa.localeCompare(pb) || a.roomType.localeCompare(b.roomType) || a.name.localeCompare(b.name);
    });
}

function roomTypeOptions(propertyId = "") {
  const values = new Set();
  state.data.properties
    .filter((property) => !propertyId || property.id === propertyId)
    .forEach((property) => (property.roomTypes || []).forEach((roomType) => values.add(roomType)));
  state.data.rooms
    .filter((room) => !propertyId || room.propertyId === propertyId)
    .forEach((room) => values.add(room.roomType));
  return Array.from(values).sort().map((value) => ({ value, label: value }));
}

function activeBooking(booking) {
  return !["Cancelled", "No Show", "Blocked"].includes(booking.status);
}

function setupInitialFormDates() {
  const today = todayIso();
  const tomorrow = addDaysIso(today, 1);
  els.searchCheckIn.value = els.searchCheckIn.value || today;
  els.searchCheckOut.value = els.searchCheckOut.value || tomorrow;
  els.blockFrom.value = els.blockFrom.value || today;
  els.blockTo.value = els.blockTo.value || tomorrow;
}

function loadLocalData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.version === APP_VERSION) return normalizeData(parsed);
    } catch (error) {
      console.warn(error);
    }
  }
  const seed = seedData();
  saveLocalData(seed);
  return seed;
}

function saveLocalData(data) {
  data.version = APP_VERSION;
  data.updatedAt = nowIso();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function normalizeData(data) {
  const fallback = seedData();
  return {
    ...fallback,
    ...data,
    properties: Array.isArray(data?.properties) ? data.properties : fallback.properties,
    rooms: Array.isArray(data?.rooms) ? data.rooms : fallback.rooms,
    users: Array.isArray(data?.users) ? data.users : fallback.users,
    bookings: Array.isArray(data?.bookings) ? data.bookings : fallback.bookings,
    logs: Array.isArray(data?.logs) ? data.logs : [],
    notifications: Array.isArray(data?.notifications) ? data.notifications : []
  };
}

function seedData() {
  const today = todayIso();
  const yesterday = addDaysIso(today, -1);
  const tomorrow = addDaysIso(today, 1);
  const inTwo = addDaysIso(today, 2);
  const inThree = addDaysIso(today, 3);
  const inFive = addDaysIso(today, 5);
  const inSix = addDaysIso(today, 6);
  const inSeven = addDaysIso(today, 7);
  const inNine = addDaysIso(today, 9);
  return {
    version: APP_VERSION,
    companyName: "C18 Company",
    updatedAt: nowIso(),
    properties: [
      { id: "good-earth", name: "Good Earth Homestay", roomTypes: ["Couple Room", "Bungalow", "Dormitory"], active: true },
      { id: "camp-alpha", name: "Camp Alpha", roomTypes: ["Couple Room", "Dormitory", "Camping"], active: true }
    ],
    rooms: [
      { id: "ge-couple-1", propertyId: "good-earth", roomType: "Couple Room", name: "Couple Room 1", capacity: 2, active: true },
      { id: "ge-couple-2", propertyId: "good-earth", roomType: "Couple Room", name: "Couple Room 2", capacity: 2, active: true },
      { id: "ge-couple-3", propertyId: "good-earth", roomType: "Couple Room", name: "Couple Room 3", capacity: 2, active: true },
      { id: "ge-bungalow-1", propertyId: "good-earth", roomType: "Bungalow", name: "Bungalow Room 1", capacity: 4, active: true },
      { id: "ge-bungalow-2", propertyId: "good-earth", roomType: "Bungalow", name: "Bungalow Room 2", capacity: 4, active: true },
      { id: "ge-bungalow-3", propertyId: "good-earth", roomType: "Bungalow", name: "Bungalow Room 3", capacity: 4, active: true },
      { id: "ge-dorm-1", propertyId: "good-earth", roomType: "Dormitory", name: "Dormitory 1", capacity: 8, active: true },
      { id: "ge-dorm-2", propertyId: "good-earth", roomType: "Dormitory", name: "Dormitory 2", capacity: 8, active: true },
      { id: "ca-couple-1", propertyId: "camp-alpha", roomType: "Couple Room", name: "Couple Room 1", capacity: 2, active: true },
      { id: "ca-dorm-1", propertyId: "camp-alpha", roomType: "Dormitory", name: "Dormitory 1", capacity: 8, active: true },
      { id: "ca-bunk-2", propertyId: "camp-alpha", roomType: "Dormitory", name: "Bunk Beds 2", capacity: 2, active: true },
      { id: "ca-dorm-3", propertyId: "camp-alpha", roomType: "Dormitory", name: "Dormitory 3", capacity: 8, active: true },
      { id: "ca-tents", propertyId: "camp-alpha", roomType: "Camping", name: "Tents", capacity: 12, active: true }
    ],
    users: [
      { id: "admin", name: "C18 Admin", role: "admin", pin: "1234", isActive: true },
      { id: "agent-meera", name: "Meera", role: "agent", pin: "2222", isActive: true },
      { id: "agent-rahul", name: "Rahul", role: "agent", pin: "3333", isActive: true }
    ],
    bookings: [
      {
        id: "bk-1001",
        guestName: "Ananya Sharma",
        phone: "9876543210",
        email: "ananya@example.com",
        checkIn: today,
        checkOut: inTwo,
        guests: 2,
        propertyId: "good-earth",
        roomType: "Couple Room",
        roomId: "ge-couple-1",
        source: "WhatsApp",
        status: "Confirmed",
        totalAmount: 7600,
        amountPaid: 3000,
        balanceDue: 4600,
        notes: "Late evening arrival",
        agentId: "agent-meera",
        agentName: "Meera",
        createdAt: addDaysIso(today, -4),
        updatedAt: addDaysIso(today, -2)
      },
      {
        id: "bk-1002",
        guestName: "Kiran Nair",
        phone: "9898989898",
        email: "kiran@example.com",
        checkIn: yesterday,
        checkOut: today,
        guests: 4,
        propertyId: "good-earth",
        roomType: "Bungalow",
        roomId: "ge-bungalow-2",
        source: "Phone Call",
        status: "Checked In",
        totalAmount: 9800,
        amountPaid: 9800,
        balanceDue: 0,
        notes: "Breakfast included",
        agentId: "agent-rahul",
        agentName: "Rahul",
        createdAt: addDaysIso(today, -8),
        updatedAt: yesterday
      },
      {
        id: "bk-1003",
        guestName: "Arjun Menon",
        phone: "9000090000",
        email: "arjun@example.com",
        checkIn: inThree,
        checkOut: inFive,
        guests: 6,
        propertyId: "camp-alpha",
        roomType: "Camping",
        roomId: "ca-tents",
        source: "Travel Agent",
        status: "Tentative Hold",
        totalAmount: 12000,
        amountPaid: 0,
        balanceDue: 12000,
        notes: "Awaiting advance payment",
        agentId: "agent-meera",
        agentName: "Meera",
        createdAt: addDaysIso(today, -1),
        updatedAt: addDaysIso(today, -1)
      },
      {
        id: "bk-1004",
        guestName: "Maintenance Block",
        phone: "",
        email: "",
        checkIn: inSeven,
        checkOut: inNine,
        guests: 0,
        propertyId: "good-earth",
        roomType: "Dormitory",
        roomId: "ge-dorm-1",
        source: "Direct",
        status: "Blocked",
        totalAmount: 0,
        amountPaid: 0,
        balanceDue: 0,
        notes: "Floor repair",
        agentId: "admin",
        agentName: "C18 Admin",
        createdAt: today,
        updatedAt: today
      },
      {
        id: "bk-1005",
        guestName: "Sophie Clark",
        phone: "8800880088",
        email: "sophie@example.com",
        checkIn: inFive,
        checkOut: inSix,
        guests: 2,
        propertyId: "camp-alpha",
        roomType: "Couple Room",
        roomId: "ca-couple-1",
        source: "Booking.com",
        status: "Confirmed",
        totalAmount: 4200,
        amountPaid: 4200,
        balanceDue: 0,
        notes: "",
        agentId: "agent-rahul",
        agentName: "Rahul",
        createdAt: addDaysIso(today, -5),
        updatedAt: addDaysIso(today, -5)
      }
    ],
    logs: [
      { id: "log-1", bookingId: "bk-1001", actorName: "Meera", message: "Created booking as Confirmed", at: addDaysIso(today, -4) },
      { id: "log-2", bookingId: "bk-1002", actorName: "Rahul", message: "Checked in guest", at: yesterday }
    ],
    notifications: [
      { id: "note-1", title: "New booking", body: "Ananya Sharma at Couple Room 1", at: addDaysIso(today, -4) },
      { id: "note-2", title: "Check-out reminder", body: "Kiran Nair at Bungalow Room 2", at: today }
    ]
  };
}

async function apiGet(action, params = {}) {
  const query = new URLSearchParams({ action, ...params });
  const response = await fetch(`${API_BASE}?${query.toString()}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  if (!json.success) throw new Error(json.error || "API request failed");
  return json;
}

async function apiPost(action, payload = {}) {
  const body = new URLSearchParams({ action, payload: JSON.stringify(payload) });
  const response = await fetch(API_BASE, { method: "POST", body });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  if (!json.success) throw new Error(json.error || "API request failed");
  return json;
}

function sanitizeUser(user) {
  const { pin, ...safeUser } = user;
  return safeUser;
}

function requireAdmin(user) {
  if (user.role !== "admin") throw new Error("Admin access required");
}

function normalizeBookingPayload(input) {
  const booking = {
    ...input,
    guestName: clean(input.guestName || input.name || "Guest"),
    phone: clean(input.phone),
    email: clean(input.email),
    guests: Number(input.guests || 0),
    totalAmount: Number(input.totalAmount || 0),
    amountPaid: Number(input.amountPaid || 0),
    notes: clean(input.notes)
  };
  booking.balanceDue = balanceFor(booking);
  return booking;
}

function balanceFor(booking) {
  return Math.max(0, Number(booking.totalAmount || 0) - Number(booking.amountPaid || 0));
}

function addLog(data, bookingId, actorName, message) {
  data.logs.unshift({ id: uid("log"), bookingId, actorName, message, at: nowIso() });
}

function addNotification(data, title, body) {
  data.notifications.unshift({ id: uid("note"), title, body, at: nowIso() });
}

function roomName(roomId, data = state.data) {
  return data?.rooms.find((room) => room.id === roomId)?.name || "Unassigned";
}

function successMessage(action) {
  const messages = {
    createBooking: "Booking created",
    updateBooking: "Booking updated",
    cancelBooking: "Booking cancelled",
    deleteBooking: "Booking deleted",
    upsertProperty: "Property added",
    upsertRoomType: "Room type added",
    upsertRoom: "Room added",
    toggleRoom: "Room updated",
    upsertUser: "Agent added",
    toggleUser: "Agent updated",
    blockRoom: "Room blocked"
  };
  return messages[action] || "Saved";
}

function barHtml(label, percent, hint) {
  return `<div class="bar-item">
    <div class="bar-label"><span>${escapeHtml(label)}</span><small>${escapeHtml(hint)}</small></div>
    <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, percent))}%"></div></div>
  </div>`;
}

function emptyHtml(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function rowsToCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ].join("\n");
}

function rowsToHtml(rows) {
  if (!rows.length) return "<tr><td>No rows</td></tr>";
  const headers = Object.keys(rows[0]);
  return `<thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}</tr>`).join("")}</tbody>`;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function statusClass(status) {
  if (status === "Confirmed") return "confirmed";
  if (status === "Tentative Hold") return "tentative";
  if (status === "Blocked") return "blocked";
  if (status === "Checked In" || status === "Checked Out") return "checked";
  if (status === "Inquiry") return "inquiry";
  if (status === "No Show") return "no-show";
  return "cancelled";
}

function shortStatus(status) {
  if (status === "Tentative Hold") return "Hold";
  if (status === "Checked In") return "In house";
  if (status === "Checked Out") return "Out";
  return status;
}

function formatStay(booking) {
  return `${formatShortDate(booking.checkIn)} to ${formatShortDate(booking.checkOut)}`;
}

function formatShortDate(iso) {
  return parseDate(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatTime(value) {
  return value.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatWeekday(iso) {
  return parseDate(iso).toLocaleDateString("en-IN", { weekday: "short" });
}

function formatDayNumber(iso) {
  return parseDate(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function monthYear(iso) {
  return parseDate(iso).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function todayIso() {
  return formatIsoDate(new Date());
}

function nowIso() {
  return new Date().toISOString();
}

function parseDate(iso) {
  return new Date(`${iso}T00:00:00`);
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysIso(iso, days) {
  const date = parseDate(iso);
  date.setDate(date.getDate() + days);
  return formatIsoDate(date);
}

function startOfMonth(iso) {
  const date = parseDate(iso);
  return formatIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfMonth(iso) {
  const date = parseDate(iso);
  return formatIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function startOfWeek(iso) {
  const date = parseDate(iso);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return formatIsoDate(date);
}

function datesInclusive(start, end) {
  const dates = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return dates;
}

function nightsBetween(start, end) {
  const ms = parseDate(end) - parseDate(start);
  return Math.max(0, Math.round(ms / 86400000));
}

function overlapNights(rangeStart, rangeEnd, bookingStart, bookingEnd) {
  const start = rangeStart > bookingStart ? rangeStart : bookingStart;
  const end = rangeEnd < bookingEnd ? rangeEnd : bookingEnd;
  return end > start ? nightsBetween(start, end) : 0;
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function sortByCheckIn(a, b) {
  return a.checkIn.localeCompare(b.checkIn) || a.guestName.localeCompare(b.guestName);
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function percentOf(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function clean(value) {
  return String(value ?? "").trim();
}

function same(a, b) {
  return clean(a).toLowerCase() === clean(b).toLowerCase();
}

function titleCase(value) {
  const text = clean(value);
  return text ? text[0].toUpperCase() + text.slice(1).toLowerCase() : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function showToast(message, error = false) {
  els.toast.textContent = message;
  els.toast.className = `toast show${error ? " error" : ""}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.className = "toast";
  }, 3600);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}
