import express from "express";
import http from "http";
import { Server } from "socket.io";
import { UserManager } from "./managers/user.manager.js";
import { RoomManager } from "./managers/room.manager.js";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: "*" }));
app.use(express.json());

const userManager = new UserManager();
const roomManager = new RoomManager(userManager);

console.log("Server started");

// Remove this endpoint as it's not needed for the matching system
// app.get("/get-room", (req, res) => {
//   const roomId = roomManager.createRoom();
//   res.json({ roomId });
// });

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  // Handle user joining - they want to find a match
  socket.on("join-room", ({ name }) => {
    console.log(`${name} (${socket.id}) wants to find a match`);

    // Add user to user manager
    const user = userManager.addUser(socket, { name });

    // Check if there's someone waiting
    const waitingUserId = userManager.getNextWaitingUser();

    if (waitingUserId && waitingUserId !== socket.id) {
      // Match with waiting user
      console.log(`Matching ${socket.id} with waiting user ${waitingUserId}`);

      // Remove the waiting user from queue since they're being matched
      userManager.removeFromWaitingQueue(waitingUserId);

      const roomId = roomManager.createRoom(waitingUserId, socket.id);

      if (roomId) {
        console.log(`Room ${roomId} created successfully`);
      } else {
        // If room creation failed, add current user to waiting queue
        console.log(
          `Room creation failed, adding ${socket.id} to waiting queue`
        );
        userManager.addToWaitingQueue(socket.id);
        socket.emit("waiting", { message: "Waiting for another user..." });
      }
    } else {
      // Add to waiting queue
      console.log(`Adding ${socket.id} to waiting queue`);
      userManager.addToWaitingQueue(socket.id);
      socket.emit("waiting", { message: "Waiting for another user..." });
    }
  });

  // Handle WebRTC signaling
  socket.on("offer", ({ roomId, sdp }) => {
    console.log(`Offer received from ${socket.id} for room ${roomId}`);
    roomManager.onOffer(socket.id, { roomId, sdp });
  });

  socket.on("answer", ({ roomId, sdp }) => {
    console.log(`Answer received from ${socket.id} for room ${roomId}`);
    roomManager.onAnswer(socket.id, { roomId, sdp });
  });

  socket.on("add-ice-candidate", ({ roomId, candidate }) => {
    console.log(`ICE candidate received from ${socket.id} for room ${roomId}`);
    roomManager.onIceCandidate(socket.id, { roomId, candidate });
  });

  // Handle user leaving room
  socket.on("leave-room", ({ roomId }) => {
    console.log(`${socket.id} leaving room ${roomId}`);
    roomManager.removeUserFromRoom(socket.id);
    userManager.removeFromWaitingQueue(socket.id);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // Remove from room if in one
    roomManager.removeUserFromRoom(socket.id);

    // Remove from waiting queue
    userManager.removeFromWaitingQueue(socket.id);

    // Remove from user manager
    userManager.removeUser(socket.id);
  });

  // Handle errors
  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

// Cleanup intervals
setInterval(() => {
  userManager.cleanupDisconnectedUsers();
  roomManager.cleanupRooms();
}, 30000); // Every 30 seconds

// Stats endpoint for debugging
app.get("/stats", (req, res) => {
  res.json({
    users: userManager.getUserStats(),
    rooms: roomManager.getRoomStats(),
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Stats available at http://localhost:${PORT}/stats`);
});
