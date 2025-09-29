const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const gameLogic = require('./game-logic.js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, '')));

const rooms = {};

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function broadcast(room, message) {
    room.players.forEach(player => {
        if (player.ws && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify(message));
        }
    });
}

function broadcastGameState(room) {
    broadcast(room, { type: 'gameStateUpdate', payload: { gameState: room.gameState } });
}

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        const { type, payload } = data;
        const { roomId, playerId } = ws;
        const room = rooms[roomId];

        if (type === 'createRoom') {
            const newRoomId = generateRoomId();
            const player = { id: 0, ws: ws, name: 'Player 1' };
            rooms[newRoomId] = {
                players: [player],
                hostId: player.id,
                gameState: null,
                settings: payload
            };
            ws.roomId = newRoomId;
            ws.playerId = player.id;
            ws.send(JSON.stringify({ type: 'roomCreated', payload: { roomId: newRoomId } }));
            console.log(`Room ${newRoomId} created by Player 1`);
            return;
        } else if (type === 'joinRoom') {
            const roomToJoin = rooms[payload.roomId];
            if (roomToJoin && roomToJoin.players.length < roomToJoin.settings.numPlayers) {
                const newPlayerId = roomToJoin.players.length;
                const player = { id: newPlayerId, ws: ws, name: `Player ${newPlayerId + 1}` };
                roomToJoin.players.push(player);
                ws.roomId = payload.roomId;
                ws.playerId = newPlayerId;

                const playerNames = roomToJoin.players.map(p => p.name);
                broadcast(roomToJoin, { type: 'playerJoined', payload: { players: playerNames, joinedPlayerId: newPlayerId } });
                ws.send(JSON.stringify({ type: 'assignPlayerId', payload: { playerId: newPlayerId } }));
                console.log(`Player ${player.name} joined room ${payload.roomId}`);
            } else {
                ws.send(JSON.stringify({ type: 'error', payload: { message: 'Room not found or is full' } }));
            }
            return;
        }

        if (!room) {
            console.log('No room found for client');
            return;
        }

        if (type === 'startGame') {
            if (room.hostId === playerId) {
                const { numPlayers, numAi, winTarget } = room.settings;
                room.gameState = gameLogic.createInitialGameState(numPlayers, numAi, winTarget);

                room.players.forEach(p => {
                    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
                        p.ws.send(JSON.stringify({
                            type: 'gameStarted',
                            payload: { 
                                gameState: room.gameState,
                                playerId: p.id
                            }
                        }));
                    }
                });
                console.log(`Game started in room ${roomId}`);
            }
        } else if (type === 'gameAction') {
            const playerIndex = room.players.findIndex(p => p.id === playerId);

            if (payload.type === 'reset' && playerIndex === room.hostId) {
                console.log(`Game reset by host in room ${roomId}`);
                const { numPlayers, numAi, winTarget } = room.settings;
                room.gameState = gameLogic.createInitialGameState(numPlayers, numAi, winTarget);
                room.players.forEach(p => {
                    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
                        p.ws.send(JSON.stringify({
                            type: 'gameStarted',
                            payload: { 
                                gameState: room.gameState,
                                playerId: p.id
                            }
                        }));
                    }
                });
                return;
            }

            if (room.gameState && playerIndex === room.gameState.cur) {
                gameLogic.handleGameAction(room.gameState, payload);
                broadcastGameState(room);
            }
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        const { roomId, playerId } = ws;
        if (roomId && rooms[roomId]) {
            rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== playerId);
            if (rooms[roomId].players.length === 0) {
                delete rooms[roomId];
                console.log(`Room ${roomId} is empty and has been deleted.`);
            } else {
                if (rooms[roomId].hostId === playerId) {
                    rooms[roomId].hostId = rooms[roomId].players[0].id;
                    console.log(`Host disconnected. New host is Player ${rooms[roomId].hostId + 1}`)
                }
                const playerNames = rooms[roomId].players.map(p => p.name);
                broadcast(rooms[roomId], { type: 'playerLeft', payload: { players: playerNames } });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
