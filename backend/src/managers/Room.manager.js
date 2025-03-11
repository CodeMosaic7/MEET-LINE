import { UserManager } from "./user.manager.js";
export class RoomManager {
  constructor(userManager) {
    
    this.rooms = {};
    this.roomCounter = 0;
    this.userManager = userManager;    
  }

  createRoom(user1Id, user2Id) {
    const user1 = this.userManager.users.find(user => user.socket.id === user1Id);
    const user2 = this.userManager.users.find(user => user.socket.id === user2Id);
    console.log("users",this.userManager.users)
    // PROBLEM: user1 and user 2 are not joining the room
    console.log("user1",user1.socket.id)
    if (!user1 || !user2) {
        return console.error("Failed to create room: Invalid users");
    }

    const roomId = `room-${++this.roomCounter}`;
    this.rooms[roomId] = { users: [user1.socket.id, user2.socket.id] };

    user1.socket.join(roomId);
    user2.socket.join(roomId);

    user1.socket.emit("successfulConnection", { roomId, user: user2.socket.id });
    user2.socket.emit("successfulConnection", { roomId, user: user1.socket.id });

    return roomId;
}


  removeRoom(roomId) {
    if (this.rooms[roomId]) {
      const { users } = this.rooms[roomId];
      users.forEach((user) => {
        user.socket.emit("roomClosed", { roomId });
      });
      delete this.rooms[roomId];
      console.log(`Room ${roomId} removed`);
    } else {
      console.error(`Room ${roomId} does not exist`);
    }
  }

  onOffer(roomId, sdp) {
    console.log("sending offer");
    const room = this.rooms[roomId];
    if (room) {
      const user2 = room.users[1];
      user2?.socket.emit("offer", { roomId, sdp });
    } else {
      console.error("Room not found", roomId);
    }
    console.log("sent offer");
  }

  onAnswer(roomId, sdp) {
    console.log("sending answer");
    const room = this.rooms[roomId];
    if (room) {
      const user1 = room.users[0];
      const user2 = room.users[1];
      user1?.socket.emit("answer", { roomId, sdp });
    } else {
      console.error("Room not found", roomId);
    }
    console.log("sent answer");
  }
}
