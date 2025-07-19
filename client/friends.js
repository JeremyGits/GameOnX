// friends.js - Logic for friends list
function initFriends() {
  // Fetch friends from backend API
  fetch("http://localhost:3000/friends", { method: "GET" }) // Assume new API endpoint
    .then(res => res.json())
    .then(friends => {
      const list = document.getElementById("friends-list");
      list.innerHTML = friends.map(f => `<li>${f.username} - Online: ${f.online}</li>`).join("");
    });

  document.getElementById("send-request").addEventListener("click", () => {
    const username = document.getElementById("add-friend").value;
    fetch("http://localhost:3000/add-friend", { method: "POST", body: JSON.stringify({ username }) });
  });
}

function loadFriendsView() {
  fetch("views/friends.html")
    .then(response => response.text())
    .then(html => {
      document.querySelector("aside").innerHTML = html; // Or main, depending on layout
      initFriends();
    });
}

module.exports = { loadFriendsView };
