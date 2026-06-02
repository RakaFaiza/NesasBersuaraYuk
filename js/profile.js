function loadProfil() {
  document.getElementById('mainContent').innerHTML = `
    <h1>Profil</h1>
    <div class="profile-info">
      <strong>NISN:</strong> <span>${escapeHtml(userProfile.nisn)}</span>
      <strong>Nama:</strong> <span>${escapeHtml(userProfile.nama)}</span>
      <strong>Kelas:</strong> <span>${escapeHtml(userProfile.kelas)}</span>
      <strong>Email:</strong> <span>${currentUser.email}</span>
      <strong>Role:</strong> <span>${userRole === 'admin' ? 'Admin' : 'Siswa'}</span>
    </div>
    <div class="card">
      <h3 class="no-border">Ganti Password</h3>
      <form id="changePass">
        <input type="password" id="newPass" placeholder="Password baru" required>
        <input type="password" id="confPass" placeholder="Konfirmasi" required>
        <button type="submit">Simpan</button>
      </form>
    </div>
    <button id="logoutBtn" class="danger" style="width:100%"> Logout</button>
  `;
  
  // Event listener untuk ganti password
  document.getElementById('changePass').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = document.getElementById('newPass').value;
    const p2 = document.getElementById('confPass').value;
    if (p1 !== p2) { alert('Password tidak cocok'); return; }
    const { error } = await supabase.auth.updateUser({ password: p1 });
    alert(error ? 'Gagal: '+error.message : 'Password berhasil diubah!');
  });
  
  document.getElementById('logoutBtn').onclick = () => logoutUser();
}