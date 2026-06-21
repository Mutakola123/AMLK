let currentPage = 'dashboard';
let editingId = null;
let currentPropertyId = null;
let eventsSetup = false;

function init() {
  if (localStorage.getItem('_loggedIn') === '1') {
    document.getElementById('loginOverlay').classList.add('hidden');
    startApp();
  }
}

let renderedPages = {};

function startApp() {
  DB.init();
  renderedPages = {};
  setupEvents();
  showPage('dashboard');
}

function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value.trim();
  const saved = JSON.parse(localStorage.getItem('_users') || '[]');
  const valid = saved.length === 0 ? (user === 'muta' && pass === '4862') : saved.some(u => u.user === user && u.pass === pass);
  if (valid) {
    localStorage.setItem('_loggedIn', '1');
    document.getElementById('loginOverlay').classList.add('hidden');
    startApp();
  } else {
    document.getElementById('loginError').style.display = 'block';
  }
}

function logout() {
  if (confirm('تسجيل الخروج؟')) {
    localStorage.removeItem('_loggedIn');
    location.reload();
  }
}

function setupEvents() {
  if (eventsSetup) return;
  eventsSetup = true;
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      if (page === 'back') { showPropertyList(); return; }
      showPage(page);
    });
  });

  document.getElementById('menuToggle').addEventListener('click', toggleSidebar);

  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) closeModal(m.id);
    });
  });

  ['voucherType','voucherAmount','voucherDesc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateVoucherPreview);
  });

  var btnMap = {
    'propertyModal': saveProperty,
    'tenantModal': saveTenant,
    'contractModal': saveContract,
    'paymentModal': savePayment,
    'maintenanceModal': saveMaintenance,
    'unitModal': saveUnit,
    'voucherModal': saveVoucher,
    'finEntryModal': saveFinEntry,
    'userModal': saveUser,
    'companyModal': saveCompany
  };
  Object.keys(btnMap).forEach(modalId => {
    var modal = document.getElementById(modalId);
    if (!modal) return;
    var btns = modal.querySelectorAll('.modal-footer .btn-primary');
    btns.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        btnMap[modalId]();
      });
    });
  });

  var payUnpaid = document.getElementById('payUnpaidBtn');
  if (payUnpaid) payUnpaid.addEventListener('click', function(e) { e.preventDefault(); markUnpaid(); });
}

function showPage(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(`page-${page}`);
  if (el) el.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  if (page === 'property-detail') {
    document.getElementById('pageTitle').textContent = 'تفاصيل العمارة';
    document.getElementById('backNavItem').style.display = 'flex';
  } else {
    const titles = { dashboard: 'لوحة التحكم', properties: 'العقارات', tenants: 'المستأجرين', contracts: 'العقود', payments: 'المدفوعات', maintenance: 'الصيانة', vouchers: 'سندات القبض والصرف', finance: 'المالية', users: 'المستخدمين' };
    document.getElementById('pageTitle').textContent = titles[page] || 'لوحة التحكم';
    document.getElementById('backNavItem').style.display = 'none';
  }

  renderPage(page);
  closeSidebar();
}

function renderPage(page) {
  try {
    switch (page) {
      case 'dashboard': renderDashboard(); break;
      case 'properties': renderProperties(); break;
      case 'tenants': renderTenants(); break;
      case 'contracts': renderContracts(); break;
      case 'payments': renderPayments(); break;
      case 'maintenance': renderMaintenance(); break;
      case 'users': renderUsers(); break;
      case 'vouchers': renderVouchers(); break;
      case 'finance': renderFinance(); break;
      case 'property-detail': if (currentPropertyId) renderPropertyDetail(currentPropertyId); break;
    }
    renderedPages[page] = true;
  } catch (e) { console.warn('renderPage error:', page, e); }
}

function refreshCurrentPage() {
  try { renderPage(currentPage); } catch(e) {}
}

// ---- Dashboard ----
function renderDashboard() {
  const now = new Date();
  const cm = now.getMonth(), cy = now.getFullYear();
  const today = new Date(now.toISOString().split('T')[0]);
  const todayMs = today.getTime();

  const properties = DB.getProperties();
  const tenants = DB.getTenants();
  const contracts = DB.getContracts();
  const units = DB.getUnits();
  const maintenance = DB.getMaintenance();
  const allInst = DB.getInstallments();
  const finEntries = DB.getFinEntries();
  const vouchers = DB.getVouchers();

  const paid = allInst.filter(i => i.status === 'مدفوع');
  const lateItems = allInst.filter(i => i.status === 'متأخر' || (i.status !== 'مدفوع' && new Date(i.dueDate) < today));
  const pendingM = maintenance.filter(m => m.status !== 'مكتملة');
  const mc = maintenance.filter(m => m.status === 'مكتملة').reduce((s, m) => s + (Number(m.cost)||0), 0);
  const monthlyPaid = paid.filter(i => { const d = new Date(i.dueDate); return d.getMonth() === cm && d.getFullYear() === cy; });
  const yearlyPaid = paid.filter(i => new Date(i.dueDate).getFullYear() === cy);

  document.getElementById('statProperties').textContent = properties.length;
  document.getElementById('statTenants').textContent = tenants.length;
  document.getElementById('statContracts').textContent = contracts.filter(c => c.status === 'نشط').length;
  document.getElementById('statPaid').textContent = paid.reduce((s, i) => s + Number(i.amount||0), 0).toLocaleString() + ' ر.س';
  document.getElementById('statDue').textContent = lateItems.reduce((s, i) => s + Number(i.amount||0), 0).toLocaleString() + ' ر.س';
  document.getElementById('statMaintenance').textContent = pendingM.length;
  document.getElementById('statYearly').textContent = yearlyPaid.reduce((s, i) => s + Number(i.amount||0), 0).toLocaleString() + ' ر.س';
  document.getElementById('statMonthly').textContent = monthlyPaid.reduce((s, i) => s + Number(i.amount||0), 0).toLocaleString() + ' ر.س';
  document.getElementById('statDueCount').textContent = lateItems.length + ' دفعة متأخرة';
  document.getElementById('statMaintenanceCost').textContent = mc.toLocaleString() + ' ر.س تكلفة';

  const rented = units.filter(u => u.status === 'مؤجر').length;
  const total = units.length;
  const occ = total > 0 ? Math.round(rented / total * 100) : 0;
  document.getElementById('statOccupancy').textContent = occ + '% إشغال (' + rented + '/' + total + ')';

  // تنبيهات
  const alerts = [];
  const lateInst = lateItems;
  const upcomingInst = allInst.filter(i => i.status === 'قادم' && new Date(i.dueDate) >= today && new Date(i.dueDate) <= new Date(todayMs + 7 * 86400000));
  if (lateInst.length > 0) {
    const totalLate = lateInst.reduce((s, i) => s + Number(i.amount || 0), 0);
    alerts.push(`<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff3f3;border-radius:8px;border-right:4px solid var(--danger)">
      <span style="font-size:24px">⚠️</span>
      <div style="flex:1"><strong>${lateInst.length} قسط متأخر</strong> — إجمالي ${totalLate.toLocaleString()} ر.س</div>
      <button class="btn btn-sm" style="background:var(--danger);color:white" onclick="showPage('payments')">عرض</button>
    </div>`);
  }
  if (upcomingInst.length > 0) {
    const totalUp = upcomingInst.reduce((s, i) => s + Number(i.amount || 0), 0);
    alerts.push(`<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff8e1;border-radius:8px;border-right:4px solid var(--warning)">
      <span style="font-size:24px">⏰</span>
      <div style="flex:1"><strong>${upcomingInst.length} قسط يستحق خلال أسبوع</strong> — ${totalUp.toLocaleString()} ر.س</div>
      <button class="btn btn-sm" style="background:var(--warning);color:white" onclick="showPage('payments')">عرض</button>
    </div>`);
  }
  if (pendingM.length > 0) {
    alerts.push(`<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#e3f2fd;border-radius:8px;border-right:4px solid var(--info)">
      <span style="font-size:24px">🔧</span>
      <div style="flex:1"><strong>${pendingM.length} طلب صيانة</strong> قيد التنفيذ أو مجدول</div>
      <button class="btn btn-sm" style="background:var(--info);color:white" onclick="showPage('maintenance')">عرض</button>
    </div>`);
  }
  document.getElementById('dashAlerts').innerHTML = alerts.join('');

  // رسم بياني شهري
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const paidByMonth = new Array(12).fill(0);
  paid.forEach(x => {
    if (x.paymentDate) { const d = new Date(x.paymentDate); if (d.getFullYear() === cy) paidByMonth[d.getMonth()] += Number(x.amount || 0); }
  });
  const finIncByMonth = new Array(12).fill(0);
  const finExpByMonth = new Array(12).fill(0);
  finEntries.forEach(e => {
    if (!e.date) return;
    const d = new Date(e.date);
    if (d.getFullYear() !== cy) return;
    const m = d.getMonth();
    if (e.type === 'إيراد') finIncByMonth[m] += Number(e.amount || 0);
    else finExpByMonth[m] += Number(e.amount || 0);
  });
  const mData = months.map((m, i) => ({ m: m.substring(0, 3), inc: paidByMonth[i] + finIncByMonth[i], exp: finExpByMonth[i] }));
  let maxV = 1;
  mData.forEach(d => { if (d.inc + d.exp > maxV) maxV = d.inc + d.exp; });
  let chartHtml = '<div style="display:flex;gap:4px;align-items:flex-end;height:140px">';
  mData.forEach(d => {
    const ih = maxV > 0 ? Math.round((d.inc / maxV) * 120) : 0;
    const eh = maxV > 0 ? Math.round((d.exp / maxV) * 120) : 0;
    const isActive = d.inc > 0 || d.exp > 0;
    chartHtml += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;opacity:${isActive ? 1 : 0.3}">
      <div style="display:flex;gap:1px;align-items:flex-end;height:120px">
        <div style="width:10px;background:var(--success);border-radius:3px 3px 0 0;height:${ih}px" title="دخل: ${d.inc.toLocaleString()}"></div>
        <div style="width:10px;background:var(--danger);border-radius:3px 3px 0 0;height:${eh}px" title="مصروف: ${d.exp.toLocaleString()}"></div>
      </div>
      <span style="font-size:9px;color:var(--gray-500)">${d.m}</span>
    </div>`;
  });
  chartHtml += '</div><div style="display:flex;gap:12px;justify-content:center;font-size:11px;margin-top:8px"><span>🟢 دخل</span><span>🔴 مصروف</span></div>';
  document.getElementById('dashChart').innerHTML = chartHtml;

  // الأقساط القادمة
  const nextInst = allInst.filter(i => i.status === 'قادم').sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 5);
  const upBody = document.getElementById('dashUpcoming');
  if (nextInst.length === 0) {
    upBody.innerHTML = '<div class="empty-state" style="padding:20px"><div class="icon">✅</div><p>لا توجد أقساط قادمة</p></div>';
  } else {
    upBody.innerHTML = nextInst.map(i => {
      const c = contracts.find(x => x.id === i.contractId);
      const prop = c ? properties.find(x => x.id === c.propertyId) : null;
      const diff = Math.ceil((new Date(i.dueDate) - todayMs) / 86400000);
      const diffText = diff === 0 ? 'اليوم' : diff === 1 ? 'غداً' : 'بعد ' + diff + ' أيام';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--gray-100)">
        <div>
          <div style="font-weight:500;font-size:14px">${Number(i.amount).toLocaleString()} ر.س</div>
          <div style="font-size:12px;color:var(--gray-500)">${prop ? prop.name : ''} | ${i.dueDate}</div>
        </div>
        <span class="badge badge-warning" style="font-size:11px">${diffText}</span>
      </div>`;
    }).join('');
  }

  // أحدث العقارات
  const propsBody = document.getElementById('dashProperties');
  if (properties.length === 0) {
    propsBody.innerHTML = '<div class="empty-state"><div class="icon">🏠</div><p>لا توجد عقارات بعد</p></div>';
  } else {
    propsBody.innerHTML = properties.slice(0, 5).map(p => {
      const pu = units.filter(u => u.propertyId === p.id);
      const pr = pu.filter(u => u.status === 'مؤجر').length;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--gray-100);cursor:pointer" onclick="showPropertyDetail(${p.id})">
        <div>
          <div style="font-weight:600">${p.name}</div>
          <div style="font-size:12px;color:var(--gray-500)">${p.city} | ${pr}/${pu.length} وحدة</div>
        </div>
        <span class="badge ${p.status === 'مؤجر' ? 'badge-success' : p.status === 'شاغر' ? 'badge-warning' : 'badge-info'}">${p.status}</span>
      </div>`;
    }).join('');
  }

  // آخر المدفوعات
  const payBody = document.getElementById('dashPayments');
  const recentPaid = [...paid].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)).slice(0, 5);
  if (recentPaid.length === 0) {
    payBody.innerHTML = '<div class="empty-state"><div class="icon">💰</div><p>لا توجد مدفوعات</p></div>';
  } else {
    payBody.innerHTML = recentPaid.map(i => {
      const c = contracts.find(x => x.id === i.contractId);
      const prop = c ? properties.find(x => x.id === c.propertyId) : null;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--gray-100)">
        <div>
          <div style="font-weight:500;color:var(--success)">${Number(i.amount).toLocaleString()} ر.س</div>
          <div style="font-size:12px;color:var(--gray-500)">${i.paymentDate} ${prop ? '| ' + prop.name : ''}</div>
        </div>
        <span class="badge badge-success">مدفوع</span>
      </div>`;
    }).join('');
  }

  // طلبات الصيانة
  const maintBody = document.getElementById('dashMaintenance');
  const recentMaint = [...maintenance].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  if (recentMaint.length === 0) {
    maintBody.innerHTML = '<div class="empty-state"><div class="icon">🔧</div><p>لا توجد طلبات صيانة</p></div>';
  } else {
    maintBody.innerHTML = recentMaint.map(m => {
      const prop = properties.find(x => x.id === m.propertyId);
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--gray-100)">
        <div>
          <div style="font-weight:500">${m.title}</div>
          <div style="font-size:12px;color:var(--gray-500)">${prop ? prop.name : ''} | ${m.date} | ${Number(m.cost).toLocaleString()} ر.س</div>
        </div>
        <span class="badge ${m.status === 'مكتملة' ? 'badge-success' : m.status === 'قيد التنفيذ' ? 'badge-warning' : 'badge-info'}">${m.status}</span>
      </div>`;
    }).join('');
  }
}

// ---- Properties ----
function renderProperties() {
  const items = DB.getProperties();
  const container = document.getElementById('propsCardContainer');
  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">🏠</div><p>لا توجد عقارات. أضف عقاراً جديداً</p></div>';
    return;
  }
  container.innerHTML = items.map(p => {
    const stats = DB.getPropertyStats(p.id);
    return `<div class="table-container" style="margin-bottom:16px">
      <div style="padding:20px;border-bottom:1px solid var(--gray-200)">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <span style="font-size:18px;font-weight:700;cursor:pointer;color:var(--primary)" onclick="showPropertyDetail(${p.id})">${p.name}</span>
            <span style="font-size:13px;color:var(--gray-500);margin-right:12px">${p.type} | ${p.city} | ${p.area} م²</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="badge ${p.status === 'مؤجر' ? 'badge-success' : p.status === 'شاغر' ? 'badge-warning' : 'badge-info'}">${p.status}</span>
            <button class="btn btn-sm" style="background:var(--primary-light);color:var(--primary)" onclick="openUnitFormForProperty(${p.id})">+ إضافة وحدة</button>
            <button class="btn btn-sm btn-primary" onclick="showPropertyDetail(${p.id})">تفاصيل</button>
            <button class="btn-icon" onclick="editProperty(${p.id})" title="تعديل">✏️</button>
            <button class="btn-icon" onclick="deleteProperty(${p.id})" title="حذف">🗑️</button>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;padding:16px 20px">
        <div style="text-align:center;padding:12px;background:var(--gray-50);border-radius:8px">
          <div style="font-size:11px;color:var(--gray-500)">💰 الدخل الشهري</div>
          <div style="font-size:18px;font-weight:700;color:var(--success)">${stats.monthlyIncome.toLocaleString()}</div>
          <div style="font-size:11px;color:var(--gray-500)">ر.س</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--gray-50);border-radius:8px">
          <div style="font-size:11px;color:var(--gray-500)">📈 الدخل السنوي</div>
          <div style="font-size:18px;font-weight:700;color:var(--primary)">${stats.yearlyIncome.toLocaleString()}</div>
          <div style="font-size:11px;color:var(--gray-500)">ر.س</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--gray-50);border-radius:8px">
          <div style="font-size:11px;color:var(--gray-500)">⏳ الدفعات القادمة</div>
          <div style="font-size:18px;font-weight:700;color:var(--warning)">${stats.upcomingPayments.toLocaleString()}</div>
          <div style="font-size:11px;color:var(--gray-500)">ر.س</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--gray-50);border-radius:8px">
          <div style="font-size:11px;color:var(--gray-500)">⚠️ المتأخرات</div>
          <div style="font-size:18px;font-weight:700;color:var(--danger)">${stats.lateTotal.toLocaleString()}</div>
          <div style="font-size:11px;color:var(--gray-500)">${stats.lateCount} دفعة</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--gray-50);border-radius:8px">
          <div style="font-size:11px;color:var(--gray-500)">🏠 الوحدات</div>
          <div style="font-size:18px;font-weight:700">${stats.rentedUnits}/${stats.totalUnits}</div>
          <div style="font-size:11px;color:var(--gray-500)">${stats.vacantUnits} شاغر</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--gray-50);border-radius:8px">
          <div style="font-size:11px;color:var(--gray-500)">🔧 الصيانة</div>
          <div style="font-size:18px;font-weight:700">${stats.pendingMaintenance}</div>
          <div style="font-size:11px;color:var(--gray-500)">قيد التنفيذ</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openPropertyForm(data) {
  editingId = data?.id || null;
  document.getElementById('propId').value = data?.id || '';
  document.getElementById('propName').value = data?.name || '';
  document.getElementById('propType').value = data?.type || 'سكني';
  document.getElementById('propAddress').value = data?.address || '';
  document.getElementById('propCity').value = data?.city || '';
  document.getElementById('propArea').value = data?.area || '';
  document.getElementById('propPrice').value = data?.price || '';
  document.getElementById('propStatus').value = data?.status || 'شاغر';
  document.getElementById('propFloors').value = data?.floors || '';
  document.getElementById('modalTitle_prop').textContent = data ? 'تعديل عقار' : 'إضافة عقار جديد';
  openModal('propertyModal');
}

function saveProperty() {
  try {
    const data = {
      id: editingId || null,
      name: document.getElementById('propName').value.trim(),
      type: document.getElementById('propType').value,
      address: document.getElementById('propAddress').value.trim(),
      city: document.getElementById('propCity').value.trim(),
      area: document.getElementById('propArea').value.trim(),
      price: document.getElementById('propPrice').value.trim(),
      status: document.getElementById('propStatus').value,
      floors: document.getElementById('propFloors').value.trim()
    };
    if (!data.name) return alert('الرجاء إدخال اسم العقار');
    DB.saveProperty(data);
    closeModal('propertyModal');
    refreshCurrentPage();
  } catch(e) { alert('خطأ في الحفظ: ' + e.message); }
}

function editProperty(id) {
  const p = DB.getProperty(id);
  if (p) openPropertyForm(p);
}

function deleteProperty(id) {
  if (confirm('هل أنت متأكد من حذف هذا العقار؟')) {
    DB.deleteProperty(id);
    refreshCurrentPage();
  }
}

// ---- Property Detail ----
function showPropertyDetail(id) {
  currentPropertyId = id;
  showPage('property-detail');
}

function openUnitFormForProperty(propertyId) {
  currentPropertyId = propertyId;
  openUnitForm();
}

function showPropertyList() {
  showPage('properties');
}

function renderPropertyDetail(id) {
  const p = DB.getProperty(id);
  if (!p) { showPropertyList(); return; }

  const allUnits = DB.getUnits();
  const allContracts = DB.getContracts();
  const allTenants = DB.getTenants();
  const allMaintenance = DB.getMaintenance();
  const allInstallments = DB.getInstallments();

  const units = allUnits.filter(u => u.propertyId === id);
  const contracts = allContracts.filter(c => c.propertyId === id);
  const maintenance = allMaintenance.filter(m => m.propertyId === id);
  const contractIds = contracts.map(c => c.id);
  const inst = allInstallments.filter(i => contractIds.includes(i.contractId));

  const now = new Date();
  const cy = now.getFullYear(), cm = now.getMonth();
  const today = new Date(now.toISOString().split('T')[0]);
  const paid = inst.filter(i => i.status === 'مدفوع');
  const monthly = paid.filter(i => { const d = new Date(i.dueDate); return d.getMonth() === cm && d.getFullYear() === cy; }).reduce((s, i) => s + (Number(i.amount)||0), 0);
  const yearly = paid.filter(i => new Date(i.dueDate).getFullYear() === cy).reduce((s, i) => s + (Number(i.amount)||0), 0);
  const pending = inst.filter(i => i.status === 'قادم' && new Date(i.dueDate) >= today).reduce((s, i) => s + (Number(i.amount)||0), 0);
  const late = inst.filter(i => i.status === 'متأخر');
  const lateTotal = late.reduce((s, i) => s + (Number(i.amount)||0), 0);
  const active = contracts.filter(c => c.status === 'نشط').length;
  const rented = units.filter(u => u.status === 'مؤجر').length;
  const vacant = units.filter(u => u.status === 'شاغر').length;
  const pendingM = maintenance.filter(m => m.status !== 'مكتملة').length;

  // رأس العمارة
  document.getElementById('detailHeader').innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div>
        <h2 style="font-size:24px;margin-bottom:4px">${p.name}</h2>
        <div style="color:var(--gray-500);font-size:14px">
          ${p.city} | ${p.address ? p.address + ' | ' : ''}${p.type} | ${p.area} م²
          ${p.floors ? ' | ' + p.floors + ' أدوار' : ''}
        </div>
      </div>
      <span class="badge ${p.status === 'مؤجر' ? 'badge-success' : p.status === 'شاغر' ? 'badge-warning' : 'badge-info'}" style="font-size:14px;padding:6px 16px">${p.status}</span>
    </div>
  `;

  document.getElementById('detailStats').innerHTML = `
    <div class="stat-card">
      <div class="label">💰 الدخل الشهري</div>
      <div class="value" style="color:var(--success)">${monthly.toLocaleString()} ر.س</div>
      <div class="sub">الشهر الحالي</div>
    </div>
    <div class="stat-card">
      <div class="label">📈 الدخل السنوي</div>
      <div class="value" style="color:var(--primary)">${yearly.toLocaleString()} ر.س</div>
      <div class="sub">السنة الحالية</div>
    </div>
    <div class="stat-card">
      <div class="label">⏳ الدفعات القادمة</div>
      <div class="value" style="color:var(--warning)">${pending.toLocaleString()} ر.س</div>
      <div class="sub">استحقاق العقود النشطة</div>
    </div>
    <div class="stat-card">
      <div class="label">⚠️ الدفعات المتأخرة</div>
      <div class="value" style="color:var(--danger)">${lateTotal.toLocaleString()} ر.س</div>
      <div class="sub">${late.length} دفعة متأخرة</div>
    </div>
    <div class="stat-card">
      <div class="label">🏠 الوحدات</div>
      <div class="value">${rented}/${units.length}</div>
      <div class="sub">${vacant} وحدة شاغرة</div>
    </div>
    <div class="stat-card">
      <div class="label">📄 العقود النشطة</div>
      <div class="value">${active}</div>
      <div class="sub">${units.length > 0 ? Math.round(rented/units.length*100) : 0}% إشغال</div>
    </div>
  `;

  // الوحدات
  const unitsBody = document.getElementById('detailUnits');
  if (units.length === 0) {
    unitsBody.innerHTML = '<div class="empty-state"><div class="icon">🚪</div><p>لا توجد وحدات مضافة. أضف الوحدات (شقق/محلات) لهذه العمارة</p></div>';
  } else {
    unitsBody.innerHTML = `<table>
      <thead><tr><th>الوحدة</th><th>النوع</th><th>المساحة</th><th>الإيجار</th><th>الحالة</th><th></th></tr></thead>
      <tbody>${units.map(u => {
        const contract = contracts.find(c => c.unitId === u.id && c.status === 'نشط');
        const tenant = contract ? allTenants.find(t => t.id === contract.tenantId) : null;
        return `<tr>
          <td>
            <strong>${u.name}</strong>
            ${tenant ? '<br><span style="font-size:12px;color:var(--gray-500)">' + tenant.name + '</span>' : ''}
            ${contract ? '<br><span style="font-size:11px;color:var(--gray-500)">عقد #' + contract.id + '</span>' : ''}
          </td>
          <td>${u.type}</td>
          <td>${u.area} م²</td>
          <td>${Number(u.rentAmount).toLocaleString()} ر.س</td>
          <td><span class="badge ${u.status === 'مؤجر' ? 'badge-success' : 'badge-warning'}">${u.status}</span></td>
          <td><div class="actions">
            ${u.status === 'شاغر' ? `<button class="btn btn-sm" style="background:var(--primary-light);color:var(--primary)" onclick="openContractForUnit(${u.id}, ${p.id})">📄 إبرام عقد</button>` : ''}
            <button class="btn-icon" onclick="editUnit(${u.id})" title="تعديل">✏️</button>
            <button class="btn-icon" onclick="deleteUnit(${u.id})" title="حذف">🗑️</button>
          </div></td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  }
  document.getElementById('detailUnitsCount').textContent = units.length;

  // العقود
  const contractsBody = document.getElementById('detailContracts');
  if (contracts.length === 0) {
    contractsBody.innerHTML = '<div class="empty-state"><div class="icon">📄</div><p>لا توجد عقود لهذه العمارة</p></div>';
  } else {
    contractsBody.innerHTML = contracts.map(c => {
      const unit = allUnits.find(u => u.id === c.unitId);
      const tenant = allTenants.find(t => t.id === c.tenantId);
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--gray-100)">
        <div>
          <div style="font-weight:500">${unit ? unit.name : 'عقد #' + c.id} - ${tenant ? tenant.name : ''}</div>
          <div style="font-size:12px;color:var(--gray-500)">${c.startDate} → ${c.endDate} | ${Number(c.rentAmount).toLocaleString()} ر.س/${c.paymentFrequency || 'شهري'}</div>
        </div>
        <span class="badge ${c.status === 'نشط' ? 'badge-success' : 'badge-danger'}">${c.status}</span>
      </div>`;
    }).join('');
  }

  // الأقساط
  const payBody = document.getElementById('detailPayments');
  if (inst.length === 0) {
    payBody.innerHTML = '<div class="empty-state"><div class="icon">💰</div><p>لا توجد أقساط لهذه العمارة</p></div>';
  } else {
    payBody.innerHTML = `<table>
      <thead><tr><th>تاريخ الاستحقاق</th><th>الوحدة</th><th>المبلغ</th><th>تاريخ الدفع</th><th>طريقة الدفع</th><th>الحالة</th><th></th></tr></thead>
      <tbody>${[...inst].sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate)).map(i => {
      const c = allContracts.find(x => x.id === i.contractId);
      const u = c ? allUnits.find(x => x.id === c.unitId) : null;
      const isOverdue = i.status === 'قادم' && new Date(i.dueDate) < today;
      const badgeClass = i.status === 'مدفوع' ? 'badge-success' : isOverdue ? 'badge-danger' : 'badge-warning';
      const statusText = i.status === 'مدفوع' ? 'مدفوع' : isOverdue ? 'متأخر' : 'قادم';
      return `<tr>
        <td>${i.dueDate}</td>
        <td>${u ? u.name : '-'}</td>
        <td>${Number(i.amount).toLocaleString()} ر.س</td>
        <td>${i.paymentDate || '-'}</td>
        <td>${i.paymentMethod || '-'}</td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
        <td>${i.status !== 'مدفوع' ? `<button class="btn btn-sm btn-success" onclick="openPaymentForm(${i.id})">تسديد</button>` : ''}</td>
      </tr>`;
    }).join('')}</tbody>
    </table>`;
  }

  // الصيانة
  const maintBody = document.getElementById('detailMaintenance');
  if (maintenance.length === 0) {
    maintBody.innerHTML = '<div class="empty-state"><div class="icon">🔧</div><p>لا توجد طلبات صيانة</p></div>';
  } else {
    maintBody.innerHTML = maintenance.map(m => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--gray-100)">
        <div>
          <div style="font-weight:500">${m.title}</div>
          <div style="font-size:12px;color:var(--gray-500)">${m.date} | ${Number(m.cost).toLocaleString()} ر.س</div>
        </div>
        <span class="badge ${m.status === 'مكتملة' ? 'badge-success' : m.status === 'قيد التنفيذ' ? 'badge-warning' : 'badge-info'}">${m.status}</span>
      </div>
    `).join('');
  }
}

// ---- Units ----
function openUnitForm(data) {
  editingId = data?.id || null;
  document.getElementById('unitId').value = data?.id || '';
  document.getElementById('unitPropertyId').value = currentPropertyId;
  document.getElementById('unitName').value = data?.name || '';
  document.getElementById('unitType').value = data?.type || 'شقة';
  document.getElementById('unitArea').value = data?.area || '';
  document.getElementById('unitRent').value = data?.rentAmount || '';
  document.getElementById('unitStatus').value = data?.status || 'شاغر';
  document.getElementById('modalTitle_unit').textContent = data ? 'تعديل وحدة' : 'إضافة وحدة جديدة';
  openModal('unitModal');
}

function saveUnit() {
  const data = {
    id: editingId || null,
    propertyId: currentPropertyId,
    name: document.getElementById('unitName').value.trim(),
    type: document.getElementById('unitType').value,
    area: document.getElementById('unitArea').value.trim(),
    rentAmount: document.getElementById('unitRent').value.trim(),
    status: document.getElementById('unitStatus').value
  };
  if (!data.name) return alert('الرجاء إدخال اسم الوحدة');
  DB.saveUnit(data);
  closeModal('unitModal');
  refreshCurrentPage();
}

function editUnit(id) {
  const u = DB.getUnit(id);
  if (u) openUnitForm(u);
}

function deleteUnit(id) {
  if (confirm('هل أنت متأكد من حذف هذه الوحدة؟')) {
    DB.deleteUnit(id);
    refreshCurrentPage();
  }
}

function openContractForUnit(unitId, propertyId) {
  currentPropertyId = propertyId;
  openContractForm({ unitId, propertyId });
}

// ---- Tenants ----
function renderTenants() {
  const items = DB.getTenants();
  const tbody = document.getElementById('tenantsTableBody');
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon">👤</div><p>لا يوجد مستأجرين. أضف مستأجراً جديداً</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(t => `<tr>
    <td>${t.name}</td>
    <td>${t.phone}</td>
    <td>${t.email}</td>
    <td>${t.identity}</td>
    <td><div class="actions">
      <button class="btn-icon" onclick="editTenant(${t.id})" title="تعديل">✏️</button>
      <button class="btn-icon" onclick="deleteTenant(${t.id})" title="حذف">🗑️</button>
    </div></td>
  </tr>`).join('');
}

function openTenantForm(data) {
  editingId = data?.id || null;
  document.getElementById('tenantId').value = data?.id || '';
  document.getElementById('tenantName').value = data?.name || '';
  document.getElementById('tenantPhone').value = data?.phone || '';
  document.getElementById('tenantEmail').value = data?.email || '';
  document.getElementById('tenantIdentity').value = data?.identity || '';
  document.getElementById('modalTitle_tenant').textContent = data ? 'تعديل مستأجر' : 'إضافة مستأجر جديد';
  openModal('tenantModal');
}

function saveTenant() {
  try {
    const data = {
      id: editingId || null,
      name: document.getElementById('tenantName').value.trim(),
      phone: document.getElementById('tenantPhone').value.trim(),
      email: document.getElementById('tenantEmail').value.trim(),
      identity: document.getElementById('tenantIdentity').value.trim()
    };
    if (!data.name) return alert('الرجاء إدخال اسم المستأجر');
    DB.saveTenant(data);
    closeModal('tenantModal');
    refreshCurrentPage();
  } catch(e) { alert('خطأ في الحفظ: ' + e.message); }
}

function editTenant(id) {
  const t = DB.getTenant(id);
  if (t) openTenantForm(t);
}

function deleteTenant(id) {
  if (confirm('هل أنت متأكد من حذف هذا المستأجر؟')) {
    DB.deleteTenant(id);
    refreshCurrentPage();
  }
}

// ---- Contracts ----
function renderContracts() {
  const items = DB.getContracts();
  const tbody = document.getElementById('contractsTableBody');
  const properties = DB.getProperties();
  const units = DB.getUnits();
  const tenants = DB.getTenants();
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="icon">📄</div><p>لا توجد عقود. أضف عقداً جديداً</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(c => {
    const prop = properties.find(x => x.id === c.propertyId);
    const unit = units.find(x => x.id === c.unitId);
    const tenant = tenants.find(x => x.id === c.tenantId);
    return `<tr>
      <td>#${c.id}</td>
      <td>${prop ? prop.name : '-'} ${unit ? '| ' + unit.name : ''}</td>
      <td>${tenant ? tenant.name : '-'}</td>
      <td>${c.startDate}</td>
      <td>${c.endDate}</td>
      <td>${Number(c.rentAmount).toLocaleString()} ر.س</td>
      <td>${c.paymentFrequency || 'شهري'}</td>
      <td><span class="badge ${c.status === 'نشط' ? 'badge-success' : c.status === 'منتهي' ? 'badge-danger' : 'badge-warning'}">${c.status}</span></td>
      <td><div class="actions">
        <button class="btn-icon" onclick="editContract(${c.id})" title="تعديل">✏️</button>
        <button class="btn-icon" onclick="deleteContract(${c.id})" title="حذف">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');
}

function openContractForm(data) {
  editingId = data?.id || null;
  document.getElementById('contractId').value = data?.id || '';

  const propEl = document.getElementById('contractProperty');
  const newPropEl = propEl.cloneNode(true);
  propEl.parentNode.replaceChild(newPropEl, propEl);

  populateSelect('contractProperty', DB.getProperties(), data?.propertyId);
  populateUnitsByProperty('contractUnit', data?.propertyId, data?.unitId);
  document.getElementById('contractProperty').addEventListener('change', function() {
    populateUnitsByProperty('contractUnit', Number(this.value));
  });

  populateSelect('contractTenant', DB.getTenants(), data?.tenantId);
  document.getElementById('contractStart').value = data?.startDate || '';
  document.getElementById('contractDuration').value = data?.duration || '12';
  document.getElementById('contractEnd').value = data?.endDate || '';
  document.getElementById('contractPayment').value = data?.paymentFrequency || 'شهري';
  document.getElementById('contractRent').value = data?.rentAmount || '';

  document.getElementById('contractStatus').value = data?.status || 'نشط';

  if (data?.unitId && !data?.id) {
    const unit = DB.getUnit(data.unitId);
    const prop = DB.getProperty(data.propertyId);
    document.getElementById('modalTitle_contract').textContent = `إبرام عقد - ${prop ? prop.name : ''} | ${unit ? unit.name : ''}`;
    if (unit && unit.rentAmount) {
      document.getElementById('contractRent').value = unit.rentAmount;
    }
  } else {
    document.getElementById('modalTitle_contract').textContent = data ? 'تعديل عقد' : 'إضافة عقد جديد';
  }

  if (data?.startDate && data?.duration) {
    calculateEndDate();
  }
  openModal('contractModal');
}

function calculateEndDate() {
  const startStr = document.getElementById('contractStart').value;
  const duration = parseInt(document.getElementById('contractDuration').value) || 0;
  if (!startStr || !duration) {
    document.getElementById('contractEnd').value = '';
    return;
  }
  const start = new Date(startStr);
  start.setMonth(start.getMonth() + duration);
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, '0');
  const day = String(start.getDate()).padStart(2, '0');
  document.getElementById('contractEnd').value = `${year}-${month}-${day}`;
}

function populateUnitsByProperty(selectId, propertyId, selectedId) {
  const sel = document.getElementById(selectId);
  if (!propertyId) { sel.innerHTML = '<option value="">-- اختر العقار أولاً --</option>'; return; }
  const units = DB.getUnitsByProperty(propertyId);
  sel.innerHTML = '<option value="">-- اختر الوحدة --</option>'
    + units.map(u => `<option value="${u.id}" ${u.id === selectedId ? 'selected' : ''}>${u.name} - ${Number(u.rentAmount).toLocaleString()} ر.س (${u.status})</option>`).join('');
}

function saveContract() {
  calculateEndDate();
  const data = {
    id: editingId || null,
    propertyId: Number(document.getElementById('contractProperty').value),
    unitId: Number(document.getElementById('contractUnit').value) || null,
    tenantId: Number(document.getElementById('contractTenant').value),
    startDate: document.getElementById('contractStart').value,
    endDate: document.getElementById('contractEnd').value,
    duration: parseInt(document.getElementById('contractDuration').value) || 12,
    paymentFrequency: document.getElementById('contractPayment').value,
    rentAmount: document.getElementById('contractRent').value.trim(),

    status: document.getElementById('contractStatus').value
  };
  if (!data.propertyId || !data.tenantId) return alert('الرجاء اختيار العقار والمستأجر');
  if (!data.startDate || !data.endDate) return alert('الرجاء إدخال تاريخ البداية والمدة');
  DB.saveContract(data);

  if (data.status === 'نشط') {
    const p = DB.getProperty(data.propertyId);
    if (p && p.status !== 'مؤجر') {
      p.status = 'مؤجر';
      DB.saveProperty(p);
    }
    if (data.unitId) {
      const u = DB.getUnit(data.unitId);
      if (u && u.status !== 'مؤجر') {
        u.status = 'مؤجر';
        DB.saveUnit(u);
      }
    }
  }

  closeModal('contractModal');
  refreshCurrentPage();
}

function editContract(id) {
  const c = DB.getContract(id);
  if (c) openContractForm(c);
}

function deleteContract(id) {
  if (confirm('هل أنت متأكد من حذف هذا العقد؟')) {
    DB.deleteContract(id);
    refreshCurrentPage();
  }
}

// ---- Payments (نظام الأقساط) ----
function renderPayments() {
  const items = DB.getInstallments();
  const today = new Date(new Date().toISOString().split('T')[0]);
  const container = document.getElementById('paymentsContainer');
  const contracts = DB.getContracts();
  const properties = DB.getProperties();
  const units = DB.getUnits();

  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">💰</div><p>لا توجد أقساط. يتم إنشاؤها تلقائياً عند إبرام عقد جديد</p></div>';
    return;
  }

  const totalPaid = items.filter(i => i.status === 'مدفوع').reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalDue = items.filter(i => i.status === 'متأخر' || (i.status === 'قادم' && new Date(i.dueDate) < today)).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalPending = items.filter(i => i.status === 'قادم' && new Date(i.dueDate) >= today).reduce((s, i) => s + (Number(i.amount) || 0), 0);

  container.innerHTML = `
    <div class="stats-grid" style="margin-bottom:16px">
      <div class="stat-card"><div class="label">✅ مدفوع</div><div class="value" style="color:var(--success)">${totalPaid.toLocaleString()} ر.س</div></div>
      <div class="stat-card"><div class="label">⚠️ متأخر</div><div class="value" style="color:var(--danger)">${totalDue.toLocaleString()} ر.س</div></div>
      <div class="stat-card"><div class="label">⏳ قادم</div><div class="value" style="color:var(--warning)">${totalPending.toLocaleString()} ر.س</div></div>
    </div>
    <div class="table-container">
      <div class="table-header"><h3>جدول الأقساط</h3></div>
      <table>
        <thead><tr><th>#</th><th>العقد</th><th>العقار</th><th>الوحدة</th><th>المبلغ</th><th>تاريخ الاستحقاق</th><th>تاريخ الدفع</th><th>طريقة الدفع</th><th>الحالة</th><th></th></tr></thead>
        <tbody>${items.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate)).map(i => {
          const c = contracts.find(x => x.id === i.contractId);
          const prop = c ? properties.find(x => x.id === c.propertyId) : null;
          const unit = c ? units.find(x => x.id === c.unitId) : null;
          const isOverdue = i.status === 'قادم' && new Date(i.dueDate) < today;
          const badgeClass = i.status === 'مدفوع' ? 'badge-success' : isOverdue ? 'badge-danger' : 'badge-warning';
          const statusText = i.status === 'مدفوع' ? 'مدفوع' : isOverdue ? 'متأخر' : 'قادم';
          return `<tr>
            <td>#${i.id}</td>
            <td>عقد #${c ? c.id : '-'}</td>
            <td>${prop ? prop.name : '-'}</td>
            <td>${unit ? unit.name : '-'}</td>
            <td>${Number(i.amount).toLocaleString()} ر.س</td>
            <td>${i.dueDate}</td>
            <td>${i.paymentDate || '-'}</td>
            <td>${i.paymentMethod || '-'}</td>
            <td><span class="badge ${badgeClass}">${statusText}</span></td>
            <td>${i.status !== 'مدفوع' ? `<button class="btn btn-sm btn-success" onclick="openPaymentForm(${i.id})">تسديد</button>` : `<button class="btn btn-sm" style="background:var(--gray-100)" onclick="openPaymentForm(${i.id})">عرض</button>`}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;
}

function openPaymentForm(installmentId) {
  const inst = DB.getInstallments().find(i => i.id === installmentId);
  if (!inst) return;
  editingId = installmentId;
  document.getElementById('payInstId').value = inst.id;
  const c = DB.getContracts().find(x => x.id === inst.contractId);
  const prop = c ? DB.getProperties().find(x => x.id === c.propertyId) : null;
  const unit = c ? DB.getUnits().find(x => x.id === c.unitId) : null;
  document.getElementById('payInfo').textContent = `${prop ? prop.name : ''} | ${unit ? unit.name : ''} | ${inst.dueDate} | ${Number(inst.amount).toLocaleString()} ر.س`;
  if (inst.status === 'مدفوع') {
    document.getElementById('payAmount').value = inst.amount;
    document.getElementById('payDate').value = inst.paymentDate;
    document.getElementById('payMethod').value = inst.paymentMethod;
    document.getElementById('payNotes').value = inst.notes || '';
    document.getElementById('paySaveBtn').style.display = 'none';
    document.getElementById('payUnpaidBtn').style.display = 'inline-flex';
  } else {
    document.getElementById('payAmount').value = inst.amount;
    document.getElementById('payDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('payMethod').value = 'نقدي';
    document.getElementById('payNotes').value = '';
    document.getElementById('paySaveBtn').style.display = 'inline-flex';
    document.getElementById('payUnpaidBtn').style.display = 'none';
  }
  document.getElementById('modalTitle_pay').textContent = inst.status === 'مدفوع' ? 'تفاصيل الدفعة' : 'تسديد القسط';
  openModal('paymentModal');
}

function savePayment() {
  const id = Number(document.getElementById('payInstId').value);
  const inst = DB.getInstallments().find(i => i.id === id);
  if (!inst) return;
  inst.status = 'مدفوع';
  inst.paymentDate = document.getElementById('payDate').value;
  inst.paymentMethod = document.getElementById('payMethod').value;
  inst.notes = document.getElementById('payNotes').value.trim();
  DB.saveInstallment(inst);
  // إنشاء سند قبض آلي عند تسديد القسط
  const contract = DB.getContract(inst.contractId);
  const prop = contract ? DB.getProperty(contract.propertyId) : null;
  const tenant = contract ? DB.getTenant(contract.tenantId) : null;
  DB.saveVoucher({
    type: 'قبض',
    date: inst.paymentDate,
    amount: inst.amount,
    description: `تحصيل إيجار ${prop ? prop.name : ''} - ${tenant ? tenant.name : ''}`,
    person: tenant ? tenant.name : '',
    reference: contract ? `عقد #${contract.id}` : ''
  });
  closeModal('paymentModal');
  refreshCurrentPage();
}

function markUnpaid() {
  const id = Number(document.getElementById('payInstId').value);
  const inst = DB.getInstallments().find(i => i.id === id);
  if (!inst) return;
  const today = new Date(new Date().toISOString().split('T')[0]);
  inst.status = new Date(inst.dueDate) < today ? 'متأخر' : 'قادم';
  inst.paymentDate = '';
  inst.paymentMethod = '';
  inst.notes = '';
  DB.saveInstallment(inst);
  closeModal('paymentModal');
  refreshCurrentPage();
}

// ---- Maintenance ----
function renderMaintenance() {
  const items = DB.getMaintenance();
  const tbody = document.getElementById('maintenanceTableBody');
  const properties = DB.getProperties();
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="icon">🔧</div><p>لا توجد طلبات صيانة. أضف طلباً جديداً</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(m => {
    const p = properties.find(x => x.id === m.propertyId);
    return `<tr>
      <td>${m.title}</td>
      <td>${p ? p.name : '-'}</td>
      <td>${m.description.substring(0, 40)}${m.description.length > 40 ? '...' : ''}</td>
      <td>${Number(m.cost).toLocaleString()} ر.س</td>
      <td>${m.date}</td>
      <td><span class="badge ${m.status === 'مكتملة' ? 'badge-success' : m.status === 'قيد التنفيذ' ? 'badge-warning' : 'badge-info'}">${m.status}</span></td>
      <td><div class="actions">
        <button class="btn-icon" onclick="editMaintenance(${m.id})" title="تعديل">✏️</button>
        <button class="btn-icon" onclick="deleteMaintenance(${m.id})" title="حذف">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');
}

function openMaintenanceForm(data) {
  editingId = data?.id || null;
  document.getElementById('maintId').value = data?.id || '';
  populateSelect('maintProperty', DB.getProperties(), data?.propertyId);
  document.getElementById('maintTitle').value = data?.title || '';
  document.getElementById('maintDesc').value = data?.description || '';
  document.getElementById('maintCost').value = data?.cost || '';
  document.getElementById('maintDate').value = data?.date || new Date().toISOString().split('T')[0];
  document.getElementById('maintStatus').value = data?.status || 'مجدولة';
  document.getElementById('modalTitle_maint').textContent = data ? 'تعديل طلب صيانة' : 'إضافة طلب صيانة جديد';
  openModal('maintenanceModal');
}

function saveMaintenance() {
  const data = {
    id: editingId || null,
    propertyId: Number(document.getElementById('maintProperty').value),
    title: document.getElementById('maintTitle').value.trim(),
    description: document.getElementById('maintDesc').value.trim(),
    cost: document.getElementById('maintCost').value.trim(),
    date: document.getElementById('maintDate').value,
    status: document.getElementById('maintStatus').value
  };
  if (!data.title || !data.propertyId) return alert('الرجاء إدخال عنوان الطلب واختيار العقار');
  DB.saveMaintenance(data);
  closeModal('maintenanceModal');
  refreshCurrentPage();
}

function editMaintenance(id) {
  const m = DB.getMaintenanceItem(id);
  if (m) openMaintenanceForm(m);
}

function deleteMaintenance(id) {
  if (confirm('هل أنت متأكد من حذف طلب الصيانة هذا؟')) {
    DB.deleteMaintenance(id);
    refreshCurrentPage();
  }
}

// ---- Vouchers ----
let voucherFilter = 'all';

function filterVouchers(type) {
  voucherFilter = type;
  document.querySelectorAll('#voucherTabs .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.vtype === type);
  });
  renderVouchers();
}

function renderVoucherStats(items) {
  const receiptTotal = items.filter(v => v.type === 'قبض').reduce((s, v) => s + Number(v.amount || 0), 0);
  const paymentTotal = items.filter(v => v.type === 'صرف').reduce((s, v) => s + Number(v.amount || 0), 0);
  const claimTotal = items.filter(v => v.type === 'مطالبة').reduce((s, v) => s + Number(v.amount || 0), 0);
  document.getElementById('vstatReceipt').textContent = receiptTotal.toLocaleString() + ' ر.س';
  document.getElementById('vstatPayment').textContent = paymentTotal.toLocaleString() + ' ر.س';
  document.getElementById('vstatBalance').textContent = (receiptTotal - paymentTotal).toLocaleString() + ' ر.س';
  const claimEl = document.getElementById('vstatClaim');
  if (claimEl) claimEl.textContent = claimTotal.toLocaleString() + ' ر.س';
}

function renderVouchers() {
  const items = DB.getVouchers();
  renderVoucherStats(items);
  const filtered = voucherFilter === 'all' ? items : items.filter(v => v.type === voucherFilter);
  const tbody = document.getElementById('vouchersTableBody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="icon">📋</div><p>لا توجد سندات</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(v => `<tr>
    <td style="font-weight:600;font-family:monospace;direction:ltr">${v.number || '—'}</td>
    <td><span class="badge ${v.type === 'قبض' ? 'badge-success' : v.type === 'مطالبة' ? 'badge-info' : 'badge-warning'}">${v.type === 'قبض' ? '📥 قبض' : v.type === 'مطالبة' ? '📋 مطالبة' : '📤 صرف'}</span></td>
    <td style="color:var(--gray-700)">${v.date || '—'}</td>
    <td title="${v.description || ''}">${(v.description || '').substring(0, 35)}${(v.description || '').length > 35 ? '…' : ''}</td>
    <td style="font-weight:600">${Number(v.amount || 0).toLocaleString()} ر.س</td>
    <td style="color:var(--gray-500);font-size:13px">${v.person || '—'}</td>
    <td><div class="actions">
      <button class="btn-icon" onclick="editVoucher(${v.id})" title="تعديل">✏️</button>
      <button class="btn-icon" onclick="printVoucher(${v.id})" title="طباعة">🖨️</button>
      <button class="btn-icon" onclick="deleteVoucher(${v.id})" title="حذف">🗑️</button>
    </div></td>
  </tr>`).join('');
}

// ---- Finance ----
let finSubPage = 'overview';

function showFinSubPage(page) {
  finSubPage = page;
  document.querySelectorAll('#page-finance .tabs .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#page-finance .tabs .tab')[page === 'overview' ? 0 : page === 'income' ? 1 : 2].classList.add('active');
  document.getElementById('finOverview').style.display = page === 'overview' ? 'block' : 'none';
  document.getElementById('finIncome').style.display = page === 'income' ? 'block' : 'none';
  document.getElementById('finExpense').style.display = page === 'expense' ? 'block' : 'none';
  if (page === 'income') renderFinIncome();
  else if (page === 'expense') renderFinExpense();
}

const FIN_CATEGORIES = {
  'إيراد': ['خدمات', 'غرامات تأخير', 'تعويضات', 'إيرادات متنوعة'],
  'مصروف': ['صيانة', 'كهرباء', 'مياه', 'رواتب', 'اتصالات', 'نظافة', 'مصروفات متنوعة']
};

function renderFinance() {
  const finEntries = DB.getFinEntries();
  const vouchers = DB.getVouchers();
  const inst = DB.getInstallments();
  const now = new Date();
  const cy = now.getFullYear();

  const nonRentIncome = finEntries.filter(e => e.type === 'إيراد' && e.date && new Date(e.date).getFullYear() === cy).reduce((s, e) => s + Number(e.amount || 0), 0);
  const rentIncome = vouchers.filter(v => v.type === 'قبض' && v.date && new Date(v.date).getFullYear() === cy).reduce((s, v) => s + Number(v.amount || 0), 0);
  const expenses = finEntries.filter(e => e.type === 'مصروف' && e.date && new Date(e.date).getFullYear() === cy).reduce((s, e) => s + Number(e.amount || 0), 0);
  const expected = inst.filter(i => i.status !== 'مدفوع').reduce((s, i) => s + Number(i.amount || 0), 0);

  document.getElementById('financeStats').innerHTML = `
    <div class="stat-card"><div class="label">💵 الإيرادات (${cy})</div><div class="value" style="color:var(--success)">${nonRentIncome.toLocaleString()} ر.س</div><div class="sub">إيجارية: ${rentIncome.toLocaleString()} ر.س</div></div>
    <div class="stat-card"><div class="label">💸 المصروفات (${cy})</div><div class="value" style="color:var(--danger)">${expenses.toLocaleString()} ر.س</div></div>
    <div class="stat-card"><div class="label">📈 صافي الدخل (${cy})</div><div class="value" style="color:${nonRentIncome - expenses >= 0 ? 'var(--success)' : 'var(--danger)'}">${(nonRentIncome - expenses).toLocaleString()} ر.س</div><div class="sub">إجمالي الإيرادات: ${(nonRentIncome + rentIncome).toLocaleString()} ر.س</div></div>
    <div class="stat-card"><div class="label">⏳ الذمم المتوقعة</div><div class="value" style="color:var(--warning)">${expected.toLocaleString()} ر.س</div></div>
  `;

  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const finIncByMonth = new Array(12).fill(0);
  const finExpByMonth = new Array(12).fill(0);
  const vIncByMonth = new Array(12).fill(0);
  const vExpByMonth = new Array(12).fill(0);
  finEntries.forEach(e => {
    if (!e.date) return;
    const d = new Date(e.date); if (d.getFullYear() !== cy) return;
    const m = d.getMonth();
    if (e.type === 'إيراد') finIncByMonth[m] += Number(e.amount || 0);
    else finExpByMonth[m] += Number(e.amount || 0);
  });
  vouchers.forEach(v => {
    if (!v.date) return;
    const d = new Date(v.date); if (d.getFullYear() !== cy) return;
    const m = d.getMonth();
    if (v.type === 'قبض') vIncByMonth[m] += Number(v.amount || 0);
    else vExpByMonth[m] += Number(v.amount || 0);
  });
  let chartHtml = '<div style="display:flex;gap:4px;align-items:flex-end;height:160px;padding:8px 0">';
  let maxV = 1;
  const mData = months.map((m, i) => {
    const inc = finIncByMonth[i] + vIncByMonth[i];
    const exp = finExpByMonth[i] + vExpByMonth[i];
    if (inc + exp > maxV) maxV = inc + exp;
    return { m: m.substring(0, 3), inc, exp };
  });
  mData.forEach(d => {
    const ih = maxV > 0 ? Math.round((d.inc / maxV) * 140) : 0;
    const eh = maxV > 0 ? Math.round((d.exp / maxV) * 140) : 0;
    chartHtml += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="display:flex;gap:2px;align-items:flex-end;height:140px">
        <div style="width:14px;background:var(--success);border-radius:4px 4px 0 0;height:${ih}px;transition:height 0.3s" title="دخل: ${d.inc.toLocaleString()}"></div>
        <div style="width:14px;background:var(--danger);border-radius:4px 4px 0 0;height:${eh}px;transition:height 0.3s" title="مصروف: ${d.exp.toLocaleString()}"></div>
      </div>
      <span style="font-size:10px;color:var(--gray-500)">${d.m}</span>
    </div>`;
  });
  chartHtml += '</div><div style="display:flex;gap:16px;justify-content:center;font-size:12px;margin-top:4px"><span><span style="display:inline-block;width:12px;height:12px;background:var(--success);border-radius:2px;vertical-align:middle"></span> دخل</span><span><span style="display:inline-block;width:12px;height:12px;background:var(--danger);border-radius:2px;vertical-align:middle"></span> مصروف</span></div>';
  document.getElementById('financeMonthlyChart').innerHTML = chartHtml;

  // آخر الحركات (دمج finEntries + vouchers)
  const all = [
    ...finEntries.map(e => ({ ...e, _sort: e.date || '' })),
    ...vouchers.map(v => ({ ...v, type: v.type === 'قبض' ? 'إيراد إيجاري' : 'مصروف إيجاري', _sort: v.date || '' }))
  ].sort((a, b) => b._sort.localeCompare(a._sort)).slice(0, 10);
  if (all.length === 0) {
    document.getElementById('financeRecent').innerHTML = '<div class="empty-state" style="padding:24px"><div class="icon">📋</div><p>لا توجد حركات مالية</p></div>';
    return;
  }
  document.getElementById('financeRecent').innerHTML = all.map(v => {
    const isIncome = v.type === 'إيراد' || v.type === 'إيراد إيجاري';
    const color = isIncome ? 'var(--success)' : 'var(--danger)';
    const badgeClass = v.type === 'إيراد' ? 'badge-success' : v.type === 'مصروف' ? 'badge-warning' : v.type === 'إيراد إيجاري' ? 'badge-info' : 'badge-warning';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--gray-100)">
      <div>
        <div style="font-weight:500;font-size:14px"><span class="badge ${badgeClass}" style="font-size:11px;padding:2px 8px">${v.type}</span> ${(v.description || '').substring(0, 25)}</div>
        <div style="font-size:12px;color:var(--gray-500);margin-top:2px">${v.date || ''}${v.category ? ' | ' + v.category : ''}</div>
      </div>
      <div style="font-weight:600;font-size:16px;color:${color}">${isIncome ? '+' : '-'}${Number(v.amount || 0).toLocaleString()}</div>
    </div>`;
  }).join('');
}

function renderFinIncome() {
  const items = DB.getFinEntries().filter(e => e.type === 'إيراد').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const tbody = document.getElementById('finIncomeTableBody');
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon">💵</div><p>لا توجد إيرادات</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(e => `<tr>
    <td style="color:var(--gray-700)">${e.date || '—'}</td>
    <td><span class="badge badge-info">${e.category || '—'}</span></td>
    <td>${e.description || '—'}</td>
    <td style="font-weight:600;color:var(--success)">${Number(e.amount || 0).toLocaleString()} ر.س</td>
    <td><div class="actions">
      <button class="btn-icon" onclick="editFinEntry(${e.id})" title="تعديل">✏️</button>
      <button class="btn-icon" onclick="deleteFinEntry(${e.id})" title="حذف">🗑️</button>
    </div></td>
  </tr>`).join('');
}

function renderFinExpense() {
  const items = DB.getFinEntries().filter(e => e.type === 'مصروف').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const tbody = document.getElementById('finExpenseTableBody');
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon">💸</div><p>لا توجد مصروفات</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(e => `<tr>
    <td style="color:var(--gray-700)">${e.date || '—'}</td>
    <td><span class="badge badge-warning">${e.category || '—'}</span></td>
    <td>${e.description || '—'}</td>
    <td style="font-weight:600;color:var(--danger)">${Number(e.amount || 0).toLocaleString()} ر.س</td>
    <td><div class="actions">
      <button class="btn-icon" onclick="editFinEntry(${e.id})" title="تعديل">✏️</button>
      <button class="btn-icon" onclick="deleteFinEntry(${e.id})" title="حذف">🗑️</button>
    </div></td>
  </tr>`).join('');
}

function openFinEntryForm(type, data) {
  editingId = data?.id || null;
  document.getElementById('finEntryId').value = data?.id || '';
  document.getElementById('finEntryType').value = type;
  document.getElementById('finEntryDate').value = data?.date || new Date().toISOString().split('T')[0];
  document.getElementById('finEntryAmount').value = data?.amount || '';
  document.getElementById('finEntryDesc').value = data?.description || '';
  document.getElementById('modalTitle_finEntry').textContent = type === 'إيراد' ? (data ? 'تعديل الإيراد' : 'إضافة إيراد جديد') : (data ? 'تعديل المصروف' : 'إضافة مصروف جديد');
  const catSel = document.getElementById('finEntryCategory');
  catSel.innerHTML = FIN_CATEGORIES[type].map(c => `<option value="${c}" ${c === data?.category ? 'selected' : ''}>${c}</option>`).join('');
  openModal('finEntryModal');
}

function saveFinEntry() {
  const type = document.getElementById('finEntryType').value;
  const data = {
    id: editingId || null,
    type,
    date: document.getElementById('finEntryDate').value,
    category: document.getElementById('finEntryCategory').value,
    amount: document.getElementById('finEntryAmount').value,
    description: document.getElementById('finEntryDesc').value.trim()
  };
  if (!data.date || !data.amount || Number(data.amount) <= 0) return alert('الرجاء إدخال التاريخ والمبلغ');
  if (!data.description) return alert('الرجاء إدخال بيان');
  DB.saveFinEntry(data);
  closeModal('finEntryModal');
  renderFinance();
  if (finSubPage === 'income') renderFinIncome();
  else if (finSubPage === 'expense') renderFinExpense();
}

function editFinEntry(id) {
  const e = DB.getFinEntry(id);
  if (e) openFinEntryForm(e.type, e);
}

function deleteFinEntry(id) {
  if (confirm('حذف هذا البند؟')) {
    DB.deleteFinEntry(id);
    renderFinance();
    if (finSubPage === 'income') renderFinIncome();
    else if (finSubPage === 'expense') renderFinExpense();
  }
}

function toggleVoucherRef() {
  const t = document.getElementById('voucherRefType').value;
  document.getElementById('voucherRefContractGroup').style.display = t === 'contract' ? 'block' : 'none';
  document.getElementById('voucherRefManualGroup').style.display = t === 'manual' ? 'block' : 'none';
}

function updateVoucherPreview() {
  const type = document.getElementById('voucherType').value;
  const amount = document.getElementById('voucherAmount').value;
  const desc = document.getElementById('voucherDesc').value.trim();
  const preview = document.getElementById('voucherPreview');
  const items = DB.getVouchers();
  const nextNum = items.length ? Math.max(...items.map(i => i.id)) + 1 : 1;
  if (amount) {
    preview.style.display = 'block';
    document.getElementById('previewType').textContent = type === 'قبض' ? '📥 سند قبض' : '📤 سند صرف';
    document.getElementById('previewType').style.color = type === 'قبض' ? 'var(--success)' : 'var(--danger)';
    document.getElementById('previewNumber').textContent = `SND-${String(nextNum).padStart(4, '0')}`;
    document.getElementById('previewAmount').textContent = Number(amount).toLocaleString() + ' ر.س';
    document.getElementById('previewAmount').style.color = type === 'قبض' ? 'var(--success)' : 'var(--danger)';
    document.getElementById('previewDesc').textContent = desc || '—';
  } else {
    preview.style.display = 'none';
  }
}

function openVoucherForm(data) {
  editingId = data?.id || null;
  document.getElementById('voucherId').value = data?.id || '';
  document.getElementById('voucherType').value = data?.type || 'قبض';
  document.getElementById('voucherDate').value = data?.date || new Date().toISOString().split('T')[0];
  document.getElementById('voucherAmount').value = data?.amount || '';
  document.getElementById('voucherDesc').value = data?.description || '';
  document.getElementById('voucherPerson').value = data?.person || '';
  document.getElementById('voucherRefType').value = '';
  document.getElementById('voucherRefManual').value = data?.reference || '';
  toggleVoucherRef();
  // Populate contracts dropdown
  if (data?.reference && !DB.getContracts().some(c => `عقد #${c.id}` === data.reference)) {
    document.getElementById('voucherRefType').value = 'manual';
    toggleVoucherRef();
  }
  populateSelect('voucherRefContract', DB.getContracts(), null, 'displayName');
  document.getElementById('modalTitle_voucher').textContent = data ? 'تعديل السند' : 'إضافة سند جديد';
  updateVoucherPreview();
  openModal('voucherModal');
}

function saveVoucher() {
  try {
  const type = document.getElementById('voucherType').value;
  const date = document.getElementById('voucherDate').value;
  const amount = document.getElementById('voucherAmount').value;
  const desc = document.getElementById('voucherDesc').value.trim();
  let ref = '';
  const refType = document.getElementById('voucherRefType').value;
  if (refType === 'contract') {
    const cid = document.getElementById('voucherRefContract').value;
    if (cid) ref = `عقد #${cid}`;
  } else if (refType === 'manual') {
    ref = document.getElementById('voucherRefManual').value.trim();
  }
  if (!date) return alert('الرجاء إدخال التاريخ');
  if (!amount || Number(amount) <= 0) return alert('الرجاء إدخال مبلغ صحيح');
  if (!desc) return alert('الرجاء إدخال بيان السند');
  const data = { id: editingId || null, type, date, amount, description: desc, person: document.getElementById('voucherPerson').value.trim(), reference: ref };
  const saved = DB.saveVoucher(data);
  closeModal('voucherModal');
  refreshCurrentPage();
  } catch(e) { alert('خطأ في حفظ السند: ' + e.message); }
}

function editVoucher(id) {
  const v = DB.getVoucher(id);
  if (v) openVoucherForm(v);
}

function deleteVoucher(id) {
  if (confirm('هل أنت متأكد من حذف هذا السند؟')) {
    DB.deleteVoucher(id);
    renderVouchers();
    if (currentPage === 'property-detail') renderPropertyDetail(currentPropertyId);
  }
}

function printVoucher(id) {
  const v = DB.getVoucher(id);
  if (!v) return;
  const company = DB.getCompany();
  const amountWordsAr = numberToArabicWords(Number(v.amount || 0));
  const amountWordsEn = numberToEnglishWords(Number(v.amount || 0));
  const isReceipt = v.type === 'قبض';
  const isClaim = v.type === 'مطالبة';
  const mainColor = isReceipt ? '#0f7b46' : isClaim ? '#1565c0' : '#c62828';
  const lightBg = isReceipt ? '#f0faf4' : isClaim ? '#e3f2fd' : '#fdf2f2';
  const typeAr = isReceipt ? 'قبض' : isClaim ? 'مطالبة' : 'صرف';
  const typeEn = isReceipt ? 'RECEIPT' : isClaim ? 'CLAIM' : 'PAYMENT VOUCHER';
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>${v.number} - ${typeEn}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Segoe UI',Tahoma,sans-serif; background:#e8e8e8; padding:20px; }
      .voucher { max-width:750px; margin:0 auto; background:white; border-radius:4px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.15); }
      .v-top-bar { background:${mainColor}; color:white; padding:6px 24px; display:flex; justify-content:space-between; font-size:11px; }
      .v-top-bar .en { direction:ltr; }
      .v-header { display:flex; justify-content:space-between; align-items:center; padding:20px 24px; border-bottom:2px solid ${mainColor}; }
      .v-company { display:flex; align-items:center; gap:16px; flex:1; }
      .v-company-logo { font-size:44px; min-width:100px; min-height:100px; display:flex; align-items:center; justify-content:center; }
      .v-company-info h2 { font-size:18px; color:#1a1a1a; }
      .v-company-info .en-name { font-size:12px; color:#888; direction:ltr; text-align:left; }
      .v-company-info p { font-size:11px; color:#666; line-height:1.6; direction:ltr; text-align:left; }
      .v-type-box { background:${mainColor}; color:white; padding:12px 20px; border-radius:8px; text-align:center; min-width:120px; }
      .v-type-box .type-icon { font-size:26px; }
      .v-type-box .type-ar { font-size:15px; font-weight:700; margin-top:2px; }
      .v-type-box .type-en { font-size:10px; opacity:0.85; letter-spacing:1px; }
      .v-type-box .type-num { font-size:11px; margin-top:4px; font-family:monospace; opacity:0.9; }
      .v-body { padding:24px; }
      .v-amount-section { background:${lightBg}; border:2px solid ${mainColor}; border-radius:10px; padding:16px 20px; margin-bottom:16px; }
      .v-amount-main { display:flex; justify-content:space-between; align-items:center; }
      .v-amount-main .label { font-size:13px; color:#666; }
      .v-amount-main .label-en { font-size:11px; color:#999; direction:ltr; }
      .v-amount-main .amount { font-size:32px; font-weight:700; color:${mainColor}; direction:ltr; }
      .v-amount-words { text-align:center; padding:10px; background:white; border:1px dashed #ccc; border-radius:6px; margin-top:10px; font-size:13px; }
      .v-amount-words .ar { color:#333; font-weight:600; }
      .v-amount-words .en { color:#888; font-size:11px; direction:ltr; display:block; margin-top:2px; }
      .v-details { border:1px solid #e0e0e0; border-radius:8px; overflow:hidden; margin-bottom:20px; }
      .v-row { display:flex; border-bottom:1px solid #e0e0e0; }
      .v-row:last-child { border-bottom:none; }
      .v-cell { flex:1; padding:10px 14px; font-size:13px; }
      .v-cell.lbl { background:#f8f8f8; color:#888; font-weight:600; font-size:12px; }
      .v-cell.lbl .en { font-size:10px; color:#aaa; display:block; direction:ltr; text-align:left; }
      .v-cell.val { color:#1a1a1a; }
      .v-cell.wide { flex:3; }
      .v-signatures { display:grid; grid-template-columns:1fr 1fr; gap:60px; margin-top:28px; padding-top:16px; }
      .v-sig-box { text-align:center; }
      .v-sig-line { border-top:1px solid #333; margin:0 16px 6px; }
      .v-sig-label { font-size:11px; color:#666; }
      .v-sig-label .en { font-size:10px; color:#aaa; display:block; direction:ltr; }
      .v-footer { background:#f5f5f5; padding:8px 24px; display:flex; justify-content:space-between; font-size:10px; color:#999; border-top:1px solid #e0e0e0; direction:ltr; }
      @media print { body { background:white; padding:0; } .voucher { box-shadow:none; max-width:100%; } }
    </style>
  </head><body>
    <div class="voucher">
      <div class="v-top-bar">
        <span>${company.name || ''}</span>
        <span class="en">${typeEn} VOUCHER</span>
      </div>
      <div class="v-header">
        <div class="v-company">
          <div class="v-company-logo">${company.logo ? '<img src="' + company.logo + '" style="width:100px;height:100px;border-radius:10px;object-fit:contain">' : '🏢'}</div>
          <div class="v-company-info">
            <h2>${company.name || 'المؤسسة العقارية'}</h2>
            <div class="en-name">${company.name || 'Real Estate Company'}</div>
            <p>
              ${company.address ? company.address : ''}
              ${company.phone ? ' | Tel: ' + company.phone : ''}
              ${company.email ? ' | ' + company.email : ''}
              ${company.cr ? '<br>CR: ' + company.cr : ''}
              ${company.vat ? ' | VAT: ' + company.vat : ''}
            </p>
          </div>
        </div>
        <div class="v-type-box">
          <div class="type-icon">${isReceipt ? '📥' : isClaim ? '📋' : '📤'}</div>
          <div class="type-ar">سند ${typeAr}</div>
          <div class="type-en">${typeEn}</div>
          <div class="type-num">${v.number || ''}</div>
        </div>
      </div>
      <div class="v-body">
        <div class="v-amount-section">
          <div class="v-amount-main">
            <div>
              <div class="label">${isReceipt ? 'المبلغ المقبوض' : isClaim ? 'المبلغ المطالب به' : 'المبلغ المدفوع'}</div>
              <div class="label-en">${isReceipt ? 'Amount Received' : isClaim ? 'Amount Claimed' : 'Amount Paid'}</div>
            </div>
            <div class="amount">${Number(v.amount || 0).toLocaleString('en-US')} SAR</div>
          </div>
          <div class="v-amount-words">
            <div class="ar">${amountWordsAr} ريالاً سعودياً فقط لا غير</div>
            <div class="en">Say: ${amountWordsEn} Saudi Riyals Only</div>
          </div>
        </div>
        <div class="v-details">
          <div class="v-row">
            <div class="v-cell lbl">التاريخ<span class="en">Date</span></div>
            <div class="v-cell val">${v.date || '—'}</div>
            <div class="v-cell lbl">رقم السند<span class="en">Voucher No.</span></div>
            <div class="v-cell val" style="font-weight:700;font-family:monospace">${v.number || '—'}</div>
          </div>
          <div class="v-row">
            <div class="v-cell lbl">البيان<span class="en">Description</span></div>
            <div class="v-cell val wide">${v.description || '—'}</div>
          </div>
          <div class="v-row">
            <div class="v-cell lbl">اسم الشخص<span class="en">Person</span></div>
            <div class="v-cell val">${v.person || '—'}</div>
            ${v.reference ? `<div class="v-cell lbl">المرجع<span class="en">Reference</span></div><div class="v-cell val">${v.reference}</div>` : ''}
        </div>
        <div class="v-signatures">
          <div class="v-sig-box">
            <div class="v-sig-line"></div>
            <div class="v-sig-label">${isReceipt ? 'المدير / المستلم' : isClaim ? 'مقدم المطالبة' : 'المحاسب'}<span class="en">${isReceipt ? 'Manager / Received by' : isClaim ? 'Claimed by' : 'Accountant'}</span></div>
          </div>
          <div class="v-sig-box">
            <div class="v-sig-line"></div>
            <div class="v-sig-label">${isReceipt ? 'المحاسب' : isClaim ? 'الجهة المعالجة' : 'المدير المفوض'}<span class="en">${isReceipt ? 'Accountant' : isClaim ? 'Processed by' : 'Authorized Manager'}</span></div>
          </div>
        </div>
      </div>
      <div class="v-footer">
        <span>Issued: ${new Date().toLocaleDateString('en-US')} - ${new Date().toLocaleTimeString('en-US')}</span>
        <span>${company.name || ''}</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
    <script>window.onload=function(){window.print()}<\/script>
  </body></html>`);
  w.document.close();
}

// ---- Users ----
function renderUsers() {
  const users = JSON.parse(localStorage.getItem('_users') || '[]');
  const tbody = document.getElementById('usersTableBody');
  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><div class="icon">👥</div><p>لا يوجد مستخدمون. أضف مستخدماً جديداً</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = users.map(u => `<tr>
    <td style="font-weight:600">${u.user}</td>
    <td style="color:var(--gray-500)">${u.created || '-'}</td>
    <td><div class="actions">
      <button class="btn-icon" onclick="editUser('${u.user}')" title="تعديل">✏️</button>
      <button class="btn-icon" onclick="deleteUser('${u.user}')" title="حذف">🗑️</button>
    </div></td>
  </tr>`).join('');
}

function openUserForm(data) {
  editingId = data?.user || null;
  document.getElementById('userId').value = data?.user || '';
  document.getElementById('userName').value = data?.user || '';
  document.getElementById('userPass').value = '';
  document.getElementById('modalTitle_user').textContent = data ? 'تعديل المستخدم' : 'إضافة مستخدم جديد';
  openModal('userModal');
}

function saveUser() {
  const user = document.getElementById('userName').value.trim();
  const pass = document.getElementById('userPass').value.trim();
  if (!user || !pass) return alert('الرجاء إدخال اسم المستخدم وكلمة المرور');
  let users = JSON.parse(localStorage.getItem('_users') || '[]');
  if (editingId) {
    const idx = users.findIndex(u => u.user === editingId);
    if (idx > -1) {
      if (user !== editingId && users.some(u => u.user === user)) return alert('اسم المستخدم موجود مسبقاً');
      users[idx].user = user;
      if (pass) users[idx].pass = pass;
    }
  } else {
    if (users.some(u => u.user === user)) return alert('اسم المستخدم موجود مسبقاً');
    users.push({ user, pass, created: new Date().toLocaleDateString('ar-SA') });
  }
  localStorage.setItem('_users', JSON.stringify(users));
  closeModal('userModal');
  renderUsers();
}

function editUser(user) {
  const users = JSON.parse(localStorage.getItem('_users') || '[]');
  const u = users.find(x => x.user === user);
  if (u) openUserForm(u);
}

function deleteUser(user) {
  if (!confirm(`حذف المستخدم "${user}"؟`)) return;
  let users = JSON.parse(localStorage.getItem('_users') || '[]');
  users = users.filter(u => u.user !== user);
  localStorage.setItem('_users', JSON.stringify(users));
  renderUsers();
}

// ---- تصدير واستيراد البيانات ----
function exportData() {
  try {
    const json = DB.exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    a.download = `amlk-backup-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('✅ تم تصدير البيانات بنجاح');
  } catch (e) { alert('❌ خطأ في التصدير: ' + e.message); }
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.name.endsWith('.json')) return alert('❌ الملف يجب أن يكون بصيغة JSON');
  if (!confirm('⚠️ استيراد البيانات سيحل محل جميع البيانات الحالية. هل أنت متأكد؟')) {
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const count = DB.importAll(e.target.result);
      alert(`✅ تم استيراد ${count} حقل بيانات بنجاح.\nسيتم تحديث الصفحة الآن.`);
      event.target.value = '';
      window.location.reload();
    } catch (err) {
      alert('❌ خطأ في الاستيراد: ' + err.message + '\nتأكد من أن الملف صحيح.');
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

// ---- تحويل الأرقام إلى كلمات عربية ----
function numberToArabicWords(num) {
  if (num === 0 || isNaN(num)) return 'صفر';
  const ones = ['','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة','عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'];
  const tens = ['','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'];
  const hundreds = ['','مائة','مئتان','ثلاثمئة','أربعمئة','خمسمئة','ستمئة','سبعمئة','ثمانمئة','تسعمئة'];
  const thousands = ['','ألف','ألفان','ثلاثة آلاف','أربعة آلاف','خمسة آلاف','ستة آلاف','سبعة آلاف','ثمانية آلاف','تسعة آلاف'];

  const split3 = n => {
    const h = Math.floor(n / 100);
    const r = n % 100;
    const t = Math.floor(r / 10);
    const o = r % 10;
    let parts = [];
    if (h > 0) parts.push(hundreds[h]);
    if (r > 0 && r < 20) {
      parts.push(ones[r]);
    } else {
      if (o > 0) parts.push(ones[o]);
      if (t > 0) parts.push(tens[t]);
    }
    return parts.join(' و ');
  };

  if (num < 1000) return split3(num);

  const millions = Math.floor(num / 1000000);
  const thousands_ = Math.floor((num % 1000000) / 1000);
  const remainder = num % 1000;

  let parts = [];
  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else parts.push(split3(millions) + ' ملايين');
  }
  if (thousands_ > 0) {
    if (thousands_ === 1) parts.push('ألف');
    else if (thousands_ === 2) parts.push('ألفان');
    else parts.push(split3(thousands_) + ' آلاف');
  }
  if (remainder > 0) parts.push(split3(remainder));

  return parts.join(' و ');
}

function numberToEnglishWords(num) {
  if (num === 0 || isNaN(num)) return 'Zero';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

  const split3 = n => {
    const h = Math.floor(n / 100);
    const r = n % 100;
    const t = Math.floor(r / 10);
    const o = r % 10;
    let parts = [];
    if (h > 0) parts.push(ones[h] + ' Hundred');
    if (r > 0 && r < 20) {
      parts.push(ones[r]);
    } else {
      if (t > 0) parts.push(tens[t]);
      if (o > 0) parts.push(ones[o]);
    }
    return parts.join(' ');
  };

  if (num < 1000) return split3(num);

  const millions = Math.floor(num / 1000000);
  const thousands_ = Math.floor((num % 1000000) / 1000);
  const remainder = num % 1000;

  let parts = [];
  if (millions > 0) {
    if (millions === 1) parts.push('One Million');
    else parts.push(split3(millions) + ' Million');
  }
  if (thousands_ > 0) {
    if (thousands_ === 1) parts.push('One Thousand');
    else parts.push(split3(thousands_) + ' Thousand');
  }
  if (remainder > 0) parts.push(split3(remainder));

  return parts.join(' ');
}

// ---- بيانات الشركة ----
function openCompanyForm() {
  const c = DB.getCompany();
  document.getElementById('companyName').value = c.name || '';
  document.getElementById('companyAddress').value = c.address || '';
  document.getElementById('companyPhone').value = c.phone || '';
  document.getElementById('companyEmail').value = c.email || '';
  document.getElementById('companyCR').value = c.cr || '';
  document.getElementById('companyVAT').value = c.vat || '';
  const preview = document.getElementById('companyLogoPreview');
  if (c.logo && c.logo.indexOf('data:image') === 0) {
    preview.src = c.logo;
    preview.style.display = 'block';
  } else {
    preview.removeAttribute('src');
    preview.style.display = 'none';
  }
  openModal('companyModal');
}

function previewLogo(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 500000) return alert('حجم الصورة يجب أن يكون أقل من 500 KB');
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('companyLogoPreview');
    preview.src = e.target.result;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  const preview = document.getElementById('companyLogoPreview');
  preview.removeAttribute('src');
  preview.style.display = 'none';
  document.getElementById('companyLogoFile').value = '';
}

function saveCompany() {
  const preview = document.getElementById('companyLogoPreview');
  const hasLogo = preview.style.display !== 'none' && preview.src && preview.src.indexOf('data:image') === 0;
  const data = {
    name: document.getElementById('companyName').value.trim(),
    address: document.getElementById('companyAddress').value.trim(),
    phone: document.getElementById('companyPhone').value.trim(),
    email: document.getElementById('companyEmail').value.trim(),
    cr: document.getElementById('companyCR').value.trim(),
    vat: document.getElementById('companyVAT').value.trim(),
    logo: hasLogo ? preview.src : ''
  };
  DB.saveCompany(data);
  closeModal('companyModal');
  alert('✅ تم حفظ بيانات الشركة');
}

// ---- Helpers ----
function populateSelect(id, items, selectedId, labelKey = 'name') {
  const sel = document.getElementById(id);
  sel.innerHTML = '<option value="">-- اختر --</option>'
    + items.map(i => `<option value="${i.id}" ${i.id === selectedId ? 'selected' : ''}>${i[labelKey]}</option>`).join('');
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  editingId = null;
}

function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
}

function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', init);
