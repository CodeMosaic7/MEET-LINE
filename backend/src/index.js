import express from "express";
// import { Socket } from 'socket.io';
import http from "http";
import { Server } from "socket.io";
import { UserManager } from "./managers/user.manager.js";
import { RoomManager } from "./managers/room.manager.js";
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  },
});
const roomManager=new RoomManager(io)
const userManager = new UserManager(io);


io.on("connection", async(socket) => {
  console.log("a user connected", socket.id);
  userManager.addUser("randonUser", socket);

  if (userManager.queue.length >= 2) {
    const user1 = userManager.queue.shift();
    const user2 = userManager.queue.shift();
    roomId=roomManager.createRoom(user1,user2); 
  }
  // console.log('Current queue',userManager.queue)
  socket.on("disconnect", () => {
    console.log("user disconnected");
    userManager.removeUser(socket.id)
  });
  socket.on("join", (name) => {
    userManager.addUser(name, socket);  // ✅ Add user via userManager
  });
});

server.listen(3000, () => {
  console.log("server running at http://localhost:3000");
});
