// Session management
let currentUser = null;
let userNotes = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Check if user is already logged in (from session storage)
  const savedUser = sessionStorage.getItem('currentUser');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    loadDashboard();
  }
});

// Show feedback message
function showFeedback(elementId, message, isSuccess = true) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.className = `feedback ${isSuccess ? 'success' : 'error'}`;
  element.style.display = 'block';
  
  // Auto-hide after 4 seconds
  setTimeout(() => {
    element.style.display = 'none';
  }, 4000);
}

// REGISTER
async function register() {
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;

  if (!username || !password) {
    showFeedback('feedback-register', '❌ Please fill in all fields', false);
    return;
  }

  if (password.length < 6) {
    showFeedback('feedback-register', '❌ Password must be at least 6 characters', false);
    return;
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.success) {
      showFeedback('feedback-register', '✅ Account created! You can now login.', true);
      document.getElementById('reg-username').value = '';
      document.getElementById('reg-password').value = '';
    } else {
      showFeedback('feedback-register', `❌ ${data.error || 'Registration failed'}`, false);
    }
  } catch (err) {
    showFeedback('feedback-register', `❌ Error: ${err.message}`, false);
  }
}

// LOGIN
async function login() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  if (!username || !password) {
    showFeedback('feedback-login', '❌ Please fill in all fields', false);
    return;
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.success) {
      // Save to session
      currentUser = { username, loginTime: new Date().toLocaleString() };
      sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
      
      // Clear form
      document.getElementById('login-username').value = '';
      document.getElementById('login-password').value = '';
      
      // Load dashboard
      loadDashboard();
    } else {
      showFeedback('feedback-login', `❌ ${data.error || 'Login failed'}`, false);
    }
  } catch (err) {
    showFeedback('feedback-login', `❌ Error: ${err.message}`, false);
  }
}

// LOGOUT
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    currentUser = null;
    userNotes = [];
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('userNotes_' + (currentUser?.username || 'guest'));
    
    // Show auth section, hide dashboard
    document.getElementById('auth-section').style.display = 'flex';
    document.getElementById('dashboard-section').style.display = 'none';
    
    showFeedback('feedback-dashboard', '👋 You have been logged out', true);
  }
}

// LOAD DASHBOARD
async function loadDashboard() {
  // Hide auth, show dashboard
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('dashboard-section').style.display = 'block';

  // Set user info
  document.getElementById('current-username').textContent = currentUser.username;
  document.getElementById('user-avatar').textContent = currentUser.username[0].toUpperCase();

  // Load users and notes
  await refreshDashboard();
}

// REFRESH DASHBOARD
async function refreshDashboard() {
  await loadUsers();
  loadNotes();
}

// GET USERS
async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    const users = await res.json();

    const usersGrid = document.getElementById('users-grid');
    usersGrid.innerHTML = '';

    if (users.length === 0) {
      usersGrid.innerHTML = '<p style="color: #999; text-align: center;">No users yet</p>';
    } else {
      users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        const date = new Date(user.created_at).toLocaleDateString();
        userItem.innerHTML = `
          <div>
            <strong>${user.username}</strong>
            <br>
            <small>Joined: ${date}</small>
          </div>
          ${user.username === currentUser.username ? '<span style="color: #667eea; font-weight: 600;">👤 You</span>' : ''}
        `;
        usersGrid.appendChild(userItem);
      });
    }

    // Update stats
    document.getElementById('total-users').textContent = users.length;
  } catch (err) {
    console.error('Error loading users:', err);
    document.getElementById('users-grid').innerHTML = `<p style="color: #999; text-align: center;">Failed to load users</p>`;
  }
}

// ADD NOTE
function addNote() {
  const noteInput = document.getElementById('note-input');
  const content = noteInput.value.trim();

  if (!content) {
    showFeedback('feedback-dashboard', '❌ Please write a note', false);
    return;
  }

  // Create note object
  const note = {
    id: Date.now(),
    content: content,
    timestamp: new Date().toLocaleString()
  };

  // Add to array
  userNotes.push(note);

  // Save to localStorage (per user)
  localStorage.setItem('userNotes_' + currentUser.username, JSON.stringify(userNotes));

  // Clear input
  noteInput.value = '';

  // Refresh display
  loadNotes();
  showFeedback('feedback-dashboard', '✅ Note saved!', true);
}

// LOAD NOTES
function loadNotes() {
  // Load from localStorage
  const saved = localStorage.getItem('userNotes_' + currentUser.username);
  userNotes = saved ? JSON.parse(saved) : [];

  const notesGrid = document.getElementById('notes-grid');
  notesGrid.innerHTML = '';

  if (userNotes.length === 0) {
    notesGrid.innerHTML = '<p style="color: #999; text-align: center;">No notes yet. Create one!</p>';
  } else {
    userNotes.forEach(note => {
      const noteItem = document.createElement('div');
      noteItem.className = 'note-item';
      noteItem.innerHTML = `
        <p>${note.content}</p>
        <small>${note.timestamp}</small>
        <br>
        <button class="btn btn-secondary" style="margin-top: 10px; padding: 6px 12px; font-size: 12px;" onclick="deleteNote(${note.id})">Delete</button>
      `;
      notesGrid.appendChild(noteItem);
    });
  }

  // Update stats
  document.getElementById('your-notes').textContent = userNotes.length;
}

// DELETE NOTE
function deleteNote(noteId) {
  if (confirm('Delete this note?')) {
    userNotes = userNotes.filter(n => n.id !== noteId);
    localStorage.setItem('userNotes_' + currentUser.username, JSON.stringify(userNotes));
    loadNotes();
    showFeedback('feedback-dashboard', '✅ Note deleted', true);
  }
}
