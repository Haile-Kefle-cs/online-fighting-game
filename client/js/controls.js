class Controls {
    constructor() {
        this.keys = {};
        this.listeners = {
            move: [],
            attack: []
        };
        
        this.setupKeyListeners();
    }
    
    setup() {
        // Setup is called from game.js
        this.setupKeyListeners();
    }
    
    setupKeyListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            this.handleKeyPress(e.key.toLowerCase());
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        
        // Prevent scrolling with arrow keys
        document.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }
        });
    }
    
    handleKeyPress(key) {
        // Attack keys
        if (key === 'j') {
            this.triggerAttack('light');
        } else if (key === 'k') {
            this.triggerAttack('heavy');
        } else if (key === 'l') {
            this.triggerAttack('special');
        }
    }
    
    getMovement() {
        let vx = 0, vy = 0;
        let direction = 'right';
        
        if (this.keys['w'] || this.keys['arrowup']) {
            vy = -4;
        }
        if (this.keys['s'] || this.keys['arrowdown']) {
            vy = 4;
        }
        if (this.keys['a'] || this.keys['arrowleft']) {
            vx = -4;
            direction = 'left';
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            vx = 4;
            direction = 'right';
        }
        
        // Normalize diagonal movement
        if (vx !== 0 && vy !== 0) {
            vx *= 0.707;
            vy *= 0.707;
        }
        
        return { velocity: { x: vx, y: vy }, direction };
    }
    
    triggerAttack(attackType) {
        this.listeners.attack.forEach(callback => {
            callback(attackType);
        });
    }
    
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }
    
    update() {
        const movement = this.getMovement();
        if (movement.velocity.x !== 0 || movement.velocity.y !== 0) {
            this.listeners.move.forEach(callback => {
                callback(movement.direction, movement.velocity);
            });
        }
    }
}