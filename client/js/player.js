class Player {
    constructor(id, name, character, position) {
        this.id = id;
        this.name = name;
        this.character = character;
        this.position = position || { x: 400, y: 300 };
        this.direction = 'right'; // 'left' or 'right'
        this.velocity = { x: 0, y: 0 };
        this.speed = 3;
        this.health = 100;
        this.maxHealth = 100;
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.hitFlash = false;
        this.width = 40;
        this.height = 60;
        this.gravity = 0.5;
        this.isGrounded = true;
        this.combo = 0;
        this.score = 0;
        this.animations = {
            idle: 0,
            walking: 0,
            attacking: 0
        };
        
        this.characterData = this.getCharacterData(character);
    }
    
    getCharacterData(character) {
        const characters = {
            warrior: {
                color: '#ff6b6b',
                attackDamage: 15,
                attackRange: 80,
                speed: 3,
                health: 120
            },
            ninja: {
                color: '#6bcb77',
                attackDamage: 10,
                attackRange: 70,
                speed: 4,
                health: 80
            },
            wizard: {
                color: '#4facfe',
                attackDamage: 20,
                attackRange: 120,
                speed: 2.5,
                health: 90
            },
            knight: {
                color: '#a29bfe',
                attackDamage: 12,
                attackRange: 85,
                speed: 2.8,
                health: 130
            }
        };
        
        return characters[character] || characters.warrior;
    }
    
    update() {
        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown--;
        }
        
        // Update attack animation
        if (this.isAttacking) {
            this.animations.attacking += 0.1;
            if (this.animations.attacking > 1) {
                this.isAttacking = false;
                this.animations.attacking = 0;
            }
        }
        
        // Update walking animation
        if (Math.abs(this.velocity.x) > 0 || Math.abs(this.velocity.y) > 0) {
            this.animations.walking += 0.1;
        } else {
            this.animations.walking = 0;
        }
        
        // Apply gravity
        if (!this.isGrounded) {
            this.velocity.y += this.gravity;
        }
        
        // Update position
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        
        // Floor collision
        if (this.position.y + this.height > 580) {
            this.position.y = 580 - this.height;
            this.velocity.y = 0;
            this.isGrounded = true;
        } else {
            this.isGrounded = false;
        }
        
        // Wall collision
        this.position.x = Math.max(0, Math.min(900 - this.width, this.position.x));
    }
    
    draw(ctx) {
        const x = this.position.x;
        const y = this.position.y;
        const width = this.width;
        const height = this.height;
        
        ctx.save();
        
        // Hit flash effect
        if (this.hitFlash) {
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 30;
        }
        
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x + width/2, y + height + 5, 25, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Body
        const color = this.characterData.color;
        ctx.fillStyle = this.hitFlash ? '#ff0000' : color;
        ctx.shadowColor = this.hitFlash ? '#ff0000' : 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 10;
        
        // Draw character based on direction
        ctx.translate(x + width/2, y + height/2);
        
        if (this.direction === 'left') {
            ctx.scale(-1, 1);
        }
        
        // Main body
        ctx.fillStyle = this.hitFlash ? '#ff0000' : color;
        ctx.shadowColor = this.hitFlash ? '#ff0000' : 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 10;
        
        // Draw body shape
        this.drawCharacter(ctx);
        
        // Attack effect
        if (this.isAttacking) {
            ctx.shadowColor = '#ffd93d';
            ctx.shadowBlur = 30;
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(30, 0, this.characterData.attackRange * this.animations.attacking, -0.5, 0.5);
            ctx.stroke();
            
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
            ctx.beginPath();
            ctx.arc(30, 0, this.characterData.attackRange * this.animations.attacking, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
        
        // Name tag
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x - 5, y - 25, width + 10, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, x + width/2, y - 10);
        
        // Health bar
        const healthWidth = width + 10;
        const healthX = x - 5;
        const healthY = y - 45;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(healthX, healthY, healthWidth, 8);
        ctx.fillStyle = this.health > 50 ? '#6bcb77' : this.health > 25 ? '#ffd93d' : '#ff6b6b';
        ctx.fillRect(healthX + 1, healthY + 1, (healthWidth - 2) * (this.health / this.maxHealth), 6);
    }
    
    drawCharacter(ctx) {
        // Different character designs
        switch (this.character) {
            case 'ninja':
                this.drawNinja(ctx);
                break;
            case 'wizard':
                this.drawWizard(ctx);
                break;
            case 'knight':
                this.drawKnight(ctx);
                break;
            default:
                this.drawWarrior(ctx);
        }
    }
    
    drawWarrior(ctx) {
        const w = this.width;
        const h = this.height;
        
        // Head
        ctx.fillStyle = '#fd79a8';
        ctx.beginPath();
        ctx.arc(0, -h/3, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Body
        ctx.fillStyle = '#e17055';
        ctx.fillRect(-w/3, -h/6, w*2/3, h/2);
        
        // Arms
        ctx.fillStyle = '#fd79a8';
        ctx.fillRect(-w/2, 0, 8, h/3);
        ctx.fillRect(w/2 - 8, 0, 8, h/3);
        
        // Legs
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-w/4, h/3, 8, h/3);
        ctx.fillRect(w/4 - 8, h/3, 8, h/3);
        
        // Weapon (sword)
        if (this.isAttacking) {
            ctx.fillStyle = '#ffd93d';
            ctx.fillRect(w/2, -h/4, 4, -h/2);
            ctx.fillStyle = '#ff6b6b';
            ctx.fillRect(w/2 - 3, -h/4 - 2, 10, 4);
        }
    }
    
    drawNinja(ctx) {
        const w = this.width;
        const h = this.height;
        
        // Head
        ctx.fillStyle = '#fd79a8';
        ctx.beginPath();
        ctx.arc(0, -h/3, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Headband
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-14, -h/3 - 4, 28, 4);
        
        // Body
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-w/3, -h/6, w*2/3, h/2);
        
        // Belt
        ctx.fillStyle = '#e17055';
        ctx.fillRect(-w/3, h/6, w*2/3, 4);
        
        // Arms
        ctx.fillStyle = '#fd79a8';
        ctx.fillRect(-w/2, 0, 8, h/3);
        ctx.fillRect(w/2 - 8, 0, 8, h/3);
        
        // Legs
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-w/4, h/3, 8, h/3);
        ctx.fillRect(w/4 - 8, h/3, 8, h/3);
        
        // Kunai
        if (this.isAttacking) {
            ctx.fillStyle = '#b2bec3';
            ctx.fillRect(w/2, -h/4, 2, -h/3);
            ctx.fillStyle = '#636e72';
            ctx.beginPath();
            ctx.arc(w/2 + 1, -h/4 - h/3, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    drawWizard(ctx) {
        const w = this.width;
        const h = this.height;
        
        // Head
        ctx.fillStyle = '#fd79a8';
        ctx.beginPath();
        ctx.arc(0, -h/3, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Hat
        ctx.fillStyle = '#4facfe';
        ctx.beginPath();
        ctx.moveTo(-15, -h/3 - 6);
        ctx.quadraticCurveTo(0, -h/2 - 10, 15, -h/3 - 6);
        ctx.fill();
        
        // Body
        ctx.fillStyle = '#4facfe';
        ctx.fillRect(-w/3, -h/6, w*2/3, h/2);
        
        // Robe details
        ctx.fillStyle = '#3d8bfd';
        ctx.fillRect(-w/3, h/12, w*2/3, 4);
        
        // Arms
        ctx.fillStyle = '#fd79a8';
        ctx.fillRect(-w/2, 0, 8, h/3);
        ctx.fillRect(w/2 - 8, 0, 8, h/3);
        
        // Legs
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-w/4, h/3, 8, h/3);
        ctx.fillRect(w/4 - 8, h/3, 8, h/3);
        
        // Magic staff
        ctx.fillStyle = '#ffd93d';
        ctx.fillRect(w/2, -h/4, 3, -h/2);
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(w/2 + 1, -h/4 - h/2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = '#ffd93d';
        ctx.shadowBlur = 20;
    }
    
    drawKnight(ctx) {
        const w = this.width;
        const h = this.height;
        
        // Head
        ctx.fillStyle = '#a29bfe';
        ctx.beginPath();
        ctx.arc(0, -h/3, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Helmet
        ctx.fillStyle = '#6c5ce7';
        ctx.fillRect(-14, -h/3 - 4, 28, 16);
        ctx.fillRect(-10, -h/3 - 8, 20, 6);
        ctx.fillRect(-4, -h/3 - 12, 8, 6);
        
        // Body
        ctx.fillStyle = '#6c5ce7';
        ctx.fillRect(-w/3, -h/6, w*2/3, h/2);
        
        // Armor details
        ctx.fillStyle = '#a29bfe';
        ctx.fillRect(-w/4, -h/12, w/2, 4);
        ctx.fillRect(-w/4, h/12, w/2, 4);
        
        // Shield
        ctx.fillStyle = '#a29bfe';
        ctx.fillRect(-w/2 - 4, -h/6, 8, h/3);
        ctx.fillStyle = '#6c5ce7';
        ctx.fillRect(-w/2 - 2, -h/8, 4, h/6);
        
        // Arms
        ctx.fillStyle = '#fd79a8';
        ctx.fillRect(-w/2, 0, 8, h/3);
        ctx.fillRect(w/2 - 8, 0, 8, h/3);
        
        // Legs
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-w/4, h/3, 8, h/3);
        ctx.fillRect(w/4 - 8, h/3, 8, h/3);
        
        // Sword
        if (this.isAttacking) {
            ctx.fillStyle = '#dfe6e9';
            ctx.fillRect(w/2, -h/4, 3, -h/2);
            ctx.fillStyle = '#ffd93d';
            ctx.fillRect(w/2 - 4, -h/4 - 2, 10, 4);
        }
    }
    
    attack() {
        if (this.attackCooldown <= 0) {
            this.isAttacking = true;
            this.attackCooldown = 30;
            this.animations.attacking = 0;
        }
    }
    
    takeDamage(damage) {
        this.health = Math.max(0, this.health - damage);
        this.hitFlash = true;
        setTimeout(() => {
            this.hitFlash = false;
        }, 200);
    }
}