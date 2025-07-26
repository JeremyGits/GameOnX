// renderer_login.js (updated with delete button and IPC, added logging)
document.addEventListener('DOMContentLoaded', () => {
  console.log('renderer_login loaded');
  window.electronAPI.onUserProfiles((users) => {
    console.log('User profiles received:', users);
    const profilesList = document.getElementById("profiles-list");
    if (users.length === 0) {
      profilesList.innerHTML = '<li>No accounts added yet.</li>';
    } else {
      profilesList.innerHTML = users.map(u => `
        <li>
          <img src="${u.pfp || 'default-pfp.png'}" alt="PFP" width="50" height="50" />
          <span>${u.screen_name}</span>
          <button onclick="selectUser('${u.id_str}')">Select</button>
          <button onclick="deleteUser('${u.id_str}')">Delete</button>
        </li>
      `).join('');
    }
  });

  document.getElementById("add-account").addEventListener("click", () => {
    console.log('Add account button clicked');
    window.electronAPI.loginX();
  });
});

function selectUser(id) {
  console.log('Select user:', id);
  window.electronAPI.selectUser(id);
}

function deleteUser(id) {
  console.log('Delete user:', id);
  if (confirm("Delete this profile?")) {
    window.electronAPI.deleteUser(id);
  }
}