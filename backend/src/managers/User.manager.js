import { Socket } from "socket.io";
import { RoomManager } from "./room.manager.js";

export class UserManager {
  constructor(roomManager) {
    this.users = [];
    this.queue = [];
    this.roomManager = new RoomManager(this);
  }

  addUser(name, socket) {
    this.users.push({
      name,
      socket,
    });
    console.log(this.queue.length);

    console.log(`Added user: ${name}, socket ID: ${socket.id}`);
    this.queue.push(socket.id);
    // console.log("added user to queue array",this.queue)
    this.clearQueue();

    socket.send("lobby");
    
  }

  removeUser(socketId) {
    // which user to remove
    this.users = this.users.filter((x) => x.socket.id !== socketId);
    this.queue = this.queue.filter((x) => x !== socketId);
    console.log("User removed. Current users:", this.users);
  }

  clearQueue() {
    console.log("Checking queue...");
    console.log("Current queue:", this.queue);
    // Ensure there are at least two users in the queue
    if (this.queue.length < 2) {
      console.log("Not enough users in the queue.");
      return;
    }
    // Retrieve the first two socket IDs from the queue
    const user1Id = this.queue.shift();
    const user2Id = this.queue.shift();

    // Find the users corresponding to the socket IDs 
    const user1 = this.users.find((user) => user.socket.id === user1Id);
    const user2 = this.users.find((user) => user.socket.id === user2Id);
    console.log(`Selected socket IDs: ${user1}, ${user2}`);

    // Find users corresponding to the socket IDs
    
    if (!user1) {
      console.log(`User with socket ID ${user1.socket.id} not found.`);
    }
    if (!user2) {
      console.log(`User with socket ID ${user2.socket.id} not found.`);
    }
    // Ensure both users are valid
    if (!user1 || !user2) {
      console.log("One or both users are missing. Returning IDs to queue.");
      if (user1) this.queue.unshift(user1.socket.id); // Add back to the front of the queue
      if (user2) this.queue.unshift(user2.socket.id);
      return;
    }

    // Create a room for the users
    const roomId = this.roomManager.createRoom(user1Id, user2Id);
    console.log(`Room created for users: ${user1.Socket}, ${user2.Socket}`);

    user1.socket.emit("send-offer", { roomId: roomId });
    user2.socket.emit("offer", { roomId: roomId});

    user1.socket.emit("connection-established", {
      roomId: roomId,
      user: user2.name,
    });
    user2.socket.emit("connection-established", {
      roomId: roomId,
      user: user1.name,
    });
    console.log("connection established and room made");
  }

  onConnection(roomId, sdp) {
    const user2 = this.rooms.get(roomId)?.user1;
    user2?.socket.emit("offer", {
      sdp,
    });
  }

  initHandlers(socket) {
    socket.on("offer", ({ sdp, roomId }) => {
      this.roomManager.onOffer(roomId, sdp);
    });
    socket.on("answer", ({ sdp, roomId }) => {
      console.log("in anwer", roomId);
      this.roomManager.onAnswer(roomId, sdp);
    });
    socket.on("disconnect", () => {
      this.removeUser(socket.id); // Remove user on disconnect
    });
  }

  // deleteRoom(roomId){
  //   const
  // }
}
