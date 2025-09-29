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
    if (!room) return;
    room.players.forEach(player => {
        if (player.ws && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify(message));
        }
    });
}

function getPlayerList(room) {
    return room.players.map(p => ({ id: p.id, name: p.name, shortName: `P${p.id + 1}` }));
}

function checkIfCanStart(room) {
    const host = room.players.find(p => p.id === room.hostId);
    if (host && host.ws) {
        const canStart = room.players.length === room.settings.numPlayers;
        host.ws.send(JSON.stringify({ type: 'canStartGame', payload: { canStart } }));
    }
}

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        const { type, payload } = data;
        let { roomId, playerId } = ws;
        let room = rooms[roomId];

        if (type === 'createRoom') {
            const newRoomId = generateRoomId();
            const player = { id: 0, ws: ws, name: payload.hostName || 'Player 1' };
            rooms[newRoomId] = {
                players: [player],
                hostId: player.id,
                gameState: null,
                settings: payload
            };
            ws.roomId = newRoomId;
            ws.playerId = player.id;
            room = rooms[newRoomId];
            ws.send(JSON.stringify({ type: 'roomCreated', payload: { roomId: newRoomId } }));
            broadcast(room, { type: 'playerJoined', payload: { players: getPlayerList(room) } });
            checkIfCanStart(room);
            console.log(`Room ${newRoomId} created by ${player.name}`);
            return;
        } else if (type === 'joinRoom') {
            const roomToJoin = rooms[payload.roomId];
            if (roomToJoin && roomToJoin.players.length < roomToJoin.settings.numPlayers) {
                const newPlayerId = roomToJoin.players.length;
                const player = { id: newPlayerId, ws: ws, name: payload.name || `Player ${newPlayerId + 1}` };
                roomToJoin.players.push(player);
                ws.roomId = payload.roomId;
                ws.playerId = newPlayerId;

                broadcast(roomToJoin, { type: 'playerJoined', payload: { players: getPlayerList(roomToJoin) } });
                ws.send(JSON.stringify({ type: 'assignPlayerId', payload: { playerId: newPlayerId, settings: roomToJoin.settings } }));
                checkIfCanStart(roomToJoin);
                console.log(`${player.name} joined room ${payload.roomId}`);
            } else {
                ws.send(JSON.stringify({ type: 'error', payload: { message: 'Room not found or is full' } }));
            }
            return;
        }

        if (!room) { return; }

        if (type === 'changeSetting') {
            if (playerId === room.hostId) {
                room.settings[payload.key] = payload.value;
                broadcast(room, { type: 'roomSettingsUpdate', payload: { settings: room.settings } });
                checkIfCanStart(room);
            }
        } else if (type === 'startGame') {
            if (room.hostId === playerId) {
                const { numPlayers, numAi, winTarget } = room.settings;
                const playerNames = room.players.map(p => p.name);
                room.gameState = gameLogic.createInitialGameState(numPlayers, numAi, winTarget, playerNames);

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
                // ... reset logic
            }

            if (payload.type === 'market') {
                gameLogic.handleMarketAction(room.gameState, playerIndex, payload.payload.transactions);
                broadcast(room, { type: 'gameStateUpdate', payload: { gameState: room.gameState } });
                return;
            }

            if (room.gameState && playerIndex === room.gameState.cur) {
                gameLogic.handleGameAction(room.gameState, payload);
                broadcast(room, { type: 'gameStateUpdate', payload: { gameState: room.gameState } });
            }
        }
    });

    ws.on('close', () => {
        const { roomId, playerId } = ws;
        const room = rooms[roomId];
        if (room) {
            room.players = room.players.filter(p => p.id !== playerId);
            if (room.players.length === 0) {
                delete rooms[roomId];
                console.log(`Room ${roomId} is empty and has been deleted.`);
            } else {
                if (room.hostId === playerId) {
                    room.hostId = room.players[0].id;
                }
                broadcast(room, { type: 'playerLeft', payload: { players: getPlayerList(room) } });
                checkIfCanStart(room);
            }
        }
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
