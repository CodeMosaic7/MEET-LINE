import express from 'express';
// import { Socket } from 'socket.io';
import http from 'http';
import { Server } from 'socket.io';
import {UserManager} from "./managers/User.manager.js"

const app = express();
const server=http.createServer(app)
const io = new Server(server,{
  cors:{
    origin:"*"
  }
});


const userManager= new UserManager()

io.on('connection', (socket) => {
  // console.log(socket)
  console.log('a user connected',socket.id);

  userManager.addUser("randonUser",socket)
  console.log('Current queue',userManager.queue)
  socket.on("disconnect",()=>{
    console.log("user disconnected");
    // userManager.removeUser(socket.id)
  })

});

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});


