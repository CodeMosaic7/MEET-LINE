export class UserManager {
  constructor() {
    this.users = [];
    this.waitingQueue = [];
  }

  // Add a new user
  addUser(socket, userData = {}) {
    const user = {
      socket,
      id: socket.id,
      name: userData.name || `User-${socket.id.substring(0, 6)}`,
      joinedAt: Date.now(),
      ...userData,
    };

    this.users.push(user);
    console.log(
      `User ${user.name} (${socket.id}) added. Total users: ${this.users.length}`
    );

    return user;
  }

  // Remove a user
  removeUser(socketId) {
    const userIndex = this.users.findIndex(
      (user) => user.socket.id === socketId
    );

    if (userIndex !== -1) {
      const user = this.users[userIndex];
      this.users.splice(userIndex, 1);

      // Also remove from waiting queue if present
      this.removeFromWaitingQueue(socketId);

      console.log(
        `User ${user.name} (${socketId}) removed. Total users: ${this.users.length}`
      );
      return user;
    }

    console.log(`User ${socketId} not found for removal`);
    return null;
  }

  // Get user by socket ID
  getUser(socketId) {
    return this.users.find((user) => user.socket.id === socketId);
  }

  // Add user to waiting queue
  addToWaitingQueue(socketId) {
    if (!this.waitingQueue.includes(socketId)) {
      this.waitingQueue.push(socketId);
      console.log(
        `User ${socketId} added to waiting queue. Queue length: ${this.waitingQueue.length}`
      );
    }
  }

  // Get next user from waiting queue without removing them
  getNextWaitingUser() {
    if (this.waitingQueue.length > 0) {
      return this.waitingQueue[0];
    }
    return null;
  }

  // Remove user from waiting queue
  removeFromWaitingQueue(socketId) {
    const index = this.waitingQueue.indexOf(socketId);
    if (index !== -1) {
      this.waitingQueue.splice(index, 1);
      console.log(
        `User ${socketId} removed from waiting queue. Queue length: ${this.waitingQueue.length}`
      );
      return true;
    }
    return false;
  }

  // Check if user is in waiting queue
  isInWaitingQueue(socketId) {
    return this.waitingQueue.includes(socketId);
  }

  // Get all connected users
  getConnectedUsers() {
    return this.users.filter((user) => user.socket && user.socket.connected);
  }

  // Get user statistics
  getUserStats() {
    return {
      totalUsers: this.users.length,
      connectedUsers: this.getConnectedUsers().length,
      waitingQueueLength: this.waitingQueue.length,
      waitingQueue: this.waitingQueue,
      users: this.users.map((user) => ({
        id: user.id,
        name: user.name,
        connected: user.socket ? user.socket.connected : false,
        joinedAt: user.joinedAt,
        inWaitingQueue: this.isInWaitingQueue(user.id),
      })),
    };
  }

  // Clean up disconnected users
  cleanupDisconnectedUsers() {
    const before = this.users.length;

    // Get disconnected user IDs first
    const disconnectedUserIds = this.users
      .filter((user) => !user.socket || !user.socket.connected)
      .map((user) => user.id);

    // Remove disconnected users from the users array
    this.users = this.users.filter(
      (user) => user.socket && user.socket.connected
    );

    // Remove disconnected users from waiting queue
    disconnectedUserIds.forEach((userId) => {
      this.removeFromWaitingQueue(userId);
    });

    const after = this.users.length;

    if (before !== after) {
      console.log(`Cleaned up ${before - after} disconnected users`);
    }
  }
}
