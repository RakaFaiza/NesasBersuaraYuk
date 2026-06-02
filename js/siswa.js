// js/siswa.js
window.suaraSubscription = null;
window.myReportsSubscription = null;

let myReportsPage = 1;
let suaraPage = 1;
const PAGE_SIZE = 6;

// Fungsi pembantu navigasi
window.changeMyReportsPage = (offset) => {
  myReportsPage += offset;
  loadMyReports();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.changeSuaraPage = (offset) => {
  suaraPage += offset;
  loadSuaraData();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

async function loadLaporanSiswa() {
  if (window.myReportsSubscription) {
    supabase.removeSubscription(window.myReportsSubscription);
    window.myReportsSubscription = null;
  }

  myReportsPage = 1;
  const html = `
    <h1>Laporan Saya</h1>
    <div class="card">
      <h3 class="no-border">Buat Laporan</h3>
      <form id="formLaporan">
        <input type="hidden" id="editingReportId" value="">
        <input type="hidden" id="existingImageUrl" value="">
        <select id="type" required><option value="">Jenis</option><option>kritik</option><option>saran</option><option>keluhan</option><option>pengaduan</option><option>lainnya</option></select>
        <select id="category" required><option value="">Kategori</option><option>fasilitas</option><option>kebersihan</option><option>sanitasi</option><option>struktur</option><option>lainnya</option></select>
        <input id="target" placeholder="Target Kritik (misal: Guru IPA, Kantin, OSIS)" style="display:none;">
        <input id="title" placeholder="Judul" required>
        <textarea id="desc" placeholder="Deskripsi" required></textarea>
        <input type="file" id="imgFile" accept="image/png,image/jpeg" style="display:none;">
        <label for="imgFile" class="file-button">Pilih Gambar</label>
        <span id="selectedFileName" style="display:block; margin-top:8px; color:#555; font-size:14px;"></span>
        <small style="display:block; margin-top:6px; color:#555;">Unggah file JPG/PNG. Biarkan kosong untuk mempertahankan gambar lama.</small>
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:12px;">
          <button type="submit" id="submitReportBtn">Kirim</button>
          <button type="button" id="cancelEditBtn" class="secondary" style="display:none;">Batal</button>
        </div>
      </form>
    </div>
    <h3>Daftar Laporan Saya</h3>
    <div id="myReports"></div>
  `;
  document.getElementById('mainContent').innerHTML = html;

  const form = document.getElementById('formLaporan');
  const submitBtn = document.getElementById('submitReportBtn');
  const cancelBtn = document.getElementById('cancelEditBtn');
  const typeSelect = document.getElementById('type');
  const categorySelect = document.getElementById('category');
  const targetInput = document.getElementById('target');

  const toggleTarget = () => {
    const isKritikLainnya = typeSelect.value === 'kritik' && categorySelect.value === 'lainnya';
    targetInput.style.display = isKritikLainnya ? 'block' : 'none';
    if (!isKritikLainnya) targetInput.value = '';
  };

  typeSelect.addEventListener('change', toggleTarget);
  categorySelect.addEventListener('change', toggleTarget);

  const resetForm = () => {
    form.reset();
    document.getElementById('editingReportId').value = '';
    document.getElementById('existingImageUrl').value = '';
    targetInput.style.display = 'none';
    document.getElementById('selectedFileName').textContent = '';
    submitBtn.textContent = 'Kirim';
    cancelBtn.style.display = 'none';
  };

  document.getElementById('imgFile').addEventListener('change', (event) => {
    const fileName = event.target.files[0]?.name || '';
    document.getElementById('selectedFileName').textContent = fileName;
  });

  cancelBtn.addEventListener('click', () => resetForm());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('type').value;
    const category = document.getElementById('category').value;
    const title = document.getElementById('title').value.trim();
    const target = document.getElementById('target').value.trim();
    const description = document.getElementById('desc').value.trim();
    if (!type || !category || !title || !description) {
      alert('Semua field harus diisi!');
      return;
    }

    const fileInput = document.getElementById('imgFile');
    const file = fileInput.files[0];
    let imageUrl = document.getElementById('existingImageUrl').value || null;

    if (file) {
      const fileExt = file.name.split('.').pop();
      const filePath = `report-images/${currentUser.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('report-images').upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
      if (uploadError) {
        alert('Gagal mengunggah gambar: ' + uploadError.message);
        return;
      }
      const { data: publicUrlData, error: urlError } = supabase.storage.from('report-images').getPublicUrl(filePath);
      if (urlError) {
        alert('Gagal mengambil URL gambar: ' + urlError.message);
        return;
      }
      imageUrl = publicUrlData.publicUrl;
    }

    const reportId = document.getElementById('editingReportId').value;
    const payload = {
      type,
      category,
      title,
      target: (type === 'kritik' && category === 'lainnya') ? target : null,
      description,
      image_url: imageUrl,
      updated_at: new Date()
    };

    if (reportId) {
      const { error } = await supabase.from('reports').update(payload).eq('id', reportId).eq('user_id', currentUser.id).eq('status', 'menunggu');
      if (error) alert('Gagal update: ' + error.message);
      else {
        alert('Laporan diperbarui!');
        resetForm();
        loadMyReports();
        if (typeof loadSuaraData === 'function' && document.getElementById('suaraList')) loadSuaraData();
      }
    } else {
      const insertPayload = {
        user_id: currentUser.id,
        type,
        category,
        target: (type === 'kritik' && category === 'lainnya') ? target : null,
        title,
        description,
        image_url: imageUrl
      };
      const { error } = await supabase.from('reports').insert(insertPayload);
      if (error) alert('Gagal: ' + error.message);
      else {
        alert('Laporan terkirim!');
        resetForm();
        myReportsPage = 1;
        loadMyReports();
        if (typeof loadSuaraData === 'function' && document.getElementById('suaraList')) loadSuaraData();
      }
    }
  });
  loadMyReports();

  window.myReportsSubscription = supabase
    .channel('my-reports')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, (payload) => {
      if (payload.new && payload.new.user_id === currentUser.id) loadMyReports();
      else if (payload.old && payload.old.user_id === currentUser.id) loadMyReports();
    })
    .subscribe();
}

async function loadMyReports() {
  const start = (myReportsPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE - 1;

  const { data, count } = await supabase
    .from('reports')
    .select('*', { count: 'exact' })
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .range(start, end);

  const container = document.getElementById('myReports');
  if (!data?.length) { container.innerHTML = '<p>Belum ada laporan.</p>'; return; }

  const reportsHtml = data.map(r => {
    let viewButtonHtml = '';
    let editButtonHtml = '';
    
    if (r.image_url) {
      viewButtonHtml = `<button class="view-image-btn" data-url="${escapeHtml(r.image_url)}">🖼️ Lihat Gambar</button>`;
    }
    
    if (r.status === 'menunggu') {
      editButtonHtml = `<button onclick="editLaporan(${r.id})" class="secondary">✏️ Edit</button>`;
    }
    
    // Baris tombol (Lihat Gambar dan Edit) selalu di atas
    const actionButtons = (viewButtonHtml || editButtonHtml) ? `
      <div style="display: flex; gap: 12px; align-items: center; margin-top: 10px; flex-wrap: wrap;">
        ${viewButtonHtml}
        ${editButtonHtml}
      </div>
    ` : '';
    
    const targetHtml = r.target ? `<p style="font-size:12px; color:var(--accent); margin-bottom:4px;">🎯 Target: ${escapeHtml(r.target)}</p>` : '';

    return `
      <div class="card">
        <div style="display:flex; justify-content:space-between;">
          <strong>${escapeHtml(r.title)}</strong>
          <span class="badge ${r.status}">${r.status}</span>
        </div>
        <p style="font-size:12px; color:#666;">${r.type} | ${r.category} | ${new Date(r.created_at).toLocaleDateString()}</p>
        ${targetHtml}
        <p>${escapeHtml(r.description)}</p>
        ${actionButtons}
      </div>
    `;
  }).join('');

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);
  const paginationHtml = count > PAGE_SIZE ? `
    <div class="pagination">
      <button onclick="changeMyReportsPage(-1)" ${myReportsPage === 1 ? 'disabled' : ''}>← Sebelumnya</button>
      <span>Halaman ${myReportsPage} / ${totalPages}</span>
      <button onclick="changeMyReportsPage(1)" ${myReportsPage === totalPages ? 'disabled' : ''}>Berikutnya →</button>
    </div>
  ` : '';

  container.innerHTML = reportsHtml + paginationHtml;

  // Event listener untuk tombol "Lihat Gambar" (Buka di tab baru)
  document.querySelectorAll('.view-image-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      if (url) window.open(url, '_blank');
    });
  });
}

async function editLaporan(id) {
  const { data: r, error: fetchError } = await supabase.from('reports').select('*').eq('id', id).single();
  if (fetchError || !r) return alert('Laporan tidak ditemukan');
  if (r.status !== 'menunggu') return alert('Laporan hanya bisa diedit ketika status masih menunggu.');

  document.getElementById('editingReportId').value = r.id;
  document.getElementById('type').value = r.type;
  document.getElementById('category').value = r.category;
  document.getElementById('target').value = r.target || '';
  document.getElementById('target').style.display = (r.type === 'kritik' && r.category === 'lainnya') ? 'block' : 'none';
  document.getElementById('title').value = r.title;
  document.getElementById('desc').value = r.description;
  document.getElementById('existingImageUrl').value = r.image_url || '';
  document.getElementById('imgFile').value = '';
  document.getElementById('submitReportBtn').textContent = 'Simpan Perubahan';
  document.getElementById('cancelEditBtn').style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadSuara() {
  if (window.suaraSubscription) {
    supabase.removeSubscription(window.suaraSubscription);
    window.suaraSubscription = null;
  }

  suaraPage = 1;
  document.getElementById('mainContent').innerHTML = `
    <h1>Dinding Suara</h1>
    <div class="filter-bar">
      <select id="fType"><option value="">Semua Jenis</option><option>kritik</option><option>saran</option><option>keluhan</option><option>pengaduan</option><option>lainnya</option></select>
      <select id="fCat"><option value="">Semua Kategori</option><option>fasilitas</option><option>kebersihan</option><option>sanitasi</option><option>struktur</option><option>lainnya</option></select>
      <select id="fStatus"><option value="">Semua Status</option><option>menunggu</option><option>ditindaklanjuti</option><option>selesai</option></select>
      <input id="fSearch" type="text" placeholder="Cari judul laporan...">
    </div>
    <div id="suaraList"></div>
  `;

  const resetAndLoad = () => { suaraPage = 1; loadSuaraData(); };
  document.getElementById('fType').onchange = resetAndLoad;
  document.getElementById('fCat').onchange = resetAndLoad;
  document.getElementById('fStatus').onchange = resetAndLoad;
  document.getElementById('fSearch').oninput = resetAndLoad;

  window.suaraSubscription = supabase
    .channel('realtime-suara')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
      loadSuaraData();
    })
    .subscribe();

  loadSuaraData();
}

async function loadSuaraData() {
  // PENTING: cek apakah elemen masih ada di DOM, jika tidak, hentikan eksekusi
  if (!document.getElementById('fType')) return;

  const start = (suaraPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE - 1;

  let query = supabase.from('reports').select('*, profiles(nama, kelas)', { count: 'exact' }).order('created_at', { ascending: false });
  
  const type = document.getElementById('fType')?.value;
  const cat = document.getElementById('fCat')?.value;
  const status = document.getElementById('fStatus')?.value;
  const search = document.getElementById('fSearch')?.value.trim();

  if (type) query = query.eq('type', type);
  if (cat) query = query.eq('category', cat);
  if (status) query = query.eq('status', status);
  if (search) query = query.ilike('title', `%${search}%`);

  const { data, count } = await query.range(start, end);

  const reportsHtml = data?.length ? data.map(r => {
    const infoLine = userRole === 'admin'
      ? `${r.type} | ${r.category} | ${escapeHtml(r.profiles?.nama || 'Anonim')} (${escapeHtml(r.profiles?.kelas || '-')})`
      : `${r.type} | ${r.category}`;
    
    const targetHtml = r.target ? `<p style="font-size:12px; color:var(--accent); margin-bottom:4px;">🎯 Target: ${escapeHtml(r.target)}</p>` : '';

    return `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
        <strong>${escapeHtml(r.title)}</strong>
      </div>
      <div style="display:flex; justify-content:flex-start; margin:8px 0 8px; gap:10px; flex-wrap:wrap;">
        <span class="badge ${r.status}">${r.status}</span>
      </div>
      <p style="font-size:12px; color:#666; margin-bottom:8px;">${infoLine}</p>
      ${targetHtml}
      <p>${escapeHtml(r.description)}</p>
    </div>
  `;
  }).join('') : '<p>Tidak ada laporan.</p>';

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);
  const paginationHtml = count > PAGE_SIZE ? `
    <div class="pagination">
      <button onclick="changeSuaraPage(-1)" ${suaraPage === 1 ? 'disabled' : ''}>← Sebelumnya</button>
      <span>Halaman ${suaraPage} / ${totalPages}</span>
      <button onclick="changeSuaraPage(1)" ${suaraPage === totalPages ? 'disabled' : ''}>Berikutnya →</button>
    </div>
  ` : '';

  const suaraList = document.getElementById('suaraList');
  if (suaraList) suaraList.innerHTML = `<div class="reports-grid">${reportsHtml}</div>${paginationHtml}`;
}

async function loadTentangSiswa() {
  document.getElementById('mainContent').innerHTML = `
    <h1>Tentang & Bantuan</h1>
    <div class="card">
      <div class="about-content">
        <h3 class="no-border">Bersuara Yuk!</h3>
        <p>Bersuara Yuk! adalah platform digital yang dirancang khusus untuk menjembatani aspirasi siswa dengan pihak pengelola sekolah (OSIS dan guru). Aplikasi ini hadir sebagai solusi atas minimnya saluran resmi yang mudah, terstruktur, dan transparan bagi siswa untuk menyampaikan kritik, saran, serta keluhan terkait fasilitas sekolah.</p>
        <h4 class="no-border">Mengapa Bersuara Yuk?</h4>
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