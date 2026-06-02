// js/dashboard.js
let currentUser = null;
let userProfile = null;
let userRole = null;
window.bannerInterval = null;

// Bersihkan semua subscription realtime
function cleanupSubscriptions() {
  const removeChannel = (channelOrSubscription) => {
    if (!channelOrSubscription) return;
    try {
      if (typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channelOrSubscription);
      } else if (typeof supabase.removeSubscription === 'function') {
        supabase.removeSubscription(channelOrSubscription);
      } else if (typeof channelOrSubscription.unsubscribe === 'function') {
        channelOrSubscription.unsubscribe();
      }
    } catch (err) {
      console.warn('Gagal membersihkan channel Supabase:', err);
    }
  };

  if (window.suaraSubscription) {
    removeChannel(window.suaraSubscription);
    window.suaraSubscription = null;
  }
  if (window.myReportsSubscription) {
    removeChannel(window.myReportsSubscription);
    window.myReportsSubscription = null;
  }
  if (window.adminReportsSubscription) {
    removeChannel(window.adminReportsSubscription);
    window.adminReportsSubscription = null;
  }
  if (window.userSubscription) {
    removeChannel(window.userSubscription);
    window.userSubscription = null;
  }
  if (window.bannerInterval) {
    clearInterval(window.bannerInterval);
    window.bannerInterval = null;
  }
}

async function initDashboard() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = session.user;
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .maybeSingle();
  if (error || !profile) {
    const meta = currentUser.user_metadata || {};
    userProfile = {
      id: currentUser.id,
      nisn: meta.nisn || '-',
      nama: meta.nama || currentUser.email,
      kelas: meta.kelas || '-',
      role: meta.role || 'student'
    };
  } else {
    userProfile = profile;
  }
  userRole = userProfile.role;
  if (userRole === 'admin') {
    document.getElementById('menuAdminReports').style.display = 'block';
    document.getElementById('menuUserManagement').style.display = 'block';
  }

  // Mobile menu toggle
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  function closeMenu() {
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  }
  function openMenu() {
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('active');
  }
  if (menuToggle && sidebar && overlay) {
    menuToggle.addEventListener('click', openMenu);
    overlay.addEventListener('click', closeMenu);
    document.querySelectorAll('.sidebar nav a').forEach(link => {
      link.addEventListener('click', closeMenu);
    });
  }

  // Navigasi
  document.querySelectorAll('.sidebar nav a[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar nav a').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      loadPage(link.dataset.page);
      closeMenu();
    });
  });

  loadPage('beranda');
}

function loadPage(page) {
  cleanupSubscriptions(); // matikan semua subscription sebelum pindah halaman
  switch (page) {
    case 'beranda': loadBeranda(); break;
    case 'laporan':
      userRole === 'admin' ? loadLaporanAdmin() : loadLaporanSiswa();
      break;
    case 'suara': loadSuara(); break;
    case 'profil': loadProfil(); break;
    case 'ringkasan':
      if (userRole === 'admin') loadRingkasan();
      else loadBeranda();
      break;
    case 'manajemen':
      if (userRole === 'admin') loadUserManagement();
      else loadBeranda();
      break;
    case 'tentang':
      userRole === 'admin' ? loadTentangAdmin() : loadTentangSiswa();
      break;
    default: loadBeranda(); break;
  }
}

function loadBeranda() {
  document.getElementById('mainContent').innerHTML = `
    <div class="poster-container">
      <div class="banner-wrapper" id="bannerWrapper">
        <img src="assets/banner.png" alt="Banner 1">
        <img src="assets/banner2.png" alt="Banner 2">
        <img src="assets/banner3.png" alt="Banner 3">
      </div>
      <div class="banner-dots" id="bannerDots">
        <span class="dot active" data-index="0"></span>
        <span class="dot" data-index="1"></span>
        <span class="dot" data-index="2"></span>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><h3 id="totalReports">-</h3><p>Total Laporan</p></div>
      <div class="stat-card"><h3 id="totalSelesai">-</h3><p>Selesai</p></div>
      <div class="stat-card"><h3 id="totalDitindaklanjuti">-</h3><p>Ditindaklanjuti</p></div>
      <div class="stat-card"><h3 id="totalMenunggu">-</h3><p>Menunggu</p></div>
    </div>
  `;

  const wrapper = document.getElementById('bannerWrapper');
  const dots = document.querySelectorAll('.dot');
  let currentIndex = 0;
  const total = 3;

  function updateBanner(index) {
    currentIndex = index;
    wrapper.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
  }

  function startAutoSlide() {
    if (window.bannerInterval) clearInterval(window.bannerInterval);
    window.bannerInterval = setInterval(() => {
      currentIndex = (currentIndex + 1) % total;
      updateBanner(currentIndex);
    }, 5000);
  }

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const index = parseInt(dot.dataset.index);
      updateBanner(index);
      // Mulai ulang timer agar tidak langsung berpindah setelah diklik
      startAutoSlide();
    });
  });

  startAutoSlide();
  loadQuickStats();
}

async function loadQuickStats() {
  const { data: all } = await supabase.from('reports').select('status', { count: 'exact' });
  const selesai = all?.filter(r => r.status === 'selesai').length || 0;
  const ditindaklanjuti = all?.filter(r => r.status === 'ditindaklanjuti').length || 0;
  const menunggu = all?.filter(r => r.status === 'menunggu').length || 0;
  document.getElementById('totalReports').textContent = all?.length || 0;
  document.getElementById('totalSelesai').textContent = selesai;
  document.getElementById('totalDitindaklanjuti').textContent = ditindaklanjuti;
  document.getElementById('totalMenunggu').textContent = menunggu;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function logoutUser() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

initDashboard();