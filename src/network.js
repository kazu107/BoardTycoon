const network = (() => {
    let socket;
    const eventListeners = {
        message: [],
        open: [],
        close: [],
        error: [],
    };

    const connect = () => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        socket = new WebSocket(`${protocol}//${host}`);

        socket.addEventListener('open', (event) => {
            console.log('WebSocket connection established');
            emit('open', event);
        });

        socket.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            console.log('Received message:', data);
            emit('message', data);
        });

        socket.addEventListener('close', (event) => {
            console.log('WebSocket connection closed');
            emit('close', event);
        });

        socket.addEventListener('error', (event) => {
            console.error('WebSocket error:', event);
            emit('error', event);
        });
    };

    const send = (type, payload) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({ type, payload });
            socket.send(message);
        } else {
            console.error('WebSocket is not connected.');
        }
    };

    const on = (eventName, listener) => {
        if (eventListeners[eventName]) {
            eventListeners[eventName].push(listener);
        }
    };

    const off = (eventName, listener) => {
        if (eventListeners[eventName]) {
            const index = eventListeners[eventName].indexOf(listener);
            if (index > -1) {
                eventListeners[eventName].splice(index, 1);
            }
        }
    };

    const emit = (eventName, data) => {
        if (eventListeners[eventName]) {
            eventListeners[eventName].forEach(listener => listener(data));
        }
    };

    return {
        connect,
        send,
        on,
        off,
    };
})();
