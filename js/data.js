const DB = {
  _currentOrgId: null,

  init() {
    // هجرة البيانات القديمة إلى النظام الجديد
    const oldProps = (() => { try { return JSON.parse(localStorage.getItem('properties')); } catch { return null; } })();
    if (oldProps && Array.isArray(oldProps) && oldProps.length > 0) {
      ['properties','tenants','units','contracts','payments','maintenance','installments'].forEach(k => {
        const val = localStorage.getItem(k);
        if (val) { localStorage.setItem(`org_1_${k}`, val); localStorage.removeItem(k); }
      });
    }
    const orgId = parseInt(localStorage.getItem('_currentOrg'));
    const orgs = this._getOrgs();
    if (orgs.length === 0) {
      this._setOrgs([{ id: 1, name: 'المؤسسة العقارية', phone: '', email: '', logo: '🏢', createdAt: new Date().toISOString() }]);
      this._setCurrentOrg(1);
      this.seed();
    } else if (orgId && orgs.some(o => o.id === orgId)) {
      this._currentOrgId = orgId;
    } else {
      this._setCurrentOrg(orgs[0].id);
    }
  },

  _getOrgs() {
    try { return JSON.parse(localStorage.getItem('_orgs')) || []; } catch { return []; }
  },
  _setOrgs(orgs) {
    localStorage.setItem('_orgs', JSON.stringify(orgs));
  },
  getOrgs() { return this._getOrgs(); },
  getOrg(id) { return this._getOrgs().find(o => o.id === id); },

  saveOrg(o) {
    const items = this._getOrgs();
    if (o.id) {
      const idx = items.findIndex(i => i.id === o.id);
      if (idx > -1) items[idx] = o;
    } else {
      o.id = items.length ? Math.max(...items.map(i => i.id)) + 1 : 1;
      o.createdAt = new Date().toISOString();
      items.push(o);
    }
    this._setOrgs(items);
    return o;
  },
  deleteOrg(id) {
    this._setOrgs(this._getOrgs().filter(i => i.id !== id));
  },

  getCurrentOrgId() {
    if (!this._currentOrgId) {
      const orgs = this._getOrgs();
      if (orgs.length > 0) this._currentOrgId = orgs[0].id;
    }
    return this._currentOrgId;
  },
  setCurrentOrg(id) {
    this._currentOrgId = id;
    localStorage.setItem('_currentOrg', String(id));
  },

  _p(key) {
    const orgId = this.getCurrentOrgId();
    return orgId ? `org_${orgId}_${key}` : key;
  },
  _get(key) {
    try { return JSON.parse(localStorage.getItem(this._p(key))) || []; } catch { return []; }
  },
  _set(key, data) {
    localStorage.setItem(this._p(key), JSON.stringify(data));
  },
  _nextId(items) {
    return items.length ? Math.max(...items.map(i => i.id)) + 1 : 1;
  },

  // العقارات
  getProperties() { return this._get('properties'); },
  saveProperty(p) {
    const items = this.getProperties();
    if (p.id) {
      const idx = items.findIndex(i => i.id === p.id);
      if (idx > -1) items[idx] = p;
    } else {
      p.id = this._nextId(items);
      p.createdAt = new Date().toISOString();
      items.push(p);
    }
    this._set('properties', items);
    return p;
  },
  deleteProperty(id) {
    this._set('properties', this.getProperties().filter(i => i.id !== id));
  },
  getProperty(id) { return this.getProperties().find(i => i.id === id); },

  // المستأجرين
  getTenants() { return this._get('tenants'); },
  saveTenant(t) {
    const items = this.getTenants();
    if (t.id) {
      const idx = items.findIndex(i => i.id === t.id);
      if (idx > -1) items[idx] = t;
    } else {
      t.id = this._nextId(items);
      t.createdAt = new Date().toISOString();
      items.push(t);
    }
    this._set('tenants', items);
    return t;
  },
  deleteTenant(id) {
    this._set('tenants', this.getTenants().filter(i => i.id !== id));
  },
  getTenant(id) { return this.getTenants().find(i => i.id === id); },

  // العقود
  getContracts() { return this._get('contracts'); },
  saveContract(c) {
    const items = this.getContracts();
    if (c.id) {
      const idx = items.findIndex(i => i.id === c.id);
      if (idx > -1) items[idx] = c;
    } else {
      c.id = this._nextId(items);
      c.createdAt = new Date().toISOString();
      items.push(c);
    }
    this._set('contracts', items);
    if (c.status === 'نشط') this.generateInstallments(c);
    return c;
  },
  deleteContract(id) {
    this._set('installments', this.getInstallments().filter(i => i.contractId !== id));
    this._set('contracts', this.getContracts().filter(i => i.id !== id));
  },
  getContract(id) { return this.getContracts().find(i => i.id === id); },

  // الأقساط
  getInstallments() { return this._get('installments'); },
  saveInstallment(inst) {
    const items = this.getInstallments();
    const idx = items.findIndex(i => i.id === inst.id);
    if (idx > -1) items[idx] = inst;
    this._set('installments', items);
    return inst;
  },
  getInstallmentsByContract(contractId) {
    return this.getInstallments().filter(i => i.contractId === contractId)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  },
  getInstallmentsByProperty(propertyId) {
    const contractIds = this.getContractsByProperty(propertyId).map(c => c.id);
    return this.getInstallments().filter(i => contractIds.includes(i.contractId));
  },
  generateInstallments(contract) {
    const freqMap = { شهري: 1, 'ربع سنوي': 3, 'نصف سنوي': 6, سنوي: 12 };
    const freqMonths = freqMap[contract.paymentFrequency] || 1;
    const numInst = Math.floor((contract.duration || 12) / freqMonths);
    if (numInst <= 0) return;

    const existing = this.getInstallmentsByContract(contract.id);
    if (existing.length >= numInst) return;

    const start = new Date(contract.startDate);
    const all = this.getInstallments();
    let nextId = this._nextId(all);

    for (let i = 0; i < numInst; i++) {
      const due = new Date(start);
      due.setMonth(due.getMonth() + i * freqMonths);
      const dueStr = due.toISOString().split('T')[0];
      if (all.some(x => x.contractId === contract.id && x.dueDate === dueStr)) continue;
      const isOverdue = new Date(dueStr) < new Date(new Date().toISOString().split('T')[0]);
      all.push({
        id: nextId++, contractId: contract.id,
        propertyId: contract.propertyId, unitId: contract.unitId,
        amount: contract.rentAmount, dueDate: dueStr,
        status: isOverdue ? 'متأخر' : 'قادم',
        paymentDate: '', paymentMethod: '', notes: '',
        createdAt: new Date().toISOString()
      });
    }
    this._set('installments', all);
  },

  // الصيانة
  getMaintenance() { return this._get('maintenance'); },
  saveMaintenance(m) {
    const items = this.getMaintenance();
    if (m.id) {
      const idx = items.findIndex(i => i.id === m.id);
      if (idx > -1) items[idx] = m;
    } else {
      m.id = this._nextId(items);
      m.createdAt = new Date().toISOString();
      items.push(m);
    }
    this._set('maintenance', items);
    return m;
  },
  deleteMaintenance(id) {
    this._set('maintenance', this.getMaintenance().filter(i => i.id !== id));
  },
  getMaintenanceItem(id) { return this.getMaintenance().find(i => i.id === id); },

  // الوحدات
  getUnits() { return this._get('units'); },
  saveUnit(u) {
    const items = this.getUnits();
    if (u.id) {
      const idx = items.findIndex(i => i.id === u.id);
      if (idx > -1) items[idx] = u;
    } else {
      u.id = this._nextId(items);
      u.createdAt = new Date().toISOString();
      items.push(u);
    }
    this._set('units', items);
    return u;
  },
  deleteUnit(id) {
    this._set('units', this.getUnits().filter(i => i.id !== id));
  },
  getUnit(id) { return this.getUnits().find(i => i.id === id); },
  getUnitsByProperty(propertyId) { return this.getUnits().filter(u => u.propertyId === propertyId); },
  getContractsByProperty(propertyId) {
    return this.getContracts().filter(c => c.propertyId === propertyId);
  },
  getMaintenanceByProperty(propertyId) {
    return this.getMaintenance().filter(m => m.propertyId === propertyId);
  },

  // إحصائيات العقار
  getPropertyStats(propertyId) {
    const inst = this.getInstallmentsByProperty(propertyId);
    const contracts = this.getContractsByProperty(propertyId);
    const units = this.getUnitsByProperty(propertyId);
    const maintenance = this.getMaintenanceByProperty(propertyId);
    const now = new Date();
    const cm = now.getMonth(), cy = now.getFullYear();
    const today = new Date(now.toISOString().split('T')[0]);

    const paid = inst.filter(i => i.status === 'مدفوع').reduce((s, i) => s + (Number(i.amount)||0), 0);
    const due = inst.filter(i => i.status === 'متأخر').reduce((s, i) => s + (Number(i.amount)||0), 0);
    const pending = inst.filter(i => i.status === 'قادم' && new Date(i.dueDate) >= today).reduce((s, i) => s + (Number(i.amount)||0), 0);

    const monthly = inst.filter(i => {
      const d = new Date(i.dueDate);
      return d.getMonth() === cm && d.getFullYear() === cy && i.status === 'مدفوع';
    }).reduce((s, i) => s + (Number(i.amount)||0), 0);

    const yearly = inst.filter(i => {
      const d = new Date(i.dueDate);
      return d.getFullYear() === cy && i.status === 'مدفوع';
    }).reduce((s, i) => s + (Number(i.amount)||0), 0);

    const active = contracts.filter(c => c.status === 'نشط').length;
    const late = inst.filter(i => i.status === 'متأخر').length;
    const rented = units.filter(u => u.status === 'مؤجر').length;
    const vacant = units.filter(u => u.status === 'شاغر').length;
    const pm = maintenance.filter(m => m.status !== 'مكتملة').length;
    const mc = maintenance.filter(m => m.status === 'مكتملة').reduce((s, m) => s + (Number(m.cost)||0), 0);

    return {
      totalPaid: paid, totalDue: due, totalPending: pending,
      monthlyIncome: monthly, yearlyIncome: yearly,
      upcomingPayments: pending, lateTotal: due, lateCount: late,
      activeContracts: active, rentedUnits: rented, vacantUnits: vacant,
      totalUnits: units.length, pendingMaintenance: pm, maintenanceCost: mc
    };
  },

  // إحصائيات عامة
  getStats() {
    const properties = this.getProperties();
    const tenants = this.getTenants();
    const contracts = this.getContracts();
    const inst = this.getInstallments();
    const maintenance = this.getMaintenance();
    const units = this.getUnits();
    const cy = new Date().getFullYear();

    const paid = inst.filter(i => i.status === 'مدفوع').reduce((s, i) => s + (Number(i.amount)||0), 0);
    const due = inst.filter(i => i.status === 'متأخر').reduce((s, i) => s + (Number(i.amount)||0), 0);
    const pendingM = maintenance.filter(m => m.status !== 'مكتملة').length;
    const yearly = inst.filter(i => {
      const d = new Date(i.dueDate);
      return d.getFullYear() === cy && i.status === 'مدفوع';
    }).reduce((s, i) => s + (Number(i.amount)||0), 0);

    return {
      totalProperties: properties.length, totalTenants: tenants.length,
      activeContracts: contracts.filter(c => c.status === 'نشط').length,
      totalPaid: paid, totalDue: due, pendingMaintenance: pendingM,
      totalUnits: units.length, yearlyIncome: yearly
    };
  },

  // السندات
  getVouchers() { return this._get('vouchers'); },
  saveVoucher(v) {
    const items = this.getVouchers();
    if (v.id) {
      const idx = items.findIndex(i => i.id === v.id);
      if (idx > -1) items[idx] = v;
    } else {
      v.id = this._nextId(items);
      v.number = `SND-${String(v.id).padStart(4, '0')}`;
      v.createdAt = new Date().toISOString();
      items.push(v);
    }
    this._set('vouchers', items);
    return v;
  },
  deleteVoucher(id) {
    this._set('vouchers', this.getVouchers().filter(i => i.id !== id));
  },
  getVoucher(id) { return this.getVouchers().find(i => i.id === id); },

  // تهيئة بيانات تجريبية
  seed() {
    if (this.getProperties().length > 0) return;
    const props = [
      { id: 1, name: 'عمارة النور', type: 'سكني', address: 'شارع الملك فهد', city: 'الرياض', area: '450', price: '500000', status: 'مؤجر', floors: '5', createdAt: new Date().toISOString() },
      { id: 2, name: 'مجمع السلام', type: 'تجاري', address: 'شارع العليا', city: 'الرياض', area: '800', price: '1200000', status: 'شاغر', floors: '3', createdAt: new Date().toISOString() },
      { id: 3, name: 'فيلا الواحة', type: 'سكني', address: 'حي النخيل', city: 'جدة', area: '350', price: '750000', status: 'مؤجر', createdAt: new Date().toISOString() },
      { id: 4, name: 'برج الأعمال', type: 'مكتبي', address: 'شارع التحلية', city: 'جدة', area: '1200', price: '2500000', status: 'قيد الإنشاء', createdAt: new Date().toISOString() }
    ];
    const tenants = [
      { id: 1, name: 'أحمد محمد', phone: '0555111222', email: 'ahmed@example.com', identity: '1010101010', createdAt: new Date().toISOString() },
      { id: 2, name: 'سارة خالد', phone: '0555222333', email: 'sara@example.com', identity: '2020202020', createdAt: new Date().toISOString() },
      { id: 3, name: 'محمد علي', phone: '0555333444', email: 'mohamed@example.com', identity: '3030303030', createdAt: new Date().toISOString() }
    ];
    const units = [
      { id: 1, propertyId: 1, name: 'شقة ١٠١', type: 'شقة', area: '120', rentAmount: '15000', status: 'مؤجر', createdAt: new Date().toISOString() },
      { id: 2, propertyId: 1, name: 'شقة ١٠٢', type: 'شقة', area: '100', rentAmount: '12000', status: 'مؤجر', createdAt: new Date().toISOString() },
      { id: 3, propertyId: 1, name: 'شقة ٢٠١', type: 'شقة', area: '130', rentAmount: '16000', status: 'مؤجر', createdAt: new Date().toISOString() },
      { id: 4, propertyId: 1, name: 'شقة ٢٠٢', type: 'شقة', area: '90', rentAmount: '10000', status: 'شاغر', createdAt: new Date().toISOString() },
      { id: 5, propertyId: 2, name: 'محل أ', type: 'محل تجاري', area: '200', rentAmount: '25000', status: 'مؤجر', createdAt: new Date().toISOString() },
      { id: 6, propertyId: 2, name: 'محل ب', type: 'محل تجاري', area: '180', rentAmount: '22000', status: 'شاغر', createdAt: new Date().toISOString() },
      { id: 7, propertyId: 3, name: 'الفل', type: 'فيلا', area: '350', rentAmount: '50000', status: 'مؤجر', createdAt: new Date().toISOString() }
    ];
    const contracts = [
      { id: 1, propertyId: 1, unitId: 1, tenantId: 1, startDate: '2026-01-01', endDate: '2027-01-01', duration: 12, paymentFrequency: 'شهري', rentAmount: '15000', status: 'نشط', createdAt: new Date().toISOString() },
      { id: 2, propertyId: 3, unitId: 7, tenantId: 2, startDate: '2026-03-01', endDate: '2027-03-01', duration: 12, paymentFrequency: 'شهري', rentAmount: '50000', status: 'نشط', createdAt: new Date().toISOString() },
      { id: 3, propertyId: 1, unitId: 2, tenantId: 3, startDate: '2026-02-01', endDate: '2027-02-01', duration: 12, paymentFrequency: 'ربع سنوي', rentAmount: '36000', status: 'نشط', createdAt: new Date().toISOString() }
    ];
    const maintenance = [
      { id: 1, propertyId: 1, title: 'إصلاح سباكة', description: 'تسريب مياه في الحمام - شقة ١٠١', cost: '800', date: '2026-02-15', status: 'مكتملة', createdAt: new Date().toISOString() },
      { id: 2, propertyId: 2, title: 'صيانة مكيفات', description: 'تنظيف وصيانة مكيفات المحلات', cost: '1500', date: '2026-03-01', status: 'قيد التنفيذ', createdAt: new Date().toISOString() },
      { id: 3, propertyId: 3, title: 'دهان واجهة', description: 'إعادة دهان الواجهة الخارجية', cost: '3000', date: '2026-04-10', status: 'مجدولة', createdAt: new Date().toISOString() },
      { id: 4, propertyId: 1, title: 'تصليح مصعد', description: 'عطل في المصعد الرئيسي', cost: '2500', date: '2026-05-20', status: 'قيد التنفيذ', createdAt: new Date().toISOString() }
    ];
    this._set('properties', props);
    this._set('tenants', tenants);
    this._set('units', units);
    this._set('contracts', contracts);
    this._set('maintenance', maintenance);
    this._set('installments', []);
    contracts.forEach(c => this.generateInstallments(c));
  }
};
