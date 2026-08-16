class GameState {
  constructor() {
    this.games = new Map();
    this.constants = {
      MAX_HEALTH: 100,
      ATTACK_COOLDOWN: 500, // milliseconds
      DAMAGE: {
        light: 10,
        heavy: 20,
        special: 30
      }
    };
  }

  initializeGame(roomId, players) {
    const game = {
      roomId,
      players: players.map(p => ({
        ...p,
        health: this.constants.MAX_HEALTH,
        position: { x: 0, y: 0 },
        direction: 'right',
        velocity: { x: 0, y: 0 },
        isAttacking: false,
        attackCooldown: 0,
        score: 0,
        combos: 0,
        lastAttackTime: 0
      })),
      startedAt: Date.now(),
      lastUpdate: Date.now(),
      status: 'playing'
    };

    // Set initial positions
    if (game.players.length >= 2) {
      game.players[0].position = { x: 200, y: 300 };
      game.players[1].position = { x: 600, y: 300 };
      game.players[1].direction = 'left';
    }

    this.games.set(roomId, game);
    return game;
  }

  getState(roomId) {
    return this.games.get(roomId) || null;
  }

  updatePlayer(roomId, playerId, updates) {
    const game = this.games.get(roomId);
    if (!game) return false;

    const player = game.players.find(p => p.id === playerId);
    if (!player) return false;

    Object.assign(player, updates);
    return true;
  }

  handleAttack(roomId, playerId, attackType) {
    const game = this.games.get(roomId);
    if (!game) return null;

    const attacker = game.players.find(p => p.id === playerId);
    if (!attacker) return null;

    const now = Date.now();
    if (now - attacker.lastAttackTime < this.constants.ATTACK_COOLDOWN) {
      return { hit: false, reason: 'cooldown' };
    }

    attacker.lastAttackTime = now;
    attacker.isAttacking = true;

    // Check for hit on other players
    const damage = this.constants.DAMAGE[attackType] || 10;
    let hit = false;
    let hitPlayer = null;

    for (const player of game.players) {
      if (player.id !== playerId) {
        const distance = this.calculateDistance(attacker.position, player.position);
        if (distance < 80) { // Attack range
          hit = true;
          hitPlayer = player;
          player.health = Math.max(0, player.health - damage);
          
          // Update score
          attacker.score += 10;
          attacker.combos += 1;
          
          // Reset combo if player is defeated
          if (player.health <= 0) {
            attacker.combos = 0;
            game.status = 'finished';
          }
          
          break;
        }
      }
    }

    // Reset attack after animation
    setTimeout(() => {
      attacker.isAttacking = false;
    }, 200);

    return {
      hit,
      damage,
      targetPlayer: hitPlayer ? hitPlayer.id : null,
      targetHealth: hitPlayer ? hitPlayer.health : null,
      attackerCombo: attacker.combos
    };
  }

  calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  applyDamage(roomId, playerId, damage, attackerId) {
    const game = this.games.get(roomId);
    if (!game) return false;

    const player = game.players.find(p => p.id === playerId);
    if (!player) return false;

    player.health = Math.max(0, player.health - damage);
    
    // Check if player is defeated
    if (player.health <= 0) {
      const attacker = game.players.find(p => p.id === attackerId);
      if (attacker) {
        attacker.score += 50;
      }
      game.status = 'finished';
    }

    return true;
  }

  getPlayerHealth(roomId, playerId) {
    const game = this.games.get(roomId);
    if (!game) return 0;

    const player = game.players.find(p => p.id === playerId);
    return player ? player.health : 0;
  }

  getScores(roomId) {
    const game = this.games.get(roomId);
    if (!game) return {};

    const scores = {};
    game.players.forEach(p => {
      scores[p.id] = p.score;
    });
    return scores;
  }

  clearGame(roomId) {
    this.games.delete(roomId);
  }

  getGameStatus(roomId) {
    const game = this.games.get(roomId);
    return game ? game.status : null;
  }
}

module.exports = GameState;