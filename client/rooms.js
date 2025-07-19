// rooms.js (unchanged)
﻿// rooms.js (updated to use window.socket)
let socket = window.socket; // Use exposed from preload

if (!socket) {
  console.error("Socket not available - check preload exposure");
}

function initRooms() {
  document.getElementById("create-room").addEventListener("click", () => {
    const roomName = prompt("Enter room name:");
    if (roomName && socket) {
      socket.emit("create-room", { name: roomName }); // Assume server handles this
      loadRoomView(roomName);
    }
  });
}

function loadRoomView(roomName) {
  // Dynamically load partial HTML (fetch or inline)
  fetch("views/rooms.html")
    .then(response => response.text())
    .then(html => {
      document.querySelector("main").innerHTML = html;
      document.getElementById("room-name").textContent = roomName;
      // Socket listeners for players, etc.
      if (socket) {
        socket.on("room-update", (data) => {
          const playersList = document.getElementById("room-players");
          playersList.innerHTML = data.players.map(p => `<li>${p}</li>`).join("");
        });
      }
    });
}

module.exports = { initRooms };