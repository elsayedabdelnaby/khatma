// ============================================================
// Khatma Admin Dashboard - Application Logic
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDkR0nRyW6l69fFEUeAnROr22pFA5rwHwY",
  authDomain: "khatma-app-7a3f0.firebaseapp.com",
  projectId: "khatma-app-7a3f0",
  storageBucket: "khatma-app-7a3f0.firebasestorage.app",
  messagingSenderId: "163549756705",
  appId: "1:163549756705:web:8822c12aba40c0f2275260",
  measurementId: "G-ZD1S6TJMDH"
};

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();

let API_URL = '';
let AUTH_TOKEN = '';
let currentUser = null;

// ============================================================
// API Helper
// ============================================================
async function api(path, method = 'GET', body = null) {
  if (currentUser) {
    AUTH_TOKEN = await currentUser.getIdToken();
  }

  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_URL}${path}`, opts);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message || `Request failed (${res.status})`);
  }
  return data.data;
}

// ============================================================
// Email/Password Sign-In
// ============================================================
async function doLogin() {
  const url = document.getElementById('apiUrlInput').value.trim().replace(/\/$/, '');
  const email = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;

  if (!url) { showLoginError('Please enter the API URL'); return; }
  if (!email) { showLoginError('Please enter your email'); return; }
  if (!password) { showLoginError('Please enter your password'); return; }

  API_URL = url;
  localStorage.setItem('khatma_api_url', url);
  localStorage.setItem('khatma_admin_email', email);

  const btn = document.getElementById('loginBtn');
  const loading = document.getElementById('loginLoading');
  btn.disabled = true;
  loading.style.display = 'block';
  document.getElementById('loginError').style.display = 'none';

  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    currentUser = result.user;
    AUTH_TOKEN = await currentUser.getIdToken();

    await syncUserWithBackend(currentUser);
    showMainApp(currentUser);
  } catch (err) {
    console.error('Sign-in error:', err);
    const messages = {
      'auth/user-not-found': 'No admin account with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/invalid-email': 'Invalid email format',
      'auth/too-many-requests': 'Too many attempts. Try again later',
      'auth/invalid-credential': 'Invalid email or password',
    };
    showLoginError(messages[err.code] || err.message);
  } finally {
    btn.disabled = false;
    loading.style.display = 'none';
  }
}

async function syncUserWithBackend(user) {
  try {
    await api('/user/sync', 'POST', {
      email: user.email || '',
      displayName: user.displayName || 'Admin',
      photoUrl: user.photoURL || '',
    });
  } catch (err) {
    console.warn('User sync:', err.message);
  }
}

// ============================================================
// Show Main App
// ============================================================
function showMainApp(user) {
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'flex';

  if (user) {
    const userInfo = document.getElementById('userInfo');
    const userPhoto = document.getElementById('userPhoto');
    const userName = document.getElementById('userName');
    userInfo.style.display = 'flex';
    userPhoto.style.display = 'none';
    userName.textContent = user.email || 'Admin';
  }

  loadAllData();
}

// ============================================================
// Logout
// ============================================================
async function doLogout() {
  try { await auth.signOut(); } catch (e) { /* ignore */ }
  currentUser = null;
  AUTH_TOKEN = '';
  document.getElementById('userInfo').style.display = 'none';
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('passwordInput').value = '';
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.style.display = 'block';
}

// ============================================================
// Auto-login: check for existing Firebase session
// ============================================================
auth.onAuthStateChanged(async (user) => {
  const savedUrl = localStorage.getItem('khatma_api_url');
  const savedEmail = localStorage.getItem('khatma_admin_email');

  if (savedUrl) document.getElementById('apiUrlInput').value = savedUrl;
  if (savedEmail) document.getElementById('emailInput').value = savedEmail;

  if (user && savedUrl) {
    API_URL = savedUrl;
    currentUser = user;
    AUTH_TOKEN = await user.getIdToken();
    showMainApp(user);
  }
});

// ============================================================
// Navigation
// ============================================================
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const section = item.dataset.section;

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');

    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`${section}Section`).classList.add('active');

    const titles = { banners: 'Banners', khatmaTypes: 'Khatma Types', notifTypes: 'Notification Types' };
    document.getElementById('pageTitle').textContent = titles[section] || section;

    document.querySelector('.sidebar').classList.remove('open');
  });
});

function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
}

// ============================================================
// Load All Data
// ============================================================
async function loadAllData() {
  loadBanners();
  loadKhatmaTypes();
  loadNotifTypes();
}

// ============================================================
// BANNERS
// ============================================================
async function loadBanners() {
  const grid = document.getElementById('bannersGrid');
  try {
    const data = await api('/admin/banners');
    const banners = data.banners || [];

    if (banners.length === 0) {
      grid.innerHTML = '<div class="empty-state"><i class="fas fa-images"></i><p>No banners yet. Add your first banner!</p></div>';
      return;
    }

    grid.innerHTML = banners.map(b => `
      <div class="card">
        <div class="card-image">
          ${b.imageUrl
            ? `<img src="${b.imageUrl}" alt="${escHtml(b.title_en)}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-image\\'></i>'">`
            : '<i class="fas fa-image"></i>'}
        </div>
        <div class="card-body">
          <div class="card-title">
            <span class="status-dot ${b.isActive ? 'active' : 'inactive'}"></span>
            ${escHtml(b.title_en || b.title_ar || 'Untitled')}
          </div>
          <div class="card-meta">
            <span><i class="fas fa-sort"></i> Order: ${b.sortOrder || 0}</span>
            ${b.startDate ? `<span><i class="fas fa-calendar"></i> ${b.startDate}</span>` : ''}
          </div>
          ${b.title_ar ? `<div class="card-meta" dir="rtl" style="font-size:13px;color:#475569">${escHtml(b.title_ar)}</div>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn btn-ghost btn-sm" onclick='editBanner(${JSON.stringify(b).replace(/'/g, "&#39;")})'>
            <i class="fas fa-edit"></i> Edit
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteBannerConfirm('${b.bannerId}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${escHtml(err.message)}</p></div>`;
  }
}

function showBannerModal() {
  document.getElementById('bannerModalTitle').textContent = 'Add Banner';
  document.getElementById('bannerEditId').value = '';
  document.getElementById('bannerTitleAr').value = '';
  document.getElementById('bannerTitleEn').value = '';
  document.getElementById('bannerTitleUr').value = '';
  document.getElementById('bannerTitleHi').value = '';
  document.getElementById('bannerLinkUrl').value = '';
  document.getElementById('bannerSortOrder').value = '0';
  document.getElementById('bannerStartDate').value = '';
  document.getElementById('bannerEndDate').value = '';
  document.getElementById('bannerIsActive').checked = true;
  document.getElementById('bannerImageUrl').value = '';
  resetImageUpload();
  openModal('bannerModal');
}

function editBanner(b) {
  document.getElementById('bannerModalTitle').textContent = 'Edit Banner';
  document.getElementById('bannerEditId').value = b.bannerId;
  document.getElementById('bannerTitleAr').value = b.title_ar || '';
  document.getElementById('bannerTitleEn').value = b.title_en || '';
  document.getElementById('bannerTitleUr').value = b.title_ur || '';
  document.getElementById('bannerTitleHi').value = b.title_hi || '';
  document.getElementById('bannerLinkUrl').value = b.linkUrl || '';
  document.getElementById('bannerSortOrder').value = b.sortOrder || 0;
  document.getElementById('bannerStartDate').value = b.startDate || '';
  document.getElementById('bannerEndDate').value = b.endDate || '';
  document.getElementById('bannerIsActive').checked = b.isActive !== false;
  document.getElementById('bannerImageUrl').value = b.imageUrl || '';

  if (b.imageUrl) {
    const preview = document.getElementById('bannerPreview');
    preview.src = b.imageUrl;
    preview.style.display = 'block';
    document.getElementById('bannerUploadPlaceholder').style.display = 'none';
    document.getElementById('bannerUploadArea').classList.add('has-image');
  } else {
    resetImageUpload();
  }

  openModal('bannerModal');
}

async function saveBanner() {
  const editId = document.getElementById('bannerEditId').value;
  const btn = document.getElementById('saveBannerBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  const body = {
    title_ar: document.getElementById('bannerTitleAr').value,
    title_en: document.getElementById('bannerTitleEn').value,
    title_ur: document.getElementById('bannerTitleUr').value,
    title_hi: document.getElementById('bannerTitleHi').value,
    imageUrl: document.getElementById('bannerImageUrl').value,
    linkUrl: document.getElementById('bannerLinkUrl').value,
    sortOrder: parseInt(document.getElementById('bannerSortOrder').value) || 0,
    startDate: document.getElementById('bannerStartDate').value,
    endDate: document.getElementById('bannerEndDate').value,
    isActive: document.getElementById('bannerIsActive').checked,
  };

  try {
    if (editId) {
      await api(`/admin/banners/${editId}`, 'PUT', body);
      showToast('Banner updated!', 'success');
    } else {
      await api('/admin/banners', 'POST', body);
      showToast('Banner created!', 'success');
    }
    closeModal('bannerModal');
    loadBanners();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Save Banner';
  }
}

async function deleteBannerConfirm(bannerId) {
  if (!confirm('Are you sure you want to delete this banner?')) return;
  try {
    await api(`/admin/banners/${bannerId}`, 'DELETE');
    showToast('Banner deleted', 'success');
    loadBanners();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// IMAGE UPLOAD
// ============================================================
document.getElementById('bannerUploadArea').addEventListener('click', () => {
  document.getElementById('bannerFileInput').click();
});

document.getElementById('bannerUploadArea').addEventListener('dragover', (e) => {
  e.preventDefault();
  e.currentTarget.style.borderColor = 'var(--primary)';
});

document.getElementById('bannerUploadArea').addEventListener('dragleave', (e) => {
  e.currentTarget.style.borderColor = '';
});

document.getElementById('bannerUploadArea').addEventListener('drop', (e) => {
  e.preventDefault();
  e.currentTarget.style.borderColor = '';
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    uploadBannerImage(file);
  }
});

function handleBannerImageSelect(event) {
  const file = event.target.files[0];
  if (file) uploadBannerImage(file);
}

async function uploadBannerImage(file) {
  if (file.size > 2 * 1024 * 1024) {
    showToast('Image must be under 2MB', 'error');
    return;
  }

  const progressBar = document.getElementById('uploadProgress');
  const progressFill = progressBar.querySelector('.progress-fill');
  progressBar.style.display = 'block';
  progressFill.style.width = '20%';

  try {
    const contentType = file.type || 'image/jpeg';
    const data = await api(`/admin/upload-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(contentType)}`);

    progressFill.style.width = '50%';

    await fetch(data.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });

    progressFill.style.width = '100%';

    document.getElementById('bannerImageUrl').value = data.imageUrl;

    const preview = document.getElementById('bannerPreview');
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
    document.getElementById('bannerUploadPlaceholder').style.display = 'none';
    document.getElementById('bannerUploadArea').classList.add('has-image');

    showToast('Image uploaded!', 'success');
  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error');
  } finally {
    setTimeout(() => { progressBar.style.display = 'none'; progressFill.style.width = '0'; }, 1000);
  }
}

function resetImageUpload() {
  document.getElementById('bannerPreview').style.display = 'none';
  document.getElementById('bannerPreview').src = '';
  document.getElementById('bannerUploadPlaceholder').style.display = '';
  document.getElementById('bannerUploadArea').classList.remove('has-image');
  document.getElementById('bannerFileInput').value = '';
}

// ============================================================
// KHATMA TYPES
// ============================================================
async function loadKhatmaTypes() {
  const grid = document.getElementById('khatmaTypesGrid');
  try {
    const data = await api('/admin/khatma-types');
    const types = data.khatmaTypes || [];

    if (types.length === 0) {
      grid.innerHTML = '<div class="empty-state"><i class="fas fa-layer-group"></i><p>No khatma types yet. Add your first type!</p></div>';
      return;
    }

    grid.innerHTML = types.map(t => `
      <div class="card type-card">
        <div class="card-body">
          <div class="type-icon">${escHtml(t.icon || '📖')}</div>
          <div class="card-title">
            <span class="status-dot ${t.isActive ? 'active' : 'inactive'}"></span>
            ${escHtml(t.name_en || t.name_ar || 'Untitled')}
          </div>
          ${t.name_ar ? `<div class="card-meta" dir="rtl">${escHtml(t.name_ar)}</div>` : ''}
          <div class="card-meta" style="margin-top:8px">
            ${t.description_en ? escHtml(t.description_en.substring(0, 80)) : ''}
          </div>
          <div style="margin-top:8px">
            <span class="type-badge">Order: ${t.sortOrder || 0}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn btn-ghost btn-sm" onclick='editKhatmaType(${JSON.stringify(t).replace(/'/g, "&#39;")})'>
            <i class="fas fa-edit"></i> Edit
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteKhatmaTypeConfirm('${t.typeId}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${escHtml(err.message)}</p></div>`;
  }
}

function showKhatmaTypeModal() {
  document.getElementById('khatmaTypeModalTitle').textContent = 'Add Khatma Type';
  document.getElementById('khatmaTypeEditId').value = '';
  document.getElementById('ktNameAr').value = '';
  document.getElementById('ktNameEn').value = '';
  document.getElementById('ktNameUr').value = '';
  document.getElementById('ktNameHi').value = '';
  document.getElementById('ktDescAr').value = '';
  document.getElementById('ktDescEn').value = '';
  document.getElementById('ktIcon').value = '';
  document.getElementById('ktSortOrder').value = '0';
  document.getElementById('ktIsActive').checked = true;
  openModal('khatmaTypeModal');
}

function editKhatmaType(t) {
  document.getElementById('khatmaTypeModalTitle').textContent = 'Edit Khatma Type';
  document.getElementById('khatmaTypeEditId').value = t.typeId;
  document.getElementById('ktNameAr').value = t.name_ar || '';
  document.getElementById('ktNameEn').value = t.name_en || '';
  document.getElementById('ktNameUr').value = t.name_ur || '';
  document.getElementById('ktNameHi').value = t.name_hi || '';
  document.getElementById('ktDescAr').value = t.description_ar || '';
  document.getElementById('ktDescEn').value = t.description_en || '';
  document.getElementById('ktIcon').value = t.icon || '';
  document.getElementById('ktSortOrder').value = t.sortOrder || 0;
  document.getElementById('ktIsActive').checked = t.isActive !== false;
  openModal('khatmaTypeModal');
}

async function saveKhatmaType() {
  const editId = document.getElementById('khatmaTypeEditId').value;
  const btn = document.getElementById('saveKtBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  const body = {
    name_ar: document.getElementById('ktNameAr').value,
    name_en: document.getElementById('ktNameEn').value,
    name_ur: document.getElementById('ktNameUr').value,
    name_hi: document.getElementById('ktNameHi').value,
    description_ar: document.getElementById('ktDescAr').value,
    description_en: document.getElementById('ktDescEn').value,
    icon: document.getElementById('ktIcon').value,
    sortOrder: parseInt(document.getElementById('ktSortOrder').value) || 0,
    isActive: document.getElementById('ktIsActive').checked,
  };

  try {
    if (editId) {
      await api(`/admin/khatma-types/${editId}`, 'PUT', body);
      showToast('Khatma type updated!', 'success');
    } else {
      await api('/admin/khatma-types', 'POST', body);
      showToast('Khatma type created!', 'success');
    }
    closeModal('khatmaTypeModal');
    loadKhatmaTypes();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Save Type';
  }
}

async function deleteKhatmaTypeConfirm(typeId) {
  if (!confirm('Are you sure you want to delete this khatma type?')) return;
  try {
    await api(`/admin/khatma-types/${typeId}`, 'DELETE');
    showToast('Khatma type deleted', 'success');
    loadKhatmaTypes();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// NOTIFICATION TYPES
// ============================================================
async function loadNotifTypes() {
  const grid = document.getElementById('notifTypesGrid');
  try {
    const data = await api('/admin/notification-types');
    const types = data.notificationTypes || [];

    if (types.length === 0) {
      grid.innerHTML = '<div class="empty-state"><i class="fas fa-bell"></i><p>No notification types yet. Add your first type!</p></div>';
      return;
    }

    grid.innerHTML = types.map(t => `
      <div class="card type-card">
        <div class="card-body">
          <div class="card-title">
            <span class="status-dot ${t.isActive ? 'active' : 'inactive'}"></span>
            ${escHtml(t.type || 'Unknown')}
          </div>
          <div style="margin-bottom:8px">
            <span class="type-badge">${escHtml(t.type || '')}</span>
            ${t.subType ? `<span class="type-badge sub">${escHtml(t.subType)}</span>` : ''}
          </div>
          ${t.template_ar ? `<div class="card-meta" dir="rtl" style="font-size:13px;margin-bottom:4px">${escHtml(t.template_ar.substring(0, 100))}</div>` : ''}
          ${t.template_en ? `<div class="card-meta" style="font-size:13px">${escHtml(t.template_en.substring(0, 100))}</div>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn btn-ghost btn-sm" onclick='editNotifType(${JSON.stringify(t).replace(/'/g, "&#39;")})'>
            <i class="fas fa-edit"></i> Edit
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${escHtml(err.message)}</p></div>`;
  }
}

function showNotifTypeModal() {
  document.getElementById('notifTypeModalTitle').textContent = 'Add Notification Type';
  document.getElementById('notifTypeEditId').value = '';
  document.getElementById('ntType').value = 'motivational';
  document.getElementById('ntSubType').value = '';
  document.getElementById('ntTemplateAr').value = '';
  document.getElementById('ntTemplateEn').value = '';
  document.getElementById('ntTemplateUr').value = '';
  document.getElementById('ntTemplateHi').value = '';
  document.getElementById('ntIsActive').checked = true;
  openModal('notifTypeModal');
}

function editNotifType(t) {
  document.getElementById('notifTypeModalTitle').textContent = 'Edit Notification Type';
  document.getElementById('notifTypeEditId').value = t.typeId;
  document.getElementById('ntType').value = t.type || 'motivational';
  document.getElementById('ntSubType').value = t.subType || '';
  document.getElementById('ntTemplateAr').value = t.template_ar || '';
  document.getElementById('ntTemplateEn').value = t.template_en || '';
  document.getElementById('ntTemplateUr').value = t.template_ur || '';
  document.getElementById('ntTemplateHi').value = t.template_hi || '';
  document.getElementById('ntIsActive').checked = t.isActive !== false;
  openModal('notifTypeModal');
}

async function saveNotifType() {
  const editId = document.getElementById('notifTypeEditId').value;
  const btn = document.getElementById('saveNtBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  const body = {
    type: document.getElementById('ntType').value,
    subType: document.getElementById('ntSubType').value,
    template_ar: document.getElementById('ntTemplateAr').value,
    template_en: document.getElementById('ntTemplateEn').value,
    template_ur: document.getElementById('ntTemplateUr').value,
    template_hi: document.getElementById('ntTemplateHi').value,
    isActive: document.getElementById('ntIsActive').checked,
  };

  try {
    if (editId) {
      await api(`/admin/notification-types/${editId}`, 'PUT', body);
      showToast('Notification type updated!', 'success');
    } else {
      await api('/admin/notification-types', 'POST', body);
      showToast('Notification type created!', 'success');
    }
    closeModal('notifTypeModal');
    loadNotifTypes();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Save Type';
  }
}

// ============================================================
// Modal Helpers
// ============================================================
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// ============================================================
// Toast
// ============================================================
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// ============================================================
// Utils
// ============================================================
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
