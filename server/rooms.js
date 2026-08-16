class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.maxPlayers = 2;
  }

  createRoom(roomId) {
    if (this.rooms.has(roomId)) {
      return null;
    }

    const room = {
      id: roomId,
      players: [],
      createdAt: Date.now(),
      gameStarted: false
    };

    this.rooms.set(roomId, room);
    console.log(`Room created: ${roomId}`);
    return room;
  }

  joinRoom(roomId, playerId, playerName, character) {
    let room = this.rooms.get(roomId);
    
    if (!room) {
      room = this.createRoom(roomId);
      if (!room) return null;
    }

    // Check if room is full
    if (room.players.length >= this.maxPlayers) {
      console.log(`Room ${roomId} is full`);
      return null;
    }

    // Check if player already in room
    if (room.players.some(p => p.id === playerId)) {
      console.log(`Player ${playerId} already in room`);
      return room;
    }

    const player = {
      id: playerId,
      name: playerName || `Player${room.players.length + 1}`,
      character: character || 'warrior',
      joinedAt: Date.now()
    };

    room.players.push(player);
    console.log(`Player ${player.name} joined room ${roomId} (${room.players.length}/${this.maxPlayers})`);
    return room;
  }

  removePlayer(playerId) {
    for (const [roomId, room] of this.rooms) {
      const index = room.players.findIndex(p => p.id === playerId);
      if (index !== -1) {
        const player = room.players[index];
        room.players.splice(index, 1);
        console.log(`Player ${player.name} removed from room ${roomId}`);
        
        if (room.players.length === 0) {
          this.rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        }
        
        return { roomId, player };
      }
    }
    return null;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  getRoomForPlayer(playerId) {
    for (const [roomId, room] of this.rooms) {
      if (room.players.some(p => p.id === playerId)) {
        return room;
      }
    }
    return null;
  }

  isRoomFull(roomId) {
    const room = this.rooms.get(roomId);
    return room ? room.players.length >= this.maxPlayers : true;
  }

  getAvailableRooms() {
    const available = [];
    for (const [roomId, room] of this.rooms) {
      if (room.players.length < this.maxPlayers && !room.gameStarted) {
        available.push({
          id: roomId,
          players: room.players.length,
          maxPlayers: this.maxPlayers
        });
      }
    }
    return available;
  }

  startGame(roomId) {
    const room = this.rooms.get(roomId);
    if (room && room.players.length === this.maxPlayers) {
      room.gameStarted = true;
      console.log(`Game started in room ${roomId}`);
      return true;
    }
    return false;
  }

  resetRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.gameStarted = false;
      room.players = [];
      console.log(`Room ${roomId} reset`);
    }
  }

  getAllRooms() {
    const rooms = [];
    for (const [roomId, room] of this.rooms) {
      rooms.push({
        id: roomId,
        players: room.players.length,
        maxPlayers: this.maxPlayers,
        gameStarted: room.gameStarted
      });
    }
    return rooms;
  }
}

module.exports = RoomManager;