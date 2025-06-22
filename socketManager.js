export class SocketManager {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.eventListeners = new Map();
  }

  connect() {
    this.socket = new WebSocket(this.url);

    this.socket.addEventListener('open', () => {
      console.log('WebSocket connected');
      this.emit('connect');
    });

    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      console.log('Received message:', message);
      this.emit(message.type, message.payload);
    });

    this.socket.addEventListener('close', () => {
      console.log('WebSocket disconnected');
      this.emit('disconnect');
    });

    this.socket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    });
  }

  on(eventName, listener) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(listener);
  }

  emit(eventName, payload) {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach(listener => listener(payload));
    }
  }

  send(type, payload) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type, payload });
      this.socket.send(message);
    } else {
      console.error('WebSocket is not connected.');
    }
  }
}