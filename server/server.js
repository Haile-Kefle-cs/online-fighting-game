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

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

const rooms = {};
const players = {};
const MAX_PLAYERS = 8;

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/game.html'));
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    rooms: Object.keys(rooms).length,
    players: Object.keys(players).length,
    timestamp: new Date().toISOString()
  });
});

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Weapon types
const WEAPONS = {
  pistol: { name: 'Pistol', icon: '🔫', damage: 12, range: 150, speed: 8, fireRate: 300, color: '#ff6b6b' },
  rifle: { name: 'Rifle', icon: '🔫', damage: 18, range: 200, speed: 10, fireRate: 400, color: '#4facfe' },
  shotgun: { name: 'Shotgun', icon: '💥', damage: 25, range: 100, speed: 6, fireRate: 500, color: '#ffd93d' },
  sniper: { name: 'Sniper', icon: '🎯', damage: 40, range: 300, speed: 14, fireRate: 800, color: '#a29bfe' },
  rocket: { name: 'Rocket', icon: '🚀', damage: 50, range: 250, speed: 5, fireRate: 1000, color: '#ff6b00' },
  laser: { name: 'Laser', icon: '⚡', damage: 15, range: 180, speed: 12, fireRate: 200, color: '#00ff88' },
};

const WEAPON_SPAWNS = [
  { x: 150, y: 150 },
  { x: 750, y: 150 },
  { x: 150, y: 450 },
  { x: 750, y: 450 },
  { x: 450, y: 100 },
  { x: 450, y: 500 },
];

io.on('connection', (socket) => {
  console.log(`🟢 Player connected: ${socket.id}`);

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
      weaponSpawns: WEAPON_SPAWNS.map((pos) => ({
        ...pos,
        weapon: null,
        spawnTime: 0
      }))
    };
    
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
      deaths: 0,
      isDead: false,
      respawnTimer: 0
    };
    
    rooms[roomId].players.push(socket.id);
    socket.join(roomId);
    
    socket.emit('room-created', {
      roomId: roomId,
      player: players[socket.id],
      maxPlayers: rooms[roomId].maxPlayers
    });
    
    console.log(`✅ Room created: ${roomId} by ${playerName} (${rooms[roomId].maxPlayers} players max)`);
  });

  // Join room - FIXED: Allows joining even if game started
  socket.on('join-room', ({ roomId, playerName, character }) => {
    console.log(`🔗 Player ${playerName} attempting to join room ${roomId}`);
    
    if (!rooms[roomId]) {
      socket.emit('error', 'Room does not exist');
      return;
    }
    
    if (rooms[roomId].players.length >= rooms[roomId].maxPlayers) {
      socket.emit('error', 'Room is full');
      return;
    }
    
    // REMOVED: The check for gameStarted - now allows joining even during game
    // if (rooms[roomId].gameStarted) {
    //   socket.emit('error', 'Game already started');
    //   return;
    // }
    
    if (rooms[roomId].players.includes(socket.id)) {
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
      deaths: 0,
      isDead: false,
      respawnTimer: 0
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
    
    console.log(`✅ Player ${playerName} joined room ${roomId} (${rooms[roomId].players.length}/${rooms[roomId].maxPlayers})`);
    
    // Auto-start game when 2 or more players
    if (rooms[roomId].players.length >= 2 && !rooms[roomId].gameStarted) {
      rooms[roomId].gameStarted = true;
      const allPlayers = rooms[roomId].players.map(id => players[id]);
      
      console.log(`🎮 STARTING GAME in room ${roomId} with ${allPlayers.length} players!`);
      
      io.to(roomId).emit('game-start', {
        players: allPlayers,
        weapons: rooms[roomId].weapons
      });
    } else if (rooms[roomId].gameStarted) {
      // If game already started, send current game state to the new player
      const allPlayers = rooms[roomId].players.map(id => players[id]);
      socket.emit('game-start', {
        players: allPlayers,
        weapons: rooms[roomId].weapons
      });
      console.log(`📤 Sent game state to late joiner ${playerName}`);
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
    console.log(`🎮 Game manually started in room ${roomId}`);
  });

  // Leave room
  socket.on('leave-room', ({ roomId }) => {
    if (!rooms[roomId]) return;
    rooms[roomId].players = rooms[roomId].players.filter(id => id !== socket.id);
    socket.leave(roomId);
    if (rooms[roomId].players.length === 0) {
      delete rooms[roomId];
      console.log(`🗑️ Room ${roomId} deleted`);
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
    
    console.log(`🔄 Game restarted in room ${roomId}`);
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

  // Player movement
  socket.on('player-move', ({ x, y, direction }) => {
    const player = players[socket.id];
    if (!player) return;
    
    player.x = x;
    player.y = y;
    player.direction = direction;
    
    socket.to(player.roomId).emit('player-moved', {
      playerId: socket.id,
      x: x,
      y: y,
      direction: direction
    });
  });

  // Player shoot
  socket.on('player-shoot', ({ x, y, direction, attackType }) => {
    const player = players[socket.id];
    if (!player) return;
    
    const room = rooms[player.roomId];
    if (!room) return;
    
    const weapon = WEAPONS[player.weapon] || WEAPONS.pistol;
    const now = Date.now();
    if (now - player.lastAttackTime < weapon.fireRate) return;
    player.lastAttackTime = now;
    
    const projectile = {
      id: Date.now() + Math.random(),
      x: x + (direction === 'right' ? 30 : -30),
      y: y,
      direction: direction,
      speed: weapon.speed,
      damage: weapon.damage,
      radius: 8,
      life: 120,
      ownerId: socket.id,
      type: player.weapon,
      trail: [],
      color: weapon.color
    };
    
    room.projectiles.push(projectile);
    
    socket.to(player.roomId).emit('player-shot', {
      playerId: socket.id,
      x: x,
      y: y,
      direction: direction,
      attackType: attackType || 'light',
      weapon: player.weapon
    });
  });

  // Player attack
  socket.on('player-attack', ({ attackType = 'light' }) => {
    const player = players[socket.id];
    if (!player) return;
    
    player.isAttacking = true;
    
    const attackProps = {
      light: { damage: 10 + Math.floor(Math.random() * 8), range: 90, cooldown: 300 },
      heavy: { damage: 20 + Math.floor(Math.random() * 10), range: 120, cooldown: 500 },
      special: { damage: 30 + Math.floor(Math.random() * 10), range: 150, cooldown: 800 }
    };
    
    const props = attackProps[attackType] || attackProps.light;
    const room = rooms[player.roomId];
    if (!room) return;
    
    const otherPlayers = room.players.filter(id => id !== socket.id);
    
    for (const otherId of otherPlayers) {
      const other = players[otherId];
      if (!other) continue;
      
      const dx = player.x - other.x;
      const dy = player.y - other.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < props.range) {
        other.health = Math.max(0, other.health - props.damage);
        player.score += 10;
        player.comboCount = (player.comboCount || 0) + 1;
        
        io.to(player.roomId).emit('player-hit', {
          attackerId: socket.id,
          targetId: otherId,
          damage: props.damage,
          health: other.health,
          score: player.score,
          attackType: attackType,
          x: other.x,
          y: other.y
        });
        
        if (other.health <= 0) {
          player.kills = (player.kills || 0) + 1;
          other.deaths = (other.deaths || 0) + 1;
          io.to(player.roomId).emit('player-defeated', {
            winnerId: socket.id,
            winnerName: player.name,
            loserId: otherId,
            loserName: other.name,
            kills: player.kills,
            deaths: other.deaths
          });
          
          setTimeout(() => {
            respawnPlayer(otherId);
          }, 3000);
        }
      }
    }
    
    socket.to(player.roomId).emit('player-attacked', {
      playerId: socket.id,
      attackType: attackType
    });
    
    setTimeout(() => {
      if (players[socket.id]) {
        players[socket.id].isAttacking = false;
      }
    }, props.cooldown);
  });

  function respawnPlayer(playerId) {
    const player = players[playerId];
    if (!player) return;
    
    const room = rooms[player.roomId];
    if (!room) return;
    
    player.health = player.maxHealth;
    player.x = 100 + Math.random() * 700;
    player.y = 100 + Math.random() * 400;
    player.direction = Math.random() > 0.5 ? 'right' : 'left';
    player.comboCount = 0;
    player.isDead = false;
    
    io.to(player.roomId).emit('player-respawn', {
      playerId: playerId,
      x: player.x,
      y: player.y
    });
  }

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

  // Projectile update interval
  setInterval(() => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (!room.projectiles) continue;
      
      const projectilesToRemove = [];
      
      for (let i = 0; i < room.projectiles.length; i++) {
        const proj = room.projectiles[i];
        proj.life--;
        proj.x += proj.direction === 'right' ? proj.speed : -proj.speed;
        
        proj.trail.push({ x: proj.x, y: proj.y });
        if (proj.trail.length > 10) proj.trail.shift();
        
        if (proj.x < 0 || proj.x > 900 || proj.y < 0 || proj.y > 600 || proj.life <= 0) {
          projectilesToRemove.push(i);
          continue;
        }
        
        const otherPlayers = room.players.filter(id => id !== proj.ownerId);
        for (const playerId of otherPlayers) {
          const target = players[playerId];
          if (!target) continue;
          
          const dx = proj.x - target.x;
          const dy = proj.y - target.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < proj.radius + 25) {
            target.health = Math.max(0, target.health - proj.damage);
            const attacker = players[proj.ownerId];
            if (attacker) {
              attacker.score += 15;
              attacker.comboCount = (attacker.comboCount || 0) + 1;
              
              io.to(roomId).emit('player-hit', {
                attackerId: proj.ownerId,
                targetId: playerId,
                damage: proj.damage,
                health: target.health,
                score: attacker.score,
                attackType: 'projectile',
                x: proj.x,
                y: proj.y,
                weaponType: proj.type
              });
            }
            
            projectilesToRemove.push(i);
            
            if (target.health <= 0) {
              if (attacker) {
                attacker.kills = (attacker.kills || 0) + 1;
              }
              target.deaths = (target.deaths || 0) + 1;
              io.to(roomId).emit('player-defeated', {
                winnerId: proj.ownerId,
                winnerName: attacker ? attacker.name : 'Unknown',
                loserId: playerId,
                loserName: target.name,
                kills: attacker ? attacker.kills : 0,
                deaths: target.deaths
              });
              
              setTimeout(() => {
                respawnPlayer(playerId);
              }, 3000);
            }
            break;
          }
        }
      }
      
      for (let i = projectilesToRemove.length - 1; i >= 0; i--) {
        room.projectiles.splice(projectilesToRemove[i], 1);
      }
      
      if (room.projectiles.length > 0) {
        io.to(roomId).emit('projectile-update', {
          projectiles: room.projectiles.map(p => ({
            x: p.x,
            y: p.y,
            radius: p.radius,
            type: p.type,
            trail: p.trail,
            color: p.color
          }))
        });
      }
      
      if (room.weapons.length > 0) {
        io.to(roomId).emit('weapon-update', {
          weapons: room.weapons
        });
      }
    }
  }, 50);

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`🔴 Player disconnected: ${socket.id}`);
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
          console.log(`🗑️ Room ${roomId} deleted`);
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
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT} to play`);
});
