// js/admin.js
let chartJenis = null;
let chartKategori = null;
let chartStatus = null;
window.editingPendingId = null;
window.pendingSubscription = null;
window.adminReportsSubscription = null;
window.userSubscription = null;

const ADMIN_PAGE_SIZE = 6;
let adminReportsPage = 1;
let pendingProfilesPage = 1;
let userProfilesPage = 1;

// Fungsi pembantu navigasi pagination admin
window.changeAdminReportsPage = (offset) => {
  adminReportsPage += offset;
  loadAdminData();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.changePendingPage = (offset) => {
  pendingProfilesPage += offset;
  loadPendingData();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.changeUserPage = (offset) => {
  userProfilesPage += offset;
  loadUserData();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function generateUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const hex = [...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16));
  return `${hex.slice(0,8).join('')}-${hex.slice(8,12).join('')}-${hex.slice(12,16).join('')}-${hex.slice(16,20).join('')}-${hex.slice(20,32).join('')}`;
}

async function verifyAdminCredentials() {
  if (!currentUser?.id) {
    alert('Sesi admin tidak ditemukan. Silakan login ulang.');
    return false;
  }
  try {
    const { data: me, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .maybeSingle();
    if (error) {
      console.warn('Gagal cek role admin:', error.message);
      return true;
    }
    if (me?.role && me.role !== 'admin') {
      alert('Aksi hanya untuk admin.');
      return false;
    }
  } catch (err) {
    console.warn('verifyAdminCredentials error:', err);
  }
  return true;
}

// Helper generate opsi kelas
function generateKelasOptions() {
  const kelasList = [];
  for (let tingkat of ['X', 'XI', 'XII']) {
    for (let jurusan of ['RPL', 'TKJ', 'TITL', 'TEI', 'DPIB', 'SK', 'TKRO', 'TPM', 'TPL']) {
      for (let rombel of [1, 2]) {
        kelasList.push(`${tingkat} ${jurusan} ${rombel}`);
      }
    }
  }
  return kelasList.map(k => `<option>${k}</option>`).join('');
}

// ================= MANAJEMEN AKUN + PENDING PROFILES =================
async function loadUserManagement() {
  if (window.userSubscription) {
    supabase.removeChannel?.(window.userSubscription) || supabase.removeSubscription?.(window.userSubscription);
    window.userSubscription = null;
  }
  if (window.pendingSubscription) {
    supabase.removeChannel?.(window.pendingSubscription) || supabase.removeSubscription?.(window.pendingSubscription);
    window.pendingSubscription = null;
  }

  pendingProfilesPage = 1;
  userProfilesPage = 1;

  document.getElementById('mainContent').innerHTML = `
    <h1>Manajemen Akun</h1>
    
    <!-- FORM TAMBAH / EDIT DATA PENDING -->
    <div class="card">
      <h3 class="no-border">Tambah / Edit Data Siswa (Aktivasi)</h3>
      <p style="font-size:13px; margin-bottom:12px; color:#555;">Input NISN, Nama, Kelas, Role. Siswa akan menggunakan NISN ini saat registrasi.</p>
      <form id="addPendingForm">
        <div class="form-grid">
          <input type="text" id="pendingNisn" placeholder="NISN" required>
          <input type="text" id="pendingNama" placeholder="Nama Lengkap" required>
          <select id="pendingRole" required>
            <option value="">Pilih Role</option>
            <option value="student">Siswa</option>
            <option value="admin">Admin</option>
          </select>
          <select id="pendingKelas" required>
            <option value="">Pilih Kelas</option>
            ${generateKelasOptions()}
          </select>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <button type="submit" id="pendingSubmitBtn">Simpan</button>
          <button type="button" id="cancelEditPendingBtn" class="secondary" style="display:none;">Batal</button>
        </div>
      </form>
    </div>

    <!-- TABEL PENDING (MENUNGGU AKTIVASI) -->
    <div class="card">
      <h3 class="no-border">Daftar Menunggu Aktivasi</h3>
      <div class="filter-bar" style="margin-top:0;">
        <select id="pendingRoleFilter"><option value="">Semua Role</option><option value="admin">Admin</option><option value="student">Siswa</option></select>
        <input id="pendingSearch" type="text" placeholder="Cari NISN / Nama / Kelas...">
      </div>
      <div id="pendingTable"></div>
    </div>

    <!-- FORM EDIT AKUN TERDAFTAR (PROFILES) -->
    <div class="card" id="editProfileCard" style="display:none;">
      <h3 class="no-border">Edit Akun Terdaftar</h3>
      <form id="editProfileForm">
        <div class="form-grid">
          <input type="text" id="editProfileNisn" placeholder="NISN" required>
          <input type="text" id="editProfileNama" placeholder="Nama Lengkap" required>
          <select id="editProfileRole" required>
            <option value="">Pilih Role</option>
            <option value="student">Siswa</option>
            <option value="admin">Admin</option>
          </select>
          <select id="editProfileKelas" required>
            <option value="">Pilih Kelas</option>
            ${generateKelasOptions()}
          </select>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <button type="submit" id="updateProfileBtn">Simpan Data Siswa</button>
          <button type="button" id="cancelEditProfileBtn" class="secondary">Batal</button>
        </div>
      </form>
    </div>

    <!-- TABEL AKUN TERDAFTAR (PROFILES) -->
    <div class="card">
      <h3 class="no-border">Akun Terdaftar</h3>
      <div class="filter-bar" style="margin-top:0;">
        <select id="userRoleFilter"><option value="">Semua Role</option><option value="admin">Admin</option><option value="student">Siswa</option></select>
        <input id="userSearch" type="text" placeholder="Cari NISN / Nama / Kelas...">
      </div>
      <div id="userTable"></div>
    </div>
  `;

  // ========== Form Pending (Tambah/Edit) ==========
  const pendingForm = document.getElementById('addPendingForm');
  const pendingSubmitBtn = document.getElementById('pendingSubmitBtn');
  const cancelPendingBtn = document.getElementById('cancelEditPendingBtn');

  function resetPendingForm() {
    pendingForm.reset();
    window.editingPendingId = null;
    pendingSubmitBtn.textContent = 'Simpan Data Siswa';
    cancelPendingBtn.style.display = 'none';
  }

  pendingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const verified = await verifyAdminCredentials();
    if (!verified) return;

    const nisn = document.getElementById('pendingNisn').value.trim();
    const nama = document.getElementById('pendingNama').value.trim();
    const role = document.getElementById('pendingRole').value;
    const kelas = document.getElementById('pendingKelas').value;
    if (!nisn || !nama || !role || !kelas) return alert('Lengkapi semua data.');

    if (window.editingPendingId) {
      const { error } = await supabase.from('pending_profiles')
        .update({ nisn, nama, kelas, role })
        .eq('id', window.editingPendingId);
      if (error) alert('Gagal update: ' + error.message);
      else {
        alert('Data pending berhasil diupdate.');
        resetPendingForm();
        loadPendingData();
      }
    } else {
      const { data: existing } = await supabase.from('pending_profiles').select('nisn').eq('nisn', nisn).maybeSingle();
      if (existing) return alert('NISN sudah ada di daftar menunggu.');
      const { data: existingProfile } = await supabase.from('profiles').select('nisn').eq('nisn', nisn).maybeSingle();
      if (existingProfile) return alert('NISN sudah terdaftar sebagai akun aktif.');

      const { error } = await supabase.from('pending_profiles').insert({ nisn, nama, kelas, role });
      if (error) alert('Gagal menyimpan: ' + error.message);
      else {
        alert('Data siswa berhasil disimpan.');
        resetPendingForm();
        loadPendingData();
      }
    }
  });

  cancelPendingBtn.addEventListener('click', resetPendingForm);

  // ========== Form Edit Profile (Akun Terdaftar) ==========
  const editProfileCard = document.getElementById('editProfileCard');
  const editProfileForm = document.getElementById('editProfileForm');
  const cancelEditProfileBtn = document.getElementById('cancelEditProfileBtn');
  window.editingProfileId = null;

  function resetEditProfileForm() {
    editProfileForm.reset();
    window.editingProfileId = null;
    editProfileCard.style.display = 'none';
  }

  editProfileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const verified = await verifyAdminCredentials();
    if (!verified) return;
    if (!window.editingProfileId) return alert('ID akun tidak valid.');

    const nisn = document.getElementById('editProfileNisn').value.trim();
    const nama = document.getElementById('editProfileNama').value.trim();
    const role = document.getElementById('editProfileRole').value;
    const kelas = document.getElementById('editProfileKelas').value;
    if (!nisn || !nama || !role || !kelas) return alert('Lengkapi semua data.');

    const { data: existing } = await supabase.from('profiles')
      .select('id')
      .eq('nisn', nisn)
      .neq('id', window.editingProfileId)
      .maybeSingle();
    if (existing) return alert('NISN sudah digunakan akun lain.');

    const { error } = await supabase.from('profiles')
      .update({ nisn, nama, kelas, role })
      .eq('id', window.editingProfileId);
    if (error) {
      alert('Gagal update: ' + error.message);
    } else {
      alert('Akun berhasil diperbarui.');
      resetEditProfileForm();
      loadUserData();
    }
  });

  cancelEditProfileBtn.addEventListener('click', resetEditProfileForm);

  // ========== Load Data Awal & Filter ==========
  const resetPending = () => { pendingProfilesPage = 1; loadPendingData(); };
  document.getElementById('pendingRoleFilter').onchange = resetPending;
  document.getElementById('pendingSearch').oninput = resetPending;

  const resetUser = () => { userProfilesPage = 1; loadUserData(); };
  document.getElementById('userRoleFilter').onchange = resetUser;
  document.getElementById('userSearch').oninput = resetUser;

  loadPendingData();
  loadUserData();

  window.pendingSubscription = supabase
    .channel('admin-pending')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_profiles' }, () => loadPendingData())
    .subscribe();

  window.userSubscription = supabase
    .channel('admin-users')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadUserData())
    .subscribe();
}

// ================= LOAD PENDING DATA =================
async function loadPendingData() {
  const start = (pendingProfilesPage - 1) * ADMIN_PAGE_SIZE;
  const end = start + ADMIN_PAGE_SIZE - 1;

  let query = supabase.from('pending_profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  const role = document.getElementById('pendingRoleFilter')?.value;
  const search = document.getElementById('pendingSearch')?.value.trim();
  if (role) query = query.eq('role', role);
  if (search) query = query.or(`nisn.ilike.%${search}%,nama.ilike.%${search}%,kelas.ilike.%${search}%`);

  const { data, count, error } = await query.range(start, end);
  if (error) {
    document.getElementById('pendingTable').innerHTML = `<p>Gagal memuat data: ${escapeHtml(error.message)}</p>`;
    return;
  }
  if (!data || data.length === 0) {
    document.getElementById('pendingTable').innerHTML = '<p style="text-align:center; padding:16px;">Belum ada data siswa yang menunggu aktivasi.</p>';
    return;
  }
  const rows = data.map((p, i) => `
    <tr>
      <td>${start + i + 1}</td>
      <td>${escapeHtml(p.nisn)}</td>
      <td>${escapeHtml(p.nama)}</td>
      <td>${escapeHtml(p.kelas)}</td>
      <td>${escapeHtml(p.role || '-')}</td>
      <td>
        <div class="admin-action-buttons">
          <button onclick="editPendingWithForm('${p.id}')">Edit</button>
          <button onclick="deletePending('${p.id}')" class="danger">Hapus</button>
        </div>
      </td>
    </tr>
  `).join('');

  const totalPages = Math.ceil((count || 0) / ADMIN_PAGE_SIZE);
  const paginationHtml = count > ADMIN_PAGE_SIZE ? `
    <div class="pagination">
      <button onclick="changePendingPage(-1)" ${pendingProfilesPage === 1 ? 'disabled' : ''}>←</button>
      <span>${pendingProfilesPage} / ${totalPages}</span>
      <button onclick="changePendingPage(1)" ${pendingProfilesPage === totalPages ? 'disabled' : ''}>→</button>
    </div>
  ` : '';

  document.getElementById('pendingTable').innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr><th>No</th><th>NISN</th><th>Nama</th><th>Kelas</th><th>Role</th><th>Aksi</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>${paginationHtml}
  `;
}

async function editPendingWithForm(id) {
  const verified = await verifyAdminCredentials();
  if (!verified) return;
  const { data: p, error } = await supabase.from('pending_profiles').select('*').eq('id', id).single();
  if (error || !p) return alert('Gagal mengambil data pending.');
  document.getElementById('pendingNisn').value = p.nisn;
  document.getElementById('pendingNama').value = p.nama;
  document.getElementById('pendingRole').value = p.role;
  document.getElementById('pendingKelas').value = p.kelas;
  document.getElementById('pendingSubmitBtn').textContent = 'Update Data Pending';
  document.getElementById('cancelEditPendingBtn').style.display = 'inline-block';
  window.editingPendingId = id;
  document.getElementById('addPendingForm').scrollIntoView({ behavior: 'smooth' });
}

async function deletePending(id) {
  const verified = await verifyAdminCredentials();
  if (!verified) return;
  if (!confirm('Hapus data siswa ini dari daftar menunggu? Siswa tidak akan bisa mendaftar dengan NISN tersebut.')) return;
  const { error } = await supabase.from('pending_profiles').delete().eq('id', id);
  if (error) alert('Gagal menghapus: ' + error.message);
  else {
    alert('Data berhasil dihapus.');
    loadPendingData();
  }
}

// ================= LOAD USER DATA (PROFILES) =================
async function loadUserData() {
  const start = (userProfilesPage - 1) * ADMIN_PAGE_SIZE;
  const end = start + ADMIN_PAGE_SIZE - 1;

  let query = supabase.from('profiles').select('*', { count: 'exact' }).order('role', { ascending: false });
  const role = document.getElementById('userRoleFilter')?.value;
  const search = document.getElementById('userSearch')?.value.trim();
  if (role) query = query.eq('role', role);
  if (search) query = query.or(`nisn.ilike.%${search}%,nama.ilike.%${search}%,kelas.ilike.%${search}%`);
  const { data, count, error } = await query.range(start, end);
  if (error) {
    document.getElementById('userTable').innerHTML = `<p>Gagal memuat data akun: ${escapeHtml(error.message)}</p>`;
    return;
  }
  const rows = data?.map((r, i) => `
    <tr>
      <td>${start + i + 1}</td>
      <td>${escapeHtml(r.nisn)}</td>
      <td>${escapeHtml(r.nama)}</td>
      <td>${escapeHtml(r.kelas)}</td>
      <td>${escapeHtml(r.role)}</td>
      <td>
        <div class="admin-action-buttons">
          <button onclick="editProfileWithForm('${r.id}')">Edit</button>
          <button onclick="deleteUser('${r.id}')" class="danger">Hapus</button>
        </div>
      </td>
    </tr>
  `).join('');

  const totalPages = Math.ceil((count || 0) / ADMIN_PAGE_SIZE);
  const paginationHtml = count > ADMIN_PAGE_SIZE ? `
    <div class="pagination">
      <button onclick="changeUserPage(-1)" ${userProfilesPage === 1 ? 'disabled' : ''}>←</button>
      <span>${userProfilesPage} / ${totalPages}</span>
      <button onclick="changeUserPage(1)" ${userProfilesPage === totalPages ? 'disabled' : ''}>→</button>
    </div>
  ` : '';

  document.getElementById('userTable').innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr><th>No</th><th>NISN</th><th>Nama</th><th>Kelas</th><th>Role</th><th>Aksi</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>${paginationHtml}
  `;
}

async function editProfileWithForm(id) {
  const verified = await verifyAdminCredentials();
  if (!verified) return;
  const { data: user, error } = await supabase.from('profiles').select('*').eq('id', id).single();
  if (error || !user) return alert('Gagal mengambil data akun.');
  document.getElementById('editProfileNisn').value = user.nisn;
  document.getElementById('editProfileNama').value = user.nama;
  document.getElementById('editProfileRole').value = user.role;
  document.getElementById('editProfileKelas').value = user.kelas;
  document.getElementById('editProfileCard').style.display = 'block';
  window.editingProfileId = id;
  document.getElementById('editProfileCard').scrollIntoView({ behavior: 'smooth' });
}

// PERBAIKAN UTAMA: Hapus akun dengan error handling lebih baik
async function deleteUser(id) {
  if (!confirm('Hapus akun ini dari data profil? Tindakan ini hanya menghapus data profil, akun auth (email) tetap ada.')) return;
  
  const verified = await verifyAdminCredentials();
  if (!verified) return;

  // Cek apakah data dengan ID ini benar-benar ada
  const { data: existing, error: checkError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', id)
    .maybeSingle();
    
  if (checkError) {
    console.error('Gagal mengecek data:', checkError);
    alert('Gagal mengecek data: ' + checkError.message);
    return;
  }
  
  if (!existing) {
    alert('Data akun tidak ditemukan. Mungkin sudah terhapus.');
    loadUserData(); // refresh anyway
    return;
  }

  // Lakukan penghapusan
  const { error, data } = await supabase
    .from('profiles')
    .delete()
    .eq('id', id)
    .select(); // select() akan mengembalikan data yang terhapus

  if (error) {
    console.error('Error detail saat hapus:', error);
    alert('Gagal menghapus akun: ' + error.message + ' (code: ' + error.code + ')');
  } else if (!data || data.length === 0) {
    alert('Tidak ada data yang terhapus. Mungkin ID tidak valid.');
  } else {
    alert('Akun berhasil dihapus dari daftar profil.');
    // Refresh tabel
    await loadUserData();
    // Opsional: refresh juga data pending (tidak perlu)
  }
}

// ================= LAPORAN ADMIN =================
async function loadLaporanAdmin() {
  if (window.adminReportsSubscription) {
    supabase.removeSubscription(window.adminReportsSubscription);
    window.adminReportsSubscription = null;
  }
  adminReportsPage = 1;

  document.getElementById('mainContent').innerHTML = `
    <h1>Manajemen Laporan</h1>
    <div class="filter-bar">
      <select id="adminType"><option value="">Semua Jenis</option><option>kritik</option><option>saran</option><option>keluhan</option><option>pengaduan</option><option>lainnya</option></select>
      <select id="adminCat"><option value="">Semua Kategori</option><option>fasilitas</option><option>kebersihan</option><option>sanitasi</option><option>struktur</option><option>lainnya</option></select>
      <select id="adminStatus"><option value="">Semua Status</option><option>menunggu</option><option>ditindaklanjuti</option><option>selesai</option></select>
      <input id="adminSearch" type="text" placeholder="Cari judul laporan...">
    </div>
    <div id="adminTable"></div>
  `;

  const resetAdmin = () => { adminReportsPage = 1; loadAdminData(); };
  document.getElementById('adminType').onchange = resetAdmin;
  document.getElementById('adminCat').onchange = resetAdmin;
  document.getElementById('adminStatus').onchange = resetAdmin;
  document.getElementById('adminSearch').oninput = resetAdmin;

  loadAdminData();

  window.adminReportsSubscription = supabase
    .channel('admin-reports')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
      loadAdminData();
      if (typeof loadSuaraData === 'function' && document.getElementById('suaraList')) loadSuaraData();
    })
    .subscribe();
}

async function loadAdminData() {
  const start = (adminReportsPage - 1) * ADMIN_PAGE_SIZE;
  const end = start + ADMIN_PAGE_SIZE - 1;

  let query = supabase.from('reports').select('*, profiles(nama, kelas)', { count: 'exact' }).order('created_at', { ascending: false });
  const type = document.getElementById('adminType')?.value;
  const cat = document.getElementById('adminCat')?.value;
  const status = document.getElementById('adminStatus')?.value;
  const search = document.getElementById('adminSearch')?.value.trim();

  if (type) query = query.eq('type', type);
  if (cat) query = query.eq('category', cat);
  if (status) query = query.eq('status', status);
  if (search) query = query.ilike('title', `%${search}%`);

  const { data, count } = await query.range(start, end);
  const rows = data?.map((r, i) => {
    const imageBtn = r.image_url ? `<button class="secondary view-image" data-url="${escapeHtml(r.image_url)}">Lihat Gambar</button>` : '';
    return `
    <tr>
      <td>${start + i + 1}</td>
      <td>${escapeHtml(r.title)}</td>
      <td>${r.type}</td>
      <td>${r.category}</td>
      <td>${escapeHtml(r.target || '-')}</td>
      <td>${escapeHtml(r.profiles?.nama || '-')}</td>
      <td>${escapeHtml(r.profiles?.kelas || '-')}</td>
      <td><span class="badge ${r.status}">${r.status}</span></td>
      <td>${new Date(r.created_at).toLocaleDateString()}</td>
      <td>
        <div class="admin-action-buttons">
          <select onchange="updateStatus(${r.id}, this.value)">
            <option value="menunggu" ${r.status === 'menunggu' ? 'selected' : ''}>Menunggu</option>
            <option value="ditindaklanjuti" ${r.status === 'ditindaklanjuti' ? 'selected' : ''}>Ditindaklanjuti</option>
            <option value="selesai" ${r.status === 'selesai' ? 'selected' : ''}>Selesai</option>
          </select>
          ${imageBtn}
          <button onclick="deleteReport(${r.id})" class="danger">Hapus</button>
        </div>
      </td>
    </tr>
  `;
  }).join('');

  const totalPages = Math.ceil((count || 0) / ADMIN_PAGE_SIZE);
  const paginationHtml = count > ADMIN_PAGE_SIZE ? `
    <div class="pagination">
      <button onclick="changeAdminReportsPage(-1)" ${adminReportsPage === 1 ? 'disabled' : ''}>← Sebelumnya</button>
      <span>Halaman ${adminReportsPage} / ${totalPages}</span>
      <button onclick="changeAdminReportsPage(1)" ${adminReportsPage === totalPages ? 'disabled' : ''}>Berikutnya →</button>
    </div>
  ` : '';

  const adminTable = document.getElementById('adminTable');
  adminTable.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr><th>No</th><th>Judul</th><th>Jenis</th><th>Kategori</th><th>Target</th><th>Nama Pelapor</th><th>Kelas</th><th>Status</th><th>Tanggal</th><th>Aksi</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  ` + paginationHtml;
  adminTable.querySelectorAll('.view-image').forEach(btn => {
    btn.addEventListener('click', () => viewReportImage(btn.dataset.url));
  });
}

async function updateStatus(id, status) {
  if (!status) return;
  await supabase.from('reports').update({ status, updated_at: new Date() }).eq('id', id);
  loadAdminData();
  if (typeof loadSuaraData === 'function' && document.getElementById('suaraList')) loadSuaraData();
}

async function deleteReport(id) {
  if (confirm('Hapus laporan ini?')) {
    await supabase.from('reports').delete().eq('id', id);
    loadAdminData();
    if (typeof loadSuaraData === 'function' && document.getElementById('suaraList')) loadSuaraData();
  }
}

function viewReportImage(imageUrl) {
  if (!imageUrl) return alert('Gambar tidak tersedia.');
  window.open(imageUrl, '_blank');
}

// ================= RINGKASAN =================
function loadRingkasan() {
  document.getElementById('mainContent').innerHTML = `
    <h1>Ringkasan</h1>
    <div class="chart-grid">
      <div class="chart-container"><canvas id="chartJenis"></canvas></div>
      <div class="chart-container"><canvas id="chartKategori"></canvas></div>
      <div class="chart-container"><canvas id="chartStatus"></canvas></div>
      <div class="export-card">
        <h3>Ekspor Data</h3>
        <p>Unduh laporan sebagai file Excel dengan filter berikut:</p>
        <div style="display:flex; flex-direction:column; gap:8px; margin: 12px 0;">
          <select id="exportYear">
            <option value="">Semua Tahun</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
            <option value="2028">2028</option>
            <option value="2029">2029</option>
            <option value="2030">2030</option>
          </select>
          <select id="exportMonth">
            <option value="">Semua Bulan</option>
            <option value="01">Januari</option>
            <option value="02">Februari</option>
            <option value="03">Maret</option>
            <option value="04">April</option>
            <option value="05">Mei</option>
            <option value="06">Juni</option>
            <option value="07">Juli</option>
            <option value="08">Agustus</option>
            <option value="09">September</option>
            <option value="10">Oktober</option>
            <option value="11">November</option>
            <option value="12">Desember</option>
          </select>
          <select id="exportStatus">
            <option value="">Semua Status</option>
            <option value="menunggu">Menunggu</option>
            <option value="ditindaklanjuti">Ditindaklanjuti</option>
            <option value="selesai">Selesai</option>
          </select>
        </div>
        <button onclick="exportReportsToExcel()">Ekspor ke Excel</button>
      </div>
    </div>
  `;
  if (chartKategori) chartKategori.destroy();
  if (chartStatus) chartStatus.destroy();
  if (chartJenis) chartJenis.destroy();
  supabase.from('reports').select('type').then(({ data }) => {
    const counts = {};
    data?.forEach(r => counts[r.type] = (counts[r.type] || 0)+1);
    const ctx = document.getElementById('chartJenis').getContext('2d');
    chartJenis = new Chart(ctx, {
      type: 'bar',
      data: { labels: Object.keys(counts), datasets: [{ label: 'Jumlah', data: Object.values(counts), backgroundColor: '#6C5CE7' }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  });
  supabase.from('reports').select('category').then(({ data }) => {
    const counts = {};
    data?.forEach(r => counts[r.category] = (counts[r.category] || 0)+1);
    const ctx = document.getElementById('chartKategori').getContext('2d');
    chartKategori = new Chart(ctx, {
      type: 'bar',
      data: { labels: Object.keys(counts), datasets: [{ label: 'Jumlah', data: Object.values(counts), backgroundColor: '#F4A261' }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  });
  supabase.from('reports').select('status').then(({ data }) => {
    const counts = { menunggu:0, ditindaklanjuti:0, selesai:0 };
    data?.forEach(r => counts[r.status]++);
    const ctx = document.getElementById('chartStatus').getContext('2d');
    chartStatus = new Chart(ctx, {
      type: 'pie',
      data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: ['#95A5A6','#F4A261','#2ECC71'] }] },
      options: { plugins: { legend: { position: 'bottom' } } }
    });
  });
}

async function exportReportsToExcel() {
  const year = document.getElementById('exportYear')?.value;
  const month = document.getElementById('exportMonth')?.value;
  const status = document.getElementById('exportStatus')?.value;

  let query = supabase
    .from('reports')
    .select('id, user_id, type, category, target, title, description, image_url, status, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (month && !year) {
    return alert('Silakan pilih Tahun terlebih dahulu untuk memfilter berdasarkan Bulan.');
  }

  if (year) {
    if (month) {
      // Filter untuk bulan spesifik di tahun tersebut
      const lastDay = new Date(year, month, 0).getDate();
      query = query.gte('created_at', `${year}-${month}-01`).lte('created_at', `${year}-${month}-${lastDay}T23:59:59`);
    } else {
      // Filter satu tahun penuh
      query = query.gte('created_at', `${year}-01-01`).lte('created_at', `${year}-12-31T23:59:59`);
    }
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) return alert('Gagal ekspor: ' + error.message);

  if (!data || data.length === 0) {
    return alert('Tidak ada data laporan untuk periode dan status yang dipilih.');
  }

  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  
  const headers = ['ID', 'User ID', 'Jenis', 'Kategori', 'Target Kritik', 'Judul', 'Deskripsi', 'Image URL', 'Status', 'Tanggal Dibuat', 'Tahun', 'Bulan', 'Tanggal Diupdate'];
  const rows = data.map(r => {
    const d = new Date(r.created_at);
    return [
      r.id, 
      r.user_id, 
      r.type, 
      r.category, 
      r.target || '',
      r.title, 
      r.description, 
      r.image_url || '', 
      r.status, 
      r.created_at,
      d.getFullYear(),
      monthNames[d.getMonth()],
      r.updated_at || ''
    ];
  });

  const sanitize = (value) => {
    if (value == null) return '';
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br/>');
  };
  const htmlRows = rows.map(row => `<tr>${row.map(cell => `<td>${sanitize(cell)}</td>`).join('')}</tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:8px;text-align:left}th{background:#f2f2f2}td{vertical-align:top}</style></head><body><table><thead><tr>${headers.map(h => `<th>${sanitize(h)}</th>`).join('')}</tr></thead><tbody>${htmlRows}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'laporan_bersuara.xls');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ================= TENTANG ADMIN =================
async function loadTentangAdmin() {
  document.getElementById('mainContent').innerHTML = `
    <h1>Tentang & Bantuan</h1>
    <div class="card">
      <div class="about-content">
        <h3 class="no-border">Bersuara Yuk!</h3>
        <p>Bersuara Yuk! adalah platform digital yang dirancang khusus untuk menjembatani aspirasi siswa dengan pihak pengelola sekolah (OSIS dan guru). Aplikasi ini hadir sebagai solusi atas minimnya saluran resmi yang mudah, terstruktur, dan transparan bagi siswa untuk menyampaikan kritik, saran, serta keluhan terkait fasilitas sekolah.</p>
        <h4>Mengapa Bersuara Yuk?</h4>
        <p>Seringkali siswa menemukan masalah seperti kelas yang kotor, proyektor rusak, toilet yang bau, atau keramik pecah, namun tidak tahu harus melapor ke mana. Kotak saran konvensional seringkali tidak efektif karena tidak ada kejelasan tindak lanjut. Bersuara Yuk hadir untuk mengubah kebiasaan tersebut. Kini, setiap suara siswa tercatat, bisa dipantau bersama, dan ditindaklanjuti secara terbuka oleh pihak sekolah.</p>
      </div>
    </div>
    <div class="card">
      <h3 class="no-border">Kontak Bantuan</h3>
      <div class="contact-links">
        <a href="https://wa.me/6281234567890" target="_blank" class="wa">WhatsApp</a>
        <a href="https://instagram.com/bersuarayuk" target="_blank" class="ig">Instagram</a>
        <a href="mailto:bersuarayuk@smkni.sch.id" class="email">Email</a>
      </div>
    </div>
  `;
}