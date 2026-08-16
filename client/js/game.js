class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.socket = new SocketManager();
        this.controls = new Controls();
        this.players = {};
        this.localPlayer = null;
        this.roomId = null;
        this.gameState = {
            status: 'waiting',
            scores: { player1: 0, player2: 0 }
        };
        this.keys = {};
        
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        this.roomId = urlParams.get('roomId');
        this.playerName = urlParams.get('playerName') || 'Player';
        this.character = urlParams.get('character') || 'warrior';
        
        this.initialize();
    }
    
    initialize() {
        this.setupCanvas();
        this.setupSocket();
        this.setupControls();
        this.setupUI();
        this.startGameLoop();
        this.setupChat();
    }
    
    setupCanvas() {
        // Make canvas responsive
        const resizeCanvas = () => {
            const container = this.canvas.parentElement;
            const width = container.clientWidth;
            const height = width * (600 / 900);
            this.canvas.width = 900;
            this.canvas.height = 600;
            this.canvas.style.width = width + 'px';
            this.canvas.style.height = height + 'px';
        };
        
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
    }
    
    setupSocket() {
        this.socket.on('room-joined', (data) => {
            this.roomId = data.roomId;
            document.getElementById('roomIdDisplay').textContent = `Room: ${data.roomId}`;
            this.updatePlayerList(data.players);
            
            // Create local player
            const localData = data.players.find(p => p.id === this.socket.id);
            if (localData) {
                this.localPlayer = new Player(
                    this.socket.id,
                    localData.name,
                    localData.character,
                    { x: 200, y: 300 }
                );
                this.players[this.socket.id] = this.localPlayer;
            }
            
            // Create other players
            data.players.forEach(p => {
                if (p.id !== this.socket.id) {
                    const player = new Player(
                        p.id,
                        p.name,
                        p.character,
                        { x: 600, y: 300 }
                    );
                    player.direction = 'left';
                    this.players[p.id] = player;
                }
            });
            
            document.getElementById('gameStatus').textContent = 'Waiting for players...';
        });
        
        this.socket.on('player-joined', (data) => {
            const player = new Player(
                data.playerId,
                data.playerName,
                data.character,
                { x: 600, y: 300 }
            );
            player.direction = 'left';
            this.players[data.playerId] = player;
            this.updatePlayerList(Object.values(this.players));
            
            document.getElementById('gameStatus').textContent = 'Player joined!';
        });
        
        this.socket.on('player-left', (data) => {
            delete this.players[data.playerId];
            this.updatePlayerList(Object.values(this.players));
            
            document.getElementById('gameStatus').textContent = 'Player disconnected';
        });
        
        this.socket.on('game-start', (data) => {
            this.gameState.status = 'playing';
            document.getElementById('gameStatus').textContent = '⚔️ FIGHT!';
            
            // Update player positions
            data.players.forEach(p => {
                if (this.players[p.id]) {
                    this.players[p.id].position = p.position;
                    this.players[p.id].health = p.health;
                }
            });
        });
        
        this.socket.on('player-moved', (data) => {
            if (this.players[data.playerId] && data.playerId !== this.socket.id) {
                this.players[data.playerId].position = data.position;
                this.players[data.playerId].direction = data.direction;
                this.players[data.playerId].isAttacking = data.isAttacking;
            }
        });
        
        this.socket.on('player-attacked', (data) => {
            const player = this.players[data.playerId];
            if (player) {
                player.attack();
                
                if (data.result && data.result.hit) {
                    // Show hit effect
                    this.showHitEffect(data.result.targetPlayer);
                }
            }
        });
        
        this.socket.on('player-damaged', (data) => {
            if (this.players[data.playerId]) {
                this.players[data.playerId].health = data.health;
                this.updateHealthBars();
            }
        });
        
        this.socket.on('score-update', (data) => {
            this.gameState.scores = data.scores;
            this.updateScoreDisplay();
        });
        
        this.socket.on('game-end', (data) => {
            this.gameState.status = 'finished';
            document.getElementById('gameStatus').textContent = `🏆 ${data.winner.name} wins!`;
        });
        
        this.socket.on('error', (message) => {
            alert(message);
        });
        
        // Join room
        this.socket.emit('join-room', {
            roomId: this.roomId,
            playerName: this.playerName,
            character: this.character
        });
    }
    
    setupControls() {
        this.controls.setup();
        
        // Movement
        this.controls.on('move', (direction, velocity) => {
            if (this.localPlayer && this.gameState.status === 'playing') {
                const pos = { ...this.localPlayer.position };
                pos.x += velocity.x;
                pos.y += velocity.y;
                
                // Boundaries
                pos.x = Math.max(20, Math.min(880, pos.x));
                pos.y = Math.max(20, Math.min(580, pos.y));
                
                this.localPlayer.position = pos;
                this.localPlayer.direction = direction;
                
                this.socket.emit('player-move', {
                    roomId: this.roomId,
                    position: pos,
                    direction: direction,
                    velocity: velocity,
                    isAttacking: this.localPlayer.isAttacking
                });
            }
        });
        
        // Attack
        this.controls.on('attack', (attackType) => {
            if (this.localPlayer && this.gameState.status === 'playing') {
                this.localPlayer.attack();
                this.socket.emit('player-attack', {
                    roomId: this.roomId,
                    attackType: attackType
                });
            }
        });
    }
    
    setupUI() {
        document.getElementById('exitGameBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to exit?')) {
                window.location.href = '/';
            }
        });
    }
    
    setupChat() {
        const input = document.getElementById('chatInput');
        const button = document.getElementById('sendChatBtn');
        const messages = document.getElementById('chatMessages');
        
        const sendMessage = () => {
            const message = input.value.trim();
            if (message) {
                this.socket.emit('chat-message', {
                    roomId: this.roomId,
                    message: message
                });
                input.value = '';
                // Show own message
                this.addChatMessage('You', message);
            }
        };
        
        button.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        this.socket.on('chat-message', (data) => {
            this.addChatMessage(data.playerName, data.message);
        });
    }
    
    addChatMessage(sender, message) {
        const messages = document.getElementById('chatMessages');
        const div = document.createElement('div');
        div.textContent = `${sender}: ${message}`;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
        
        // Keep only last 50 messages
        while (messages.children.length > 50) {
            messages.removeChild(messages.firstChild);
        }
    }
    
    startGameLoop() {
        const gameLoop = () => {
            this.update();
            this.render();
            requestAnimationFrame(gameLoop);
        };
        gameLoop();
    }
    
    update() {
        // Update local player
        if (this.localPlayer) {
            this.localPlayer.update();
        }
        
        // Update other players
        Object.values(this.players).forEach(player => {
            if (player.id !== this.socket.id) {
                player.update();
            }
        });
    }
    
    render() {
        const ctx = this.ctx;
        const canvas = this.canvas;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw background
        this.drawBackground(ctx);
        
        // Draw players
        const sortedPlayers = Object.values(this.players).sort((a, b) => a.position.y - b.position.y);
        sortedPlayers.forEach(player => {
            player.draw(ctx);
        });
        
        // Draw UI
        this.drawUI(ctx);
        
        // Draw effects
        this.drawEffects(ctx);
    }
    
    drawBackground(ctx) {
        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, 600);
        gradient.addColorStop(0, '#2d1b4e');
        gradient.addColorStop(0.5, '#1a1a2e');
        gradient.addColorStop(1, '#0f3460');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 900, 600);
        
        // Ground
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(0, 550, 900, 50);
        
        // Grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        for (let x = 0; x < 900; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 600);
            ctx.stroke();
        }
        for (let y = 0; y < 600; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(900, y);
            ctx.stroke();
        }
    }
    
    drawUI(ctx) {
        // Draw room info
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '12px Arial';
        ctx.fillText(`Room: ${this.roomId}`, 10, 20);
    }
    
    drawEffects(ctx) {
        // TODO: Draw hit effects, particles, etc.
    }
    
    updateHealthBars() {
        const players = Object.values(this.players);
        if (players.length >= 2) {
            const p1 = players[0];
            const p2 = players[1];
            
            document.querySelector('#player1Health .health-fill').style.width = `${p1.health}%`;
            document.querySelector('#player1Health .health-text').textContent = `${p1.name}: ${Math.round(p1.health)}%`;
            
            document.querySelector('#player2Health .health-fill').style.width = `${p2.health}%`;
            document.querySelector('#player2Health .health-text').textContent = `${p2.name}: ${Math.round(p2.health)}%`;
        }
    }
    
    updateScoreDisplay() {
        const scores = this.gameState.scores;
        const players = Object.values(this.players);
        if (players.length >= 2) {
            document.getElementById('scoreDisplay').textContent = 
                `Score: ${scores[players[0].id] || 0} - ${scores[players[1].id] || 0}`;
        }
    }
    
    updatePlayerList(players) {
        document.getElementById('playerCount').textContent = `Players: ${players.length}/2`;
    }
    
    showHitEffect(playerId) {
        // Visual feedback for hit
        const player = this.players[playerId];
        if (player) {
            player.hitFlash = true;
            setTimeout(() => {
                player.hitFlash = false;
            }, 200);
        }
    }
}

// Start game when page loads
window.addEventListener('load', () => {
    const game = new Game();
});