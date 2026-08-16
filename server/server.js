const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Game state
const rooms = {};
const players = {};
const MAX_PLAYERS = 8;

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/game.html'));
});

// Health check for Render
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    rooms: Object.keys(rooms).length,
    players: Object.keys(players).length,
    timestamp: new Date().toISOString()
  });
});

// Generate room ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Weapon types
const WEAPONS = {
  pistol: { name: '🔫 Pistol', damage: 12, range: 150, speed: 8, fireRate: 300, color: '#ff6b6b' },
  rifle: { name: '🔫 Rifle', damage: 18, range: 200, speed: 10, fireRate: 400, color: '#4facfe' },
  shotgun: { name: '💥 Shotgun', damage: 25, range: 100, speed: 6, fireRate: 500, color: '#ffd93d' },
  sniper: { name: '🎯 Sniper', damage: 40, range: 300, speed: 14, fireRate: 800, color: '#a29bfe' },
  rocket: { name: '🚀 Rocket', damage: 50, range: 250, speed: 5, fireRate: 1000, color: '#ff6b00' },
  laser: { name: '⚡ Laser', damage: 15, range: 180, speed: 12, fireRate: 200, color: '#00ff88' },
};

// Weapon spawn positions
const WEAPON_SPAWNS = [
  { x: 150, y: 150 },
  { x: 750, y: 150 },
  { x: 150, y: 450 },
  { x: 750, y: 450 },
  { x: 450, y: 100 },
  { x: 450, y: 500 },
];

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Get available rooms
  socket.on('get-rooms', () => {
    const availableRooms = Object.keys(rooms).map(roomId => ({
      id: roomId,
      players: rooms[roomId].players.length,
      maxPlayers: rooms[roomId].maxPlayers || MAX_PLAYERS,
      gameStarted: rooms[roomId].gameStarted || false
    }));
    socket.emit('rooms-list', availableRooms);
  });

  // Create room
  socket.on('create-room', ({ playerName, character, maxPlayers = 8 }) => {
    const roomId = generateRoomId();
    rooms[roomId] = {
      players: [],
      gameStarted: false,
      projectiles: [],
      weapons: [],
      maxPlayers: Math.min(maxPlayers, 8),
      weaponSpawns: WEAPON_SPAWNS.map((pos, i) => ({
        ...pos,
        weapon: null,
        spawnTime: 0
      }))
    };
    
    // Spawn initial weapons
    spawnWeapons(roomId);
    
    players[socket.id] = {
      id: socket.id,
      name: playerName || 'Player',
      character: character || 'soldier',
      roomId: roomId,
      x: 200 + Math.random() * 100,
      y: 200 + Math.random() * 200,
      health: 100,
      maxHealth: 100,
      score: 0,
      direction: 'right',
      isAttacking: false,
      isShooting: false,
      shootCooldown: 0,
      comboCount: 0,
      lastAttackTime: 0,
      weapon: 'pistol',
      kills: 0,
      deaths: 0
    };
    
    rooms[roomId].players.push(socket.id);
    socket.join(roomId);
    
    socket.emit('room-created', {
      roomId: roomId,
      player: players[socket.id],
      maxPlayers: rooms[roomId].maxPlayers
    });
    
    console.log(`Room created: ${roomId} by ${playerName} (${rooms[roomId].maxPlayers} players max)`);
  });

  // Join room
  socket.on('join-room', ({ roomId, playerName, character }) => {
    if (!rooms[roomId]) {
      socket.emit('error', 'Room does not exist');
      return;
    }
    
    if (rooms[roomId].players.length >= rooms[roomId].maxPlayers) {
      socket.emit('error', 'Room is full');
      return;
    }
    
    if (rooms[roomId].gameStarted) {
      socket.emit('error', 'Game already started');
      return;
    }
    
    const x = 200 + Math.random() * 500;
    const y = 100 + Math.random() * 400;
    const direction = Math.random() > 0.5 ? 'right' : 'left';
    
    players[socket.id] = {
      id: socket.id,
      name: playerName || 'Player',
      character: character || 'soldier',
      roomId: roomId,
      x: x,
      y: y,
      health: 100,
      maxHealth: 100,
      score: 0,
      direction: direction,
      isAttacking: false,
      isShooting: false,
      shootCooldown: 0,
      comboCount: 0,
      lastAttackTime: 0,
      weapon: 'pistol',
      kills: 0,
      deaths: 0
    };
    
    rooms[roomId].players.push(socket.id);
    socket.join(roomId);
    
    const roomPlayers = rooms[roomId].players.map(id => players[id]);
    socket.emit('room-joined', {
      roomId: roomId,
      players: roomPlayers,
      playerId: socket.id,
      maxPlayers: rooms[roomId].maxPlayers,
      weapons: rooms[roomId].weapons
    });
    
    socket.to(roomId).emit('player-joined', {
      player: players[socket.id]
    });
    
    console.log(`Player ${playerName} joined room ${roomId} (${rooms[roomId].players.length}/${rooms[roomId].maxPlayers})`);
    
    if (rooms[roomId].players.length >= 2) {
      rooms[roomId].gameStarted = true;
      const allPlayers = rooms[roomId].players.map(id => players[id]);
      io.to(roomId).emit('game-start', {
        players: allPlayers,
        weapons: rooms[roomId].weapons
      });
      console.log(`Game started in room ${roomId}`);
    }
  });

  // Start game manually
  socket.on('start-game', ({ roomId }) => {
    if (!rooms[roomId]) return;
    if (rooms[roomId].players.length < 2) {
      socket.emit('error', 'Need at least 2 players to start');
      return;
    }
    rooms[roomId].gameStarted = true;
    const allPlayers = rooms[roomId].players.map(id => players[id]);
    io.to(roomId).emit('game-start', {
      players: allPlayers,
      weapons: rooms[roomId].weapons
    });
  });

  // Leave room
  socket.on('leave-room', ({ roomId }) => {
    if (!rooms[roomId]) return;
    rooms[roomId].players = rooms[roomId].players.filter(id => id !== socket.id);
    socket.leave(roomId);
    if (rooms[roomId].players.length === 0) {
      delete rooms[roomId];
    }
    if (players[socket.id]) {
      delete players[socket.id];
    }
  });

  // Restart game
  socket.on('restart-game', ({ roomId }) => {
    if (!rooms[roomId]) return;
    
    const roomPlayers = rooms[roomId].players;
    roomPlayers.forEach(id => {
      if (players[id]) {
        players[id].health = players[id].maxHealth;
        players[id].x = 100 + Math.random() * 700;
        players[id].y = 100 + Math.random() * 400;
        players[id].direction = Math.random() > 0.5 ? 'right' : 'left';
        players[id].isDead = false;
        players[id].comboCount = 0;
        players[id].score = 0;
        players[id].kills = 0;
        players[id].weapon = 'pistol';
      }
    });
    
    rooms[roomId].projectiles = [];
    rooms[roomId].gameStarted = true;
    
    io.to(roomId).emit('game-reset', {
      players: roomPlayers.map(id => players[id])
    });
  });

  // Weapon pickup
  socket.on('pickup-weapon', ({ weaponId, weaponType }) => {
    const player = players[socket.id];
    if (!player) return;
    
    const room = rooms[player.roomId];
    if (!room) return;
    
    const weaponIndex = room.weapons.findIndex(w => w.id === weaponId);
    if (weaponIndex === -1) return;
    
    player.weapon = weaponType;
    room.weapons.splice(weaponIndex, 1);
    
    setTimeout(() => {
      if (room) {
        spawnSingleWeapon(room, weaponType);
      }
    }, 5000);
    
    socket.emit('weapon-picked-up', {
      weaponType: weaponType,
      weapon: WEAPONS[weaponType]
    });
    
    socket.to(player.roomId).emit('player-weapon-change', {
      playerId: socket.id,
      weaponType: weaponType
    });
  });

  // ... (rest of your socket handlers - player-move, player-shoot, etc.)
  // ... (keep all your existing handlers)

  function spawnWeapons(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    
    const weaponTypes = Object.keys(WEAPONS);
    const count = Math.min(weaponTypes.length, room.maxPlayers);
    
    for (let i = 0; i < count; i++) {
      const type = weaponTypes[i % weaponTypes.length];
      const spawn = room.weaponSpawns[i % room.weaponSpawns.length];
      room.weapons.push({
        id: Date.now() + Math.random() + i,
        type: type,
        x: spawn.x + (Math.random() - 0.5) * 30,
        y: spawn.y + (Math.random() - 0.5) * 30,
        ...WEAPONS[type]
      });
    }
  }

  function spawnSingleWeapon(room, weaponType) {
    const spawn = room.weaponSpawns[Math.floor(Math.random() * room.weaponSpawns.length)];
    room.weapons.push({
      id: Date.now() + Math.random(),
      type: weaponType,
      x: spawn.x + (Math.random() - 0.5) * 30,
      y: spawn.y + (Math.random() - 0.5) * 30,
      ...WEAPONS[weaponType]
    });
  }

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const player = players[socket.id];
    if (player) {
      const roomId = player.roomId;
      if (rooms[roomId]) {
        rooms[roomId].players = rooms[roomId].players.filter(id => id !== socket.id);
        socket.to(roomId).emit('player-left', {
          playerId: socket.id,
          playerName: player.name
        });
        
        if (rooms[roomId].players.length === 0) {
          delete rooms[roomId];
          console.log(`Room ${roomId} deleted`);
        } else {
          rooms[roomId].gameStarted = false;
        }
      }
      delete players[socket.id];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to play`);
});