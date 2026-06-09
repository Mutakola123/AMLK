console.log('✅ app.js loaded');
let currentPage = 'dashboard';
let editingId = null;
let currentPropertyId = null;

function init() {
  if (localStorage.getItem('_loggedIn') === '1') {
    document.getElementById('loginOverlay').classList.add('hidden');
    startApp();
  }
}

function startApp() {
  try {
    DB.init();
    renderAll();
    setupEvents();
    showPage('dashboard');
  } catch (e) {
    console.error('❌ startApp error:', e);
    alert('حدث خطأ: ' + e.message + '\nافتح Console (F12) للتفاصيل');
  }
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
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      if (page === 'back') { showPropertyList(); return; }
      showPage(page);
      closeSidebar();
    });
  });

  document.getElementById('menuToggle').addEventListener('click', toggleSidebar);

  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) closeModal(m.id);
    });
  });
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
  } catch (e) { console.warn('⚠️ renderPage', page, e); }
}

function safeRender(fn) { try { fn(); } catch (e) { console.warn('⚠️', fn.name, e); } }

function renderAll() {
  safeRender(renderDashboard);
  safeRender(renderProperties);
  safeRender(renderTenants);
  safeRender(renderContracts);
  safeRender(renderPayments);
  safeRender(renderMaintenance);
  safeRender(renderVouchers);
  safeRender(renderFinance);
  safeRender(renderUsers);
}

// ---- Dashboard ----
function renderDashboard() {
  const s = DB.getStats();
  const properties = DB.getProperties();
  const maintenance = DB.getMaintenance();

  document.getElementById('statProperties').textContent = s.totalProperties;
  document.getElementById('statTenants').textContent = s.totalTenants;
  document.getElementById('statContracts').textContent = s.activeContracts;
  document.getElementById('statPaid').textContent = s.totalPaid.toLocaleString() + ' ر.س';
  document.getElementById('statDue').textContent = s.totalDue.toLocaleString() + ' ر.س';
  document.getElementById('statMaintenance').textContent = s.pendingMaintenance;
  document.getElementById('statUnits').textContent = s.totalUnits;
  document.getElementById('statYearly').textContent = s.yearlyIncome.toLocaleString() + ' ر.س';

  const propsBody = document.getElementById('dashProperties');
  if (properties.length === 0) {
    propsBody.innerHTML = '<div class="empty-state"><div class="icon">🏠</div><p>لا توجد عقارات بعد</p></div>';
  } else {
    propsBody.innerHTML = properties.slice(0, 5).map(p => {
      const stats = DB.getPropertyStats(p.id);
      return `<div class="stat-card" style="margin-bottom:8px;cursor:pointer" onclick="showPropertyDetail(${p.id})">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:600">${p.name}</span>
          <span class="badge ${p.status === 'مؤجر' ? 'badge-success' : p.status === 'شاغر' ? 'badge-warning' : 'badge-info'}">${p.status}</span>
        </div>
        <div style="font-size:13px;color:var(--gray-500);margin-top:4px">${p.city} | ${stats.rentedUnits}/${stats.totalUnits} وحدة مؤجرة | دخل سنوي: ${stats.yearlyIncome.toLocaleString()} ر.س</div>
      </div>`;
    }).join('');
  }

  const payBody = document.getElementById('dashPayments');
  const allInst = DB.getInstallments();
  const recentInst = [...allInst].filter(i => i.status === 'مدفوع').sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)).slice(0, 5);
  if (recentInst.length === 0) {
    payBody.innerHTML = '<div class="empty-state"><div class="icon">💰</div><p>لا توجد مدفوعات</p></div>';
  } else {
    payBody.innerHTML = recentInst.map(i => {
      const c = DB.getContract(i.contractId);
      const prop = c ? DB.getProperty(c.propertyId) : null;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--gray-100)">
        <div>
          <div style="font-weight:500">${Number(i.amount).toLocaleString()} ر.س</div>
          <div style="font-size:12px;color:var(--gray-500)">${i.paymentDate} ${prop ? '| ' + prop.name : ''}</div>
        </div>
        <span class="badge badge-success">مدفوع</span>
      </div>`;
    }).join('');
  }

  const maintBody = document.getElementById('dashMaintenance');
  const recentMaint = [...maintenance].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  if (recentMaint.length === 0) {
    maintBody.innerHTML = '<div class="empty-state"><div class="icon">🔧</div><p>لا توجد طلبات صيانة</p></div>';
  } else {
    maintBody.innerHTML = recentMaint.map(m => {
      const p = DB.getProperty(m.propertyId);
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--gray-100)">
        <div>
          <div style="font-weight:500">${m.title}</div>
          <div style="font-size:12px;color:var(--gray-500)">${p ? p.name : ''} | ${m.date}</div>
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
  renderProperties();
  renderDashboard();
}

function editProperty(id) {
  const p = DB.getProperty(id);
  if (p) openPropertyForm(p);
}

function deleteProperty(id) {
  if (confirm('هل أنت متأكد من حذف هذا العقار؟')) {
    DB.deleteProperty(id);
    renderProperties();
    renderDashboard();
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

  const stats = DB.getPropertyStats(id);
  const units = DB.getUnitsByProperty(id);
  const contracts = DB.getContractsByProperty(id);
  const payments = DB.getPaymentsByProperty(id);
  const maintenance = DB.getMaintenanceByProperty(id);

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

  // بطاقات الإحصائيات المالية
  document.getElementById('detailStats').innerHTML = `
    <div class="stat-card">
      <div class="label">💰 الدخل الشهري</div>
      <div class="value" style="color:var(--success)">${stats.monthlyIncome.toLocaleString()} ر.س</div>
      <div class="sub">الشهر الحالي</div>
    </div>
    <div class="stat-card">
      <div class="label">📈 الدخل السنوي</div>
      <div class="value" style="color:var(--primary)">${stats.yearlyIncome.toLocaleString()} ر.س</div>
      <div class="sub">السنة الحالية</div>
    </div>
    <div class="stat-card">
      <div class="label">⏳ الدفعات القادمة</div>
      <div class="value" style="color:var(--warning)">${stats.upcomingPayments.toLocaleString()} ر.س</div>
      <div class="sub">استحقاق العقود النشطة</div>
    </div>
    <div class="stat-card">
      <div class="label">⚠️ الدفعات المتأخرة</div>
      <div class="value" style="color:var(--danger)">${stats.lateTotal.toLocaleString()} ر.س</div>
      <div class="sub">${stats.lateCount} دفعة متأخرة</div>
    </div>
    <div class="stat-card">
      <div class="label">🏠 الوحدات</div>
      <div class="value">${stats.rentedUnits}/${stats.totalUnits}</div>
      <div class="sub">${stats.vacantUnits} وحدة شاغرة</div>
    </div>
    <div class="stat-card">
      <div class="label">📄 العقود النشطة</div>
      <div class="value">${stats.activeContracts}</div>
      <div class="sub">${stats.totalUnits > 0 ? Math.round(stats.rentedUnits/stats.totalUnits*100) : 0}% إشغال</div>
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
        const tenant = contract ? DB.getTenant(contract.tenantId) : null;
        return `<tr>
          <td>
            <strong>${u.name}</strong>
            ${tenant ? '<br><span style="font-size:12px;color:var(--gray-500)">' + tenant.name + '</span>' : ''}
            ${contract && contract.status === 'نشط' ? '<br><span style="font-size:11px;color:var(--gray-500)">عقد #' + contract.id + '</span>' : ''}
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
      const unit = DB.getUnit(c.unitId);
      const tenant = DB.getTenant(c.tenantId);
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
  const instByProp = DB.getInstallmentsByProperty(id);
  const payBody = document.getElementById('detailPayments');
  if (instByProp.length === 0) {
    payBody.innerHTML = '<div class="empty-state"><div class="icon">💰</div><p>لا توجد أقساط لهذه العمارة</p></div>';
  } else {
    payBody.innerHTML = `<table>
      <thead><tr><th>تاريخ الاستحقاق</th><th>الوحدة</th><th>المبلغ</th><th>تاريخ الدفع</th><th>طريقة الدفع</th><th>الحالة</th><th></th></tr></thead>
      <tbody>${[...instByProp].sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate)).map(i => {
      const c = DB.getContract(i.contractId);
      const u = c ? DB.getUnit(c.unitId) : null;
      const isOverdue = i.status === 'قادم' && new Date(i.dueDate) < new Date(new Date().toISOString().split('T')[0]);
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
  renderPropertyDetail(currentPropertyId);
  renderProperties();
  renderDashboard();
}

function editUnit(id) {
  const u = DB.getUnit(id);
  if (u) openUnitForm(u);
}

function deleteUnit(id) {
  if (confirm('هل أنت متأكد من حذف هذه الوحدة؟')) {
    DB.deleteUnit(id);
    renderPropertyDetail(currentPropertyId);
    renderProperties();
    renderDashboard();
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
  renderTenants();
  renderDashboard();
}

function editTenant(id) {
  const t = DB.getTenant(id);
  if (t) openTenantForm(t);
}

function deleteTenant(id) {
  if (confirm('هل أنت متأكد من حذف هذا المستأجر؟')) {
    DB.deleteTenant(id);
    renderTenants();
    renderDashboard();
  }
}

// ---- Contracts ----
function renderContracts() {
  const items = DB.getContracts();
  const tbody = document.getElementById('contractsTableBody');
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="icon">📄</div><p>لا توجد عقود. أضف عقداً جديداً</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(c => {
    const prop = DB.getProperty(c.propertyId);
    const unit = DB.getUnit(c.unitId);
    const tenant = DB.getTenant(c.tenantId);
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
  renderContracts();
  renderDashboard();
}

function editContract(id) {
  const c = DB.getContract(id);
  if (c) openContractForm(c);
}

function deleteContract(id) {
  if (confirm('هل أنت متأكد من حذف هذا العقد؟')) {
    DB.deleteContract(id);
    renderContracts();
    renderDashboard();
  }
}

// ---- Payments (نظام الأقساط) ----
function renderPayments() {
  const items = DB.getInstallments();
  const today = new Date(new Date().toISOString().split('T')[0]);
  const container = document.getElementById('paymentsContainer');

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
          const c = DB.getContract(i.contractId);
          const prop = c ? DB.getProperty(c.propertyId) : null;
          const unit = c ? DB.getUnit(c.unitId) : null;
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
  const c = DB.getContract(inst.contractId);
  const prop = c ? DB.getProperty(c.propertyId) : null;
  const unit = c ? DB.getUnit(c.unitId) : null;
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
    reference: contract ? `عقد #${contract.id}` : ''
  });
  closeModal('paymentModal');
  renderPayments();
  renderVouchers();
  renderDashboard();
  const p = document.getElementById(`page-${currentPage}`);
  if (p && currentPage === 'property-detail') renderPropertyDetail(currentPropertyId);
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
  renderPayments();
  renderDashboard();
  if (currentPage === 'property-detail') renderPropertyDetail(currentPropertyId);
}

// ---- Maintenance ----
function renderMaintenance() {
  const items = DB.getMaintenance();
  const tbody = document.getElementById('maintenanceTableBody');
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="icon">🔧</div><p>لا توجد طلبات صيانة. أضف طلباً جديداً</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(m => {
    const p = DB.getProperty(m.propertyId);
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
  renderMaintenance();
  renderDashboard();
}

function editMaintenance(id) {
  const m = DB.getMaintenanceItem(id);
  if (m) openMaintenanceForm(m);
}

function deleteMaintenance(id) {
  if (confirm('هل أنت متأكد من حذف طلب الصيانة هذا؟')) {
    DB.deleteMaintenance(id);
    renderMaintenance();
    renderDashboard();
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
  document.getElementById('vstatReceipt').textContent = receiptTotal.toLocaleString() + ' ر.س';
  document.getElementById('vstatPayment').textContent = paymentTotal.toLocaleString() + ' ر.س';
  document.getElementById('vstatBalance').textContent = (receiptTotal - paymentTotal).toLocaleString() + ' ر.س';
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
    <td><span class="badge ${v.type === 'قبض' ? 'badge-success' : 'badge-warning'}">${v.type === 'قبض' ? '📥 قبض' : '📤 صرف'}</span></td>
    <td style="color:var(--gray-700)">${v.date || '—'}</td>
    <td title="${v.description || ''}">${(v.description || '').substring(0, 35)}${(v.description || '').length > 35 ? '…' : ''}</td>
    <td style="font-weight:600">${Number(v.amount || 0).toLocaleString()} ر.س</td>
    <td style="color:var(--gray-500);font-size:13px">${v.reference || '—'}</td>
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

  // الإيرادات + المصروفات
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

  // رسم بياني شهري
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  let chartHtml = '<div style="display:flex;gap:4px;align-items:flex-end;height:160px;padding:8px 0">';
  let maxV = 1;
  const mData = months.map((m, i) => {
    const inc = finEntries.filter(e => e.type === 'إيراد' && e.date).filter(e => { const d = new Date(e.date); return d.getMonth() === i && d.getFullYear() === cy; }).reduce((s, e) => s + Number(e.amount || 0), 0)
      + vouchers.filter(v => v.type === 'قبض' && v.date).filter(v => { const d = new Date(v.date); return d.getMonth() === i && d.getFullYear() === cy; }).reduce((s, v) => s + Number(v.amount || 0), 0);
    const exp = finEntries.filter(e => e.type === 'مصروف' && e.date).filter(e => { const d = new Date(e.date); return d.getMonth() === i && d.getFullYear() === cy; }).reduce((s, e) => s + Number(e.amount || 0), 0)
      + vouchers.filter(v => v.type === 'صرف' && v.date).filter(v => { const d = new Date(v.date); return d.getMonth() === i && d.getFullYear() === cy; }).reduce((s, v) => s + Number(v.amount || 0), 0);
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

// ---- Vouchers ----
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

function updateVoucherNumber() {
  updateVoucherPreview();
}

function openVoucherForm(data) {
  editingId = data?.id || null;
  document.getElementById('voucherId').value = data?.id || '';
  document.getElementById('voucherType').value = data?.type || 'قبض';
  document.getElementById('voucherDate').value = data?.date || new Date().toISOString().split('T')[0];
  document.getElementById('voucherAmount').value = data?.amount || '';
  document.getElementById('voucherDesc').value = data?.description || '';
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
  // Live preview on input
  ['voucherType','voucherAmount','voucherDesc'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateVoucherPreview, { once: false });
  });
}

function saveVoucher() {
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
  const data = { id: editingId || null, type, date, amount, description: desc, reference: ref };
  const saved = DB.saveVoucher(data);
  closeModal('voucherModal');
  renderVouchers();
  if (currentPage === 'property-detail') renderPropertyDetail(currentPropertyId);
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
  const org = DB.getOrg(DB.getCurrentOrgId());
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>${v.number} - ${v.type}</title>
    <style>
      body { font-family: 'Segoe UI',sans-serif; padding:0; margin:0; background:#f5f5f5; }
      .vp { padding:40px; max-width:700px; margin:40px auto; background:white; box-shadow:0 2px 12px rgba(0,0,0,0.1); border-radius:12px; }
      .vp-hdr { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #202124; padding-bottom:16px; margin-bottom:24px; }
      .vp-hdr .t { font-size:28px; font-weight:700; }
      .vp-hdr .n { font-size:14px; color:#5f6368; font-family:monospace; }
      .vp-amt { font-size:36px; font-weight:700; text-align:center; padding:24px; background:#f8f9fa; border-radius:12px; margin-bottom:24px; }
      .vp-desc { font-size:16px; line-height:2; padding:16px; border:1px solid #dadce0; border-radius:8px; min-height:80px; margin-bottom:24px; }
      .vp-ftr { display:flex; justify-content:space-between; font-size:13px; color:#5f6368; border-top:1px solid #dadce0; padding-top:16px; }
      .vp-org { text-align:center; margin-bottom:24px; }
      .vp-org h2 { margin:0; font-size:20px; }
      .vp-org span { font-size:13px; color:#5f6368; }
      @media print { body { background:white; } .vp { box-shadow:none; margin:0; border-radius:0; } }
    </style>
  </head><body>
    <div class="vp">
      <div class="vp-org"><div style="font-size:48px;margin-bottom:8px">${org ? (org.logo || '🏢') : '🏢'}</div><h2>${org ? org.name : 'المؤسسة العقارية'}</h2><span>${org ? org.phone || '' : ''} ${org && org.email ? '| ' + org.email : ''}</span></div>
      <div class="vp-hdr">
        <div class="t" style="color:${v.type === 'قبض' ? '#0f9d58' : '#d93025'}">${v.type === 'قبض' ? '📥' : '📤'} سند ${v.type === 'قبض' ? 'قبض' : 'صرف'}</div>
        <div class="n">${v.number || ''}<br><span style="font-size:12px;color:#9aa0a6">${v.date || ''}</span></div>
      </div>
      <div class="vp-amt" style="color:${v.type === 'قبض' ? '#0f9d58' : '#d93025'}">${Number(v.amount || 0).toLocaleString()} ر.س</div>
      <div class="vp-desc">${v.description || '—'}</div>
      ${v.reference ? `<div style="text-align:center;margin-bottom:16px;color:#5f6368;font-size:14px">المرجع: ${v.reference}</div>` : ''}
      <div class="vp-ftr">
        <span>رقم السند: ${v.number || ''}</span>
        <span>تاريخ الإصدار: ${v.date || ''}</span>
        <span>🖨️ ${new Date().toLocaleDateString('ar-SA')}</span>
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
  if (user === 'admin' && !JSON.parse(localStorage.getItem('_users') || '[]').length) return alert('لا يمكن حذف المستخدم الافتراضي');
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
  if (!confirm('⚠️ استيراد البيانات سيحل محل جميع البيانات الحالية. هل أنت متأكد؟')) {
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const count = DB.importAll(e.target.result);
      alert(`✅ تم استيراد بيانات ${count} مؤسسة بنجاح.\nسيتم تحديث الصفحة الآن.`);
      event.target.value = '';
      window.location.reload();
    } catch (err) {
      alert('❌ خطأ في الاستيراد: ' + err.message + '\nتأكد من أن الملف صحيح.');
      event.target.value = '';
    }
  };
  reader.readAsText(file);
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
