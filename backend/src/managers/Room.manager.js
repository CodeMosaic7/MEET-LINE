
export class RoomManager {
  constructor() {
    this.rooms = {};
    this.roomCounter = 0;
    
  }

  createRoom(user1, user2) {
    // 1. assign them room
    // 2. Notify them they are there
    // 3. remove them from current queue.

    // generating room id
    const roomId = `room-${++this.roomCounter}`;
    console.log(typeof(roomId))
    console.log(roomId)
    this.rooms[roomId] = {
      // ??
      users: [user1, user2],
    };

    user1?.socket.emit("successfulConnection", { roomId, User: user2.name });
    console.log("in create roomId",roomId)
    // user2?.socket.emit("successfulConnection", { roomId, User: user1.name });
    return roomId
  }

  removeRoom(roomId) {
    if (this.rooms[roomId]) {
      // extracting users from the room
      const { users } = this.rooms[roomId];

      users.forEach((user) => {
        user.socket.emit("roomCLosed", { roomId });
      });
      delete this.rooms[roomId];
      console.log(`Room ${roomId} removed`);
    }
  }
// sdp session decription protocol
  
  onOffer(roomId, sdp) {
    console.log("sending offer")
    const room = this.rooms[roomId];
    if (room) {
      const user2 = room.users[1];
      user2?.socket.emit("offer", {roomId,offer: sdp });
    }
    console.log("sent offer")
    
  }

  onAnswer(roomId, sdp) {
    console.log("sending anwser")
    const room = this.rooms[roomId];
    console.log(room)
    if (room) {
      const user1 = room.users[0];
      const user2 = room.users[1];
      room.user1?.socket.emit("answer", { roomId, answer:sdp });
      room.user2?.socket.emit("answer", { roomId, answer: sdp });
    }
    else{
      console.error("Room not found",roomId)
    }
    console.log("sent anwser")
  }
}
