import { UserManager } from "./user.manager.js";

export class RoomManager {
  constructor(userManager) {
    this.rooms = {};
    this.roomCounter = 0;
    this.userManager = userManager;
    this.socketToRoom = {}; // Track which room each socket is in
  }

  createRoom(user1Id, user2Id) {
    console.log("Creating room for users:", user1Id, user2Id);

    // Get users from UserManager
    const user1 = this.userManager.getUser(user1Id);
    const user2 = this.userManager.getUser(user2Id);

    console.log("Found users:", { user1: !!user1, user2: !!user2 });

    if (!user1 || !user2) {
      console.error("Failed to create room: One or both users not found");
      console.error(
        "Available users:",
        this.userManager.users.map((u) => u.socket.id)
      );
      return null;
    }

    const roomId = `room-${++this.roomCounter}`;

    // Store room with actual user objects, not just IDs
    this.rooms[roomId] = {
      users: [user1, user2],
      userIds: [user1.socket.id, user2.socket.id],
      createdAt: Date.now(),
    };

    // Track socket to room mapping
    this.socketToRoom[user1.socket.id] = roomId;
    this.socketToRoom[user2.socket.id] = roomId;

    // Join socket.io rooms
    user1.socket.join(roomId);
    user2.socket.join(roomId);

    console.log(`Room ${roomId} created successfully`);

    // Emit success events
    user1.socket.emit("successfulConnection", {
      roomId,
      otherUser: {
        id: user2.socket.id,
        name: user2.name,
      },
    });
    user2.socket.emit("successfulConnection", {
      roomId,
      otherUser: {
        id: user1.socket.id,
        name: user1.name,
      },
    });

    // Start WebRTC handshake - tell first user to create offer
    setTimeout(() => {
      user1.socket.emit("send-offer", { roomId });
    }, 100);

    return roomId;
  }

  removeRoom(roomId) {
    console.log(`Attempting to remove room: ${roomId}`);

    if (this.rooms[roomId]) {
      const room = this.rooms[roomId];

      // Notify users that room is closing
      room.users.forEach((user) => {
        if (user && user.socket) {
          user.socket.emit("roomClosed", { roomId });
          user.socket.leave(roomId);
          // Remove from socket to room mapping
          delete this.socketToRoom[user.socket.id];
        }
      });

      delete this.rooms[roomId];
      console.log(`Room ${roomId} removed successfully`);
      return true;
    } else {
      console.error(`Room ${roomId} does not exist`);
      return false;
    }
  }

  // Remove user from room when they disconnect
  removeUserFromRoom(socketId) {
    const roomId = this.socketToRoom[socketId];
    if (roomId && this.rooms[roomId]) {
      const room = this.rooms[roomId];

      // Notify other users in the room
      room.users.forEach((user) => {
        if (user.socket.id !== socketId && user.socket) {
          user.socket.emit("user-left", { roomId });
        }
      });

      // Remove the entire room since it's a 1-on-1 chat
      this.removeRoom(roomId);
    }

    // Clean up socket to room mapping
    delete this.socketToRoom[socketId];
  }

  // Get room by socket ID
  getRoomBySocket(socketId) {
    const roomId = this.socketToRoom[socketId];
    return roomId ? this.rooms[roomId] : null;
  }

  // Handle WebRTC offer
  onOffer(socketId, { roomId, sdp }) {
    console.log("Handling offer from socket:", socketId);

    const room = this.rooms[roomId];
    if (!room) {
      console.error("Room not found:", roomId);
      return;
    }

    // Find the other user in the room
    const otherUser = room.users.find((user) => user.socket.id !== socketId);

    if (otherUser && otherUser.socket) {
      console.log("Forwarding offer to:", otherUser.socket.id);
      otherUser.socket.emit("offer", { roomId, sdp });
    } else {
      console.error("Other user not found in room:", roomId);
    }
  }

  // Handle WebRTC answer
  onAnswer(socketId, { roomId, sdp }) {
    console.log("Handling answer from socket:", socketId);

    const room = this.rooms[roomId];
    if (!room) {
      console.error("Room not found:", roomId);
      return;
    }

    // Find the other user in the room
    const otherUser = room.users.find((user) => user.socket.id !== socketId);

    if (otherUser && otherUser.socket) {
      console.log("Forwarding answer to:", otherUser.socket.id);
      otherUser.socket.emit("answer", { roomId, sdp });
    } else {
      console.error("Other user not found in room:", roomId);
    }
  }

  // Handle ICE candidates
  onIceCandidate(socketId, { roomId, candidate }) {
    console.log("Handling ICE candidate from socket:", socketId);

    const room = this.rooms[roomId];
    if (!room) {
      console.error("Room not found:", roomId);
      return;
    }

    // Find the other user in the room
    const otherUser = room.users.find((user) => user.socket.id !== socketId);

    if (otherUser && otherUser.socket) {
      console.log("Forwarding ICE candidate to:", otherUser.socket.id);
      otherUser.socket.emit("add-ice-candidate", { roomId, candidate });
    } else {
      console.error("Other user not found for ICE candidate:", roomId);
    }
  }

  // Get room statistics
  getRoomStats() {
    return {
      totalRooms: Object.keys(this.rooms).length,
      socketToRoomMappings: Object.keys(this.socketToRoom).length,
      rooms: Object.keys(this.rooms).map((roomId) => ({
        roomId,
        userCount: this.rooms[roomId].users.length,
        userIds: this.rooms[roomId].userIds,
        createdAt: this.rooms[roomId].createdAt,
        age: Date.now() - this.rooms[roomId].createdAt,
      })),
    };
  }

  // Clean up empty or stale rooms
  cleanupRooms() {
    const now = Date.now();
    const roomsToDelete = [];

    Object.keys(this.rooms).forEach((roomId) => {
      const room = this.rooms[roomId];

      // Remove rooms older than 1 hour
      if (now - room.createdAt > 3600000) {
        console.log(
          `Room ${roomId} is older than 1 hour, marking for deletion`
        );
        roomsToDelete.push(roomId);
        return;
      }

      // Remove rooms where users are no longer connected
      const activeUsers = room.users.filter(
        (user) => user && user.socket && user.socket.connected
      );

      if (activeUsers.length === 0) {
        console.log(`Room ${roomId} has no active users, marking for deletion`);
        roomsToDelete.push(roomId);
      }
    });

    roomsToDelete.forEach((roomId) => {
      console.log(`Cleaning up stale room: ${roomId}`);
      this.removeRoom(roomId);
    });

    // Clean up orphaned socket-to-room mappings
    const validRoomIds = Object.keys(this.rooms);
    const orphanedSockets = [];

    Object.keys(this.socketToRoom).forEach((socketId) => {
      const roomId = this.socketToRoom[socketId];
      if (!validRoomIds.includes(roomId)) {
        orphanedSockets.push(socketId);
      }
    });

    orphanedSockets.forEach((socketId) => {
      console.log(`Cleaning up orphaned socket-to-room mapping: ${socketId}`);
      delete this.socketToRoom[socketId];
    });
  }
}
