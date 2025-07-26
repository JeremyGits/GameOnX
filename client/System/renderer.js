// renderer.js (updated fetches to use relative paths from Assets/views; e.g., fetch("lobby.html") since views are in same dir as index.html; added art path checks for themes)
document.addEventListener('DOMContentLoaded', () => {
  console.log('Renderer loaded - starting lobby init');

  // Load lobby dynamically (relative to current HTML in Assets/views)
  fetch("lobby.html") // Changed from "views/lobby.html" assuming fetch from index.html in same dir
    .then(response => response.text())
    .then(html => {
      console.log('Lobby HTML fetched successfully');
      document.querySelector("main").innerHTML = html;
      initLobby(); // New function for lobby-specific logic
    })
    .catch(err => {
      console.error("Lobby load error:", err);
    });

  function initLobby() {
    console.log('initLobby started');

    // Listen for scanned-games via exposed API
    window.electronAPI.onScannedGames((games) => {
      console.log('Scanned games received:', games);
      const gamesList = document.getElementById("games-list");
      if (gamesList) {
        gamesList.innerHTML = games.map(g => `<li>${g}</li>`).join("");
      } else {
        console.error('games-list element not found');
      }
    });

    // Display user/PFP from store (currentUser)
    (async () => {
      const user = await window.electronAPI.getFromStore("currentUser");
      console.log("User from store:", user);
      if (user) {
        const usernameEl = document.getElementById("username");
        const pfpEl = document.getElementById("user-pfp");
        if (usernameEl && pfpEl) {
          usernameEl.innerText = `@${user.screen_name}`;
          pfpEl.src = user.pfp || '';
        } else {
          console.error('User info elements not found');
        }
      }
    })();

    // Rooms logic
    const createRoomBtn = document.getElementById("create-room");
    if (createRoomBtn) {
      createRoomBtn.addEventListener("click", () => {
        console.log('Create room button clicked');
        const roomName = prompt("Enter room name:");
        if (roomName) {
          window.socket.emit("create-room", { name: roomName });
          fetch("rooms.html") // Relative fetch from views dir
            .then(response => response.text())
            .then(html => {
              console.log('Rooms HTML fetched');
              document.querySelector("main").innerHTML = html;
              document.getElementById("room-name").textContent = roomName;
              window.socket.on("room-update", (data) => {
                console.log('Room update received:', data);
                const playersList = document.getElementById("room-players");
                if (playersList) {
                  playersList.innerHTML = data.players.map(p => `<li>${p}</li>`).join("");
                } else {
                  console.error('room-players element not found');
                }
              });
            }).catch(err => console.error("Rooms load error:", err));
        }
      });
    } else {
      console.error('create-room button not found');
    }

    // Friends logic
    const friendsBtn = document.getElementById("friends-button");
    if (friendsBtn) {
      friendsBtn.addEventListener("click", () => {
        console.log('Friends button clicked');
        fetch("friends.html") // Relative fetch
          .then(response => response.text())
          .then(html => {
            console.log('Friends HTML fetched');
            document.querySelector("main").innerHTML = html;
            fetch("http://localhost:3000/friends")
              .then(response => response.json())
              .then(data => {
                console.log('Friends data received:', data);
                const friendsList = document.getElementById("friends-list");
                if (friendsList) {
                  friendsList.innerHTML = data.map(f => `<li>${f.username} (Online: ${f.online})</li>`).join("");
                } else {
                  console.error('friends-list element not found');
                }
              })
              .catch(err => console.error("Friends fetch error:", err));
          }).catch(err => console.error("Friends HTML load error:", err));
      });
    } else {
      console.error('friends-button not found');
    }

    // Example theme art usage (add to your HTML as needed, e.g., <img src="art/buttonBar.bmp">)
    // If images fail to load, check console for CSP errors and adjust paths (e.g., "./art/buttonBar.bmp" if needed)
  }
});