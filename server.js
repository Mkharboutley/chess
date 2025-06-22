import { WebSocketServer } from 'ws';
import { ChessGame } from './chessGame.js';
const wss = new WebSocketServer({ port: 8080 });
const games = {}; // Store multiple games by ID
const clients = {}; // Store clients by their connection
console.log('WebSocket server started on port 8080');
// Generate a unique ID for games and clients
const generateId = () => Math.random().toString(36).substr(2, 6).toUpperCase();
const broadcastToGame = (gameId, message) => {
  const game = games[gameId];
  if (game) {
    game.players.forEach(playerId => {
      const client = clients[playerId];
      if (client && client.ws.readyState === client.ws.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }
};
wss.on('connection', (ws) => {
  const clientId = generateId();
  clients[clientId] = { ws, name: null, gameId: null };
  console.log(`Client ${clientId} connected.`);
  ws.on('message', (message) => {
    let parsedMessage;
    try {
        parsedMessage = JSON.parse(message.toString());
    } catch (e) {
        console.error("Failed to parse message:", message.toString());
        return;
    }
    const { type, payload } = parsedMessage;
    const client = clients[clientId];
    switch (type) {
      case 'createGame': {
        const gameId = generateId();
        const game = {
          id: gameId,
          chess: new ChessGame(),
          players: [clientId],
          playerNames: { [clientId]: payload.playerName }
        };
        games[gameId] = game;
        client.gameId = gameId;
        client.name = payload.playerName;
        
        ws.send(JSON.stringify({ type: 'gameCreated', payload: { gameId, color: 'white' } }));
        console.log(`Game ${gameId} created by ${client.name} (${clientId}).`);
        break;
      }
      case 'joinGame': {
        const { gameId, playerName } = payload;
        const game = games[gameId];
        if (game && game.players.length === 1) {
          game.players.push(clientId);
          game.playerNames[clientId] = playerName;
          client.gameId = gameId;
          client.name = playerName;
          ws.send(JSON.stringify({ type: 'joinedGame', payload: { gameId, color: 'black', opponentName: game.playerNames[game.players[0]] } }));
          
          const opponentId = game.players[0];
          const opponentClient = clients[opponentId];
          opponentClient.ws.send(JSON.stringify({ type: 'gameStart', payload: { opponentName: client.name } }));
          
          console.log(`${client.name} (${clientId}) joined game ${gameId}.`);
        } else {
          ws.send(JSON.stringify({ type: 'error', payload: 'Game not found or is full.' }));
        }
        break;
      }
      case 'move': {
        const game = games[client.gameId];
        if (!game) return;
        const playerColor = game.players.indexOf(clientId) === 0 ? 'white' : 'black';
        if (playerColor !== game.chess.currentPlayer) return;
        const { from, to } = payload;
        if (game.chess.makeMove(from.row, from.col, to.row, to.col)) {
          broadcastToGame(client.gameId, { type: 'move', payload });
          if (['stalemate', 'checkmate', 'draw_repetition'].includes(game.chess.gameStatus)) {
            const reason = game.chess.gameStatus;
            const winner = game.chess.gameStatus === 'checkmate' ? (game.chess.currentPlayer === 'white' ? 'black' : 'white') : null;
            broadcastToGame(client.gameId, { type: 'gameOver', payload: { reason, winner } });
          }
        }
        break;
      }
      case 'promote': {
        const game = games[client.gameId];
        if (!game || game.chess.gameStatus !== 'promoting') return;
        game.chess.promotePawn(payload.pieceType);
        broadcastToGame(client.gameId, { type: 'promote', payload });
        break;
      }
      case 'reset': {
        const game = games[client.gameId];
        if (!game) return;
        game.chess.reset();
        broadcastToGame(client.gameId, { type: 'reset' });
        break;
      }
      case 'resign': {
        const game = games[client.gameId];
        if (!game) return;
        broadcastToGame(client.gameId, { type: 'opponentResigned', payload: { resigner: client.name } });
        delete games[client.gameId];
        break;
      }
      case 'proposeDraw': {
        const game = games[client.gameId];
        const opponentId = game.players.find(id => id !== clientId);
        if (clients[opponentId]) {
            clients[opponentId].ws.send(JSON.stringify({ type: 'drawProposed' }));
        }
        break;
      }
      case 'acceptDraw': {
          if (!client.gameId) return;
          broadcastToGame(client.gameId, { type: 'gameDraw' });
          delete games[client.gameId];
          break;
      }
      case 'rejectDraw': {
        const game = games[client.gameId];
        const opponentId = game.players.find(id => id !== clientId);
        if (clients[opponentId]) {
            clients[opponentId].ws.send(JSON.stringify({ type: 'drawRejected' }));
        }
        break;
      }
    }
  });
  ws.on('close', () => {
    const client = clients[clientId];
    if (client && client.gameId && games[client.gameId]) {
      broadcastToGame(client.gameId, { type: 'opponentDisconnect' });
      delete games[client.gameId];
    }
    delete clients[clientId];
    console.log(`Client ${clientId} disconnected.`);
  });
  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
  });
});