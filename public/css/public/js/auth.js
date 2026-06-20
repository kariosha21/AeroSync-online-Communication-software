document.addEventListener('DOMContentLoaded', () => {
  const authView = document.getElementById('auth-view');
  const dashboardView = document.getElementById('dashboard-view');
  
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const authSubtitle = document.getElementById('auth-subtitle');
  const authToggleText = document.getElementById('auth-toggle-text');
  const authToggleLink = document.getElementById('auth-toggle-link');
  
  const userAvatar = document.getElementById('user-avatar');
  const userDisplayName = document.getElementById('user-display-name');
  const btnLogout = document.getElementById('btn-logout');
  
  const createRoomForm = document.getElementById('create-room-form');
  const joinRoomForm = document.getElementById('join-room-form');
  
  const toast = document.getElementById('toast');
  const toastIcon = document.getElementById('toast-icon');
  const toastMessage = document.getElementById('toast-message');

  let isLogin = true;
  authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLogin = !isLogin;
    
    if (isLogin) {
      loginForm.style.display = 'block';
      signupForm.style.display = 'none';
      authSubtitle.innerText = 'Secure, Real-Time Collaboration & E2EE Calling';
      authToggleText.innerText = "Don't have an account? ";
      authToggleLink.innerText = 'Sign Up';
    } else {
      loginForm.style.display = 'none';
      signupForm.style.display = 'block';
      authSubtitle.innerText = 'Create a free account to start calling securely';
      authToggleText.innerText = 'Already have an account? ';
      authToggleLink.innerText = 'Sign In';
    }
  });

  function showToast(message, isSuccess = true) {
    toastMessage.innerText = message;
    if (isSuccess) {
      toast.style.borderColor = 'var(--accent-teal)';
      toast.style.boxShadow = 'var(--shadow-neon-teal)';
      toastIcon.className = 'fa-solid fa-circle-check';
      toastIcon.style.color = 'var(--accent-teal)';
    } else {
      toast.style.borderColor = 'var(--accent-red)';
      toast.style.boxShadow = '0 0 15px rgba(230, 57, 70, 0.4)';
      toastIcon.className = 'fa-solid fa-circle-exclamation';
      toastIcon.style.color = 'var(--accent-red)';
    }
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }

  async function checkAuth() {
    const token = localStorage.getItem('token');
    const savedUsername = localStorage.getItem('username');

    if (!token) {
      showAuthScreen();
      return;
    }

    try {
      const response = await fetch('/api/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const profile = await response.json();
        showDashboardScreen(profile.username);
      } else {
        logout();
      }
    } catch (err) {
      console.error('Network error during auth check:', err);
      if (savedUsername) {
        showDashboardScreen(savedUsername);
      } else {
        showAuthScreen();
      }
    }
  }

  function showAuthScreen() {
    authView.style.display = 'flex';
    dashboardView.style.display = 'none';
  }

  function showDashboardScreen(username) {
    authView.style.display = 'none';
    dashboardView.style.display = 'flex';
    userDisplayName.innerText = username;
    userAvatar.innerText = username.charAt(0).toUpperCase();
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    showAuthScreen();
    showToast('Logged out successfully');
  }

  btnLogout.addEventListener('click', logout);

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        showDashboardScreen(data.username);
        showToast(`Welcome back, ${data.username}!`);
      } else {
        showToast(data.error || 'Login failed', false);
      }
    } catch (err) {
      showToast('Connection error. Please try again.', false);
    }
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Registration successful! Please sign in.');
        authToggleLink.click();
        document.getElementById('login-email').value = email;
        document.getElementById('login-password').value = '';
      } else {
        showToast(data.error || 'Registration failed', false);
      }
    } catch (err) {
