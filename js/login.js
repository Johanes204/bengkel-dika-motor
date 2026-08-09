// Ganti form yang tampil
function showForm(formId) {
    document.querySelectorAll('.form-box').forEach(f => f.classList.remove('active'));
    document.getElementById(formId).classList.add('active');
}

// Tampilkan pesan sukses/error di dalam form
function showMessage(elId, text, type) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = text;
    el.className = 'msg show ' + type;
    if (type === 'success') {
        setTimeout(() => el.classList.remove('show'), 3000);
    }
}

// Tombol lihat/sembunyikan password
document.querySelectorAll('.toggle-pwd').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
    });
});

// Setelah DOM siap, cek status login (untuk menampilkan form yang benar)
document.addEventListener('DOMContentLoaded', function () {
    if (localStorage.getItem('isLoggedIn') === 'true') {
        showForm('login-form');
    }
});

// === REGISTER ADMIN ===
document.getElementById('registerForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const btn = document.getElementById('registerBtn');
    const formData = {
        username_admin: document.getElementById('reg_username_admin').value,
        email_admin: document.getElementById('reg_email_admin').value,
        password_admin: document.getElementById('reg_password_admin').value
    };

    btn.disabled = true;
    btn.textContent = 'Mendaftarkan...';

    try {
        const res = await fetch('http://localhost:3000/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await res.json();

        if (res.ok) {
            showMessage('registerMsg', '✅ ' + (data.message || 'Registrasi berhasil'), 'success');
            this.reset();
            setTimeout(() => showForm('login-form'), 900);
        } else {
            showMessage('registerMsg', '⚠️ ' + (data.message || 'Gagal register, coba lagi'), 'error');
        }
    } catch (err) {
        console.error('Register error:', err);
        showMessage('registerMsg', '⚠️ Gagal terhubung ke server. Pastikan server berjalan.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Register';
    }
});

// === LOGIN ADMIN ===
document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const btn = document.getElementById('loginBtn');
    const formData = {
        username_admin: document.getElementById('username_admin').value,
        password_admin: document.getElementById('password_admin').value
    };

    btn.disabled = true;
    btn.textContent = 'Memproses...';

    try {
        const res = await fetch('http://localhost:3000/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('isLoggedIn', true);
            localStorage.setItem('adminName', data.username_admin);

            showMessage('loginMsg', '✅ Login berhasil, mengalihkan...', 'success');
            setTimeout(() => {
                window.location.href = 'admin-janji-servis.html';
            }, 600);
        } else {
            showMessage('loginMsg', '⚠️ ' + (data.message || 'Username atau password salah'), 'error');
            btn.disabled = false;
            btn.textContent = 'Login';
        }
    } catch (err) {
        console.error('Login error:', err);
        showMessage('loginMsg', '⚠️ Gagal terhubung ke server. Pastikan server berjalan.', 'error');
        btn.disabled = false;
        btn.textContent = 'Login';
    }
});
