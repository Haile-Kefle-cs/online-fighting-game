class SocketManager {
    constructor() {
        this.socket = io();
        this.id = null;
        this.eventListeners = {};
        
        this.setupSocket();
    }
    
    setupSocket() {
        this.socket.on('connect', () => {
            this.id = this.socket.id;
            console.log('Connected to server');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
        
        // Forward all events to listeners
        this.socket.onAny((event, ...args) => {
            if (this.eventListeners[event]) {
                this.eventListeners[event].forEach(callback => {
                    callback(...args);
                });
            }
        });
    }
    
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }
    
    emit(event, data) {
        if (this.socket) {
            this.socket.emit(event, data);
        }
    }
    
    getId() {
        return this.id;
    }
}