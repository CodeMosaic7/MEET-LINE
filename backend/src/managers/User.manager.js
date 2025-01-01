import { Socket } from "socket.io";
import { RoomManager } from "./room.manager.js";

export class UserManager {
  constructor() {
    this.users = [];
    this.queue=[];
    this.roomManager=new RoomManager();
  }
  addUser(name, socket) {
    this.users.push({
      name,
      socket,
    });
    console.log(`Added user: ${name}, socket ID: ${socket.id}`);
    this.queue.push(socket.id);
    // console.log("added user to queue array",this.queue)

    socket.send("lobby")
    this.clearQueue()
    this.initHandlers(socket)
  }
  removeUser(socketId) {
    // which user to remove
    const user=this.users.find(x=>x.socket.id===socketId)
    this.users = this.users.filter((x) => x.socket.id !== socketId);
    this.queue=this.queue.filter(x=>x!==socketId)
  }

clearQueue(){
  console.log("Checking queue...");
  console.log("Current queue:", this.queue);

  // Ensure there are at least two users in the queue
  if (this.queue.length < 2) {
      console.log("Not enough users in the queue.");
      return;
  }

  // Retrieve the first two socket IDs from the queue
  const socketId1 = this.queue.shift();
  const socketId2 = this.queue.shift();
  console.log(`Selected socket IDs: ${socketId1}, ${socketId2}`);

  // Find users corresponding to the socket IDs
  const user1 = this.users.find((x) => x.socket.id === socketId1);
  const user2 = this.users.find((x) => x.socket.id === socketId2);

  if (!user1) {
      console.log(`User with socket ID ${socketId1} not found.`);
  }
  if (!user2) {
      console.log(`User with socket ID ${socketId2} not found.`);
  }

  // Ensure both users are valid
  if (!user1 || !user2) {
      console.log("One or both users are missing. Returning IDs to queue.");
      if (socketId1) this.queue.unshift(socketId1); // Add back to the front of the queue
      if (socketId2) this.queue.unshift(socketId2);
      return;
  }

  // Create a room for the users
  const room = this.roomManager.createRoom(user1, user2);
  console.log(`Room created for users: ${user1.name}, ${user2.name}`);

  user1.socket.emit("send-offer", { roomId: room });
  user2.socket.emit("offer", { roomId: room});

  user1.socket.emit("connection-established", { roomId: room, user: user2.name });
  user2.socket.emit("connection-established", { roomId: room, user: user1.name });
  console.log("connection established and room made")
}

onConnection(roomId,sdp){
  const user2=this.rooms.get(roomId)?.user1
  user2?.socket.emit("offer",{
      sdp
  })
}

initHandlers(socket){
  socket.on("offer",({sdp,roomId})=>{
    this.roomManager.onOffer(roomId,sdp)
  })
  socket.on("answer",({sdp,roomId})=>{
    console.log("in anwer",roomId)
    this.roomManager.onAnswer(roomId,sdp)
  })
  socket.on("disconnect", () => {
    this.removeUser(socket.id); // Remove user on disconnect
  });
}


// deleteRoom(roomId){
//   const 
// }


}