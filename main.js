import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ChessGame } from './chessGame.js';
import { ChessRenderer } from './chessRenderer.js';
import { AudioManager } from './audioManager.js';
import { SocketManager } from './socketManager.js';
import { ParticleManager } from './particleManager.js';

class ChessApp {
  constructor() {
    this.loginScreen = document.getElementById('login-screen');
    this.gameContainer = document.getElementById('game-container');
    this.playerNameInput = document.getElementById('player-name');
    this.createGameBtn = document.getElementById('create-game-btn');
    this.joinGameBtn = document.getElementById('join-game-btn');
    this.gameIdInput = document.getElementById('game-id-input');
    this.gameIdContainer = document.getElementById('game-id-container');
    this.gameIdDisplay = document.getElementById('game-id-display');
    this.copyIdButton = document.getElementById('copy-id-button');
    this.drawButton = document.getElementById('draw-button');
    this.drawOfferNotification = document.getElementById('draw-offer-notification');
    this.acceptDrawButton = document.getElementById('accept-draw-button');
    this.declineDrawButton = document.getElementById('decline-draw-button');
    this.container = this.gameContainer; // Keep for renderer setup
    this.gameOverScreen = document.getElementById('game-over-screen');
    this.gameOverResult = document.getElementById('game-over-result');
    this.gameOverReason = document.getElementById('game-over-reason');
    this.newGameButton = document.getElementById('new-game-button');
    this.moveList = document.getElementById('move-list');
    this.setupScene();
    this.setupCamera();
    this.setupRenderer();
    this.setupLighting();
    
    this.chessGame = new ChessGame();
    this.particleManager = new ParticleManager(this.scene);
    this.chessRenderer = new ChessRenderer(this.scene, this.chessGame, this.particleManager);
    this.audioManager = new AudioManager();
    this.playerColor = null;
    this.isMyTurn = false;
    this.socketManager = new SocketManager('wss://rosie-ws-example.ue.r.appspot.com');
    this.setupEventListeners();
    this.setupSocket();
    this.animate();
    // Don't play sound on load, wait for game to start
  }
  
  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000); // Black background for starfield
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
    // Post-processing
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.2;
    bloomPass.strength = 0.6;
    bloomPass.radius = 0.5;
    this.composer.addPass(bloomPass);
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }
  
  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 12, -8);
    this.camera.lookAt(0, 0, 0);
  }
  
  setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    this.scene.add(ambientLight);
    
    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 15, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    this.scene.add(directionalLight);
    
    // Rim light
    const rimLight = new THREE.DirectionalLight(0x3498db, 0.5);
    rimLight.position.set(-10, 8, -5);
    this.scene.add(rimLight);
  }
  
  setupScene() {
    this.scene = new THREE.Scene();
    // Create a starfield background
    const starsGeometry = new THREE.BufferGeometry();
    const starCount = 10000;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        // Distribute stars in a sphere
        const r = 100 + Math.random() * 100;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = r * Math.cos(phi);
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starsMaterial = new THREE.PointsMaterial({
        color: 0xaaaaaa,
        size: 0.7,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    this.starfield = new THREE.Points(starsGeometry, starsMaterial);
    this.scene.add(this.starfield);
    // Add nebula background
    const textureLoader = new THREE.TextureLoader();
    // Using a public domain nebula image
    const nebulaTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/space/background.jpg');
    const nebulaGeometry = new THREE.SphereGeometry(500, 64, 64);
    const nebulaMaterial = new THREE.MeshBasicMaterial({
      map: nebulaTexture,
      side: THREE.BackSide,
      fog: false, // Ensure the nebula isn't affected by scene fog
    });
    this.nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
    this.scene.add(this.nebula);
  }
  
  setupEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize());
    this.renderer.domElement.addEventListener('click', (event) => this.onMouseClick(event));
    
    // Login screen buttons
    this.createGameBtn.addEventListener('click', () => this.createGame());
    this.joinGameBtn.addEventListener('click', () => this.joinGame());
    // Mouse move for hover effects
    this.renderer.domElement.addEventListener('mousemove', (event) => this.onMouseMove(event));
    
    // Reset button
    document.getElementById('reset-button').addEventListener('click', () => this.resetGame());
    
    // Resign button
    document.getElementById('resign-button').addEventListener('click', () => this.resignGame());
    this.drawButton.addEventListener('click', () => this.proposeDraw());
    // Copy Game ID button
    this.copyIdButton.addEventListener('click', () => this.copyGameId());
    // Promotion choice buttons
    document.getElementById('promotion-choice').addEventListener('click', (event) => {
      if (event.target.tagName === 'BUTTON') {
        const pieceType = event.target.dataset.piece;
        this.handlePromotionChoice(pieceType);
      }
    });
    // Draw offer buttons
    this.acceptDrawButton.addEventListener('click', () => {
      this.socketManager.send('acceptDraw');
      this.drawOfferNotification.style.display = 'none';
    });
    this.declineDrawButton.addEventListener('click', () => {
      this.socketManager.send('rejectDraw');
      this.drawOfferNotification.style.display = 'none';
    });
    this.newGameButton.addEventListener('click', () => this.resetGame());
  }
  
  createGame() {
    const playerName = this.playerNameInput.value.trim();
    if (!playerName) {
      alert('Please enter your name.');
      return;
    }
    this.socketManager.send('createGame', { playerName });
  }
  joinGame() {
    const playerName = this.playerNameInput.value.trim();
    const gameId = this.gameIdInput.value.trim().toUpperCase();
    if (!playerName) {
      alert('Please enter your name.');
      return;
    }
    if (!gameId) {
      alert('Please enter a Game ID to join.');
      return;
    }
    this.socketManager.send('joinGame', { playerName, gameId });
  }
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }
  
  onMouseClick(event) {
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    
    if (this.chessGame.gameStatus === 'promoting' || !this.isMyTurn) return;
    
    // If a piece is selected, this is a move attempt.
    const clickedSquare = this.chessRenderer.getClickedSquare(raycaster);
    if (!clickedSquare) {
      this.chessRenderer.clearSelection();
      return;
    }
    const { row, col } = clickedSquare;
    if (this.chessGame.selectedSquare) {
      const from = { ...this.chessGame.selectedSquare };
      const to = { row, col };
      // Send move to server for validation
      this.socketManager.send('move', { from, to });
      // Clear local selection immediately
      this.chessRenderer.clearSelection();
    } else {
      // Attempt to select a piece
      this.chessRenderer.selectSquare(row, col);
    }
    
    if (this.chessGame.gameStatus === 'promoting') {
      this.showPromotionDialog();
      this.audioManager.playSound('promote');
    }
  }
  
  onMouseMove(event) {
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    
    this.chessRenderer.handleHover(raycaster);
  }
  
  resetGame() {
    // Reload the page to go back to the login screen
    window.location.reload();
  }
  
  resignGame() {
    this.socketManager.send('resign');
    this.isMyTurn = false;
    // The server will notify the other player, who will see the gameOver screen.
    // For the resigning player, we can show a simple message.
    document.getElementById('status').textContent = 'You resigned.';
    this.showGameOverScreen('You Lose', 'You resigned the game.');
  }
  proposeDraw() {
    this.socketManager.send('proposeDraw');
    document.getElementById('status').textContent = 'Draw offer sent.';
    this.drawButton.disabled = true;
  }
  showPromotionDialog() {
    document.getElementById('promotion-choice').style.display = 'flex';
  }
  handlePromotionChoice(pieceType) {
    document.getElementById('promotion-choice').style.display = 'none';
    const { row, col } = this.chessGame.promotionSquare;
    this.chessGame.promotePawn(pieceType);
    this.chessRenderer.promotePawn(row, col, pieceType);
    this.socketManager.send('promote', { pieceType });
    if (this.chessGame.gameStatus === 'check') {
      this.audioManager.playSound('check');
    } else {
      this.audioManager.playSound('move');
    }
  }
  copyGameId() {
    const gameId = this.gameIdDisplay.textContent;
    if (navigator.clipboard && gameId) {
      navigator.clipboard.writeText(gameId).then(() => {
        this.copyIdButton.textContent = 'Copied!';
        this.copyIdButton.style.background = '#16a085';
        setTimeout(() => {
          this.copyIdButton.textContent = 'Copy';
          this.copyIdButton.style.background = '#2ecc71';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy Game ID.');
      });
    }
  }
  handleMoveSound(moveResult) {
    if (this.chessGame.gameStatus === 'check') {
      this.audioManager.playSound('check');
    } else if (moveResult.castled) {
      this.audioManager.playSound('castle');
    } else if (moveResult.captured) {
      this.audioManager.playSound('capture');
    } else {
      this.audioManager.playSound('move');
    }
  }
  updateCheckStatus() {
    if (this.chessGame.gameStatus === 'check') {
        this.chessRenderer.showCheckIndicator();
    } else {
        this.chessRenderer.clearCheckIndicator();
    }
  }
  updateCapturedPiecesUI() {
    const pieceToUnicode = {
      'pawn': '♙', 'rook': '♖', 'knight': '♘', 'bishop': '♗', 'queen': '♕', 'king': '♔'
    };
    const whiteCapturedDiv = document.getElementById('white-captured');
    const blackCapturedDiv = document.getElementById('black-captured');
    
    whiteCapturedDiv.innerHTML = '';
    blackCapturedDiv.innerHTML = '';
    this.chessGame.capturedPieces.white.forEach(piece => {
        const span = document.createElement('span');
        span.textContent = pieceToUnicode[piece.type];
        span.style.color = '#2F2F2F';
        whiteCapturedDiv.appendChild(span);
    });
    
    this.chessGame.capturedPieces.black.forEach(piece => {
        const span = document.createElement('span');
        span.textContent = pieceToUnicode[piece.type];
        span.style.color = '#FFFFF0';
        blackCapturedDiv.appendChild(span);
    });
  }
  
  updateMoveHistoryUI() {
    this.moveList.innerHTML = '';
    this.chessGame.moveHistory.forEach((move, index) => {
        const turn = Math.floor(index / 2) + 1;
        const color = index % 2 === 0 ? 'W' : 'B';
        const li = document.createElement('li');
        li.textContent = `${turn}. ${color}: ${move}`;
        this.moveList.appendChild(li);
    });
    // Auto-scroll to the latest move
    this.moveList.parentElement.scrollTop = this.moveList.parentElement.scrollHeight;
  }
  animate() {
    requestAnimationFrame(() => this.animate());
    if (this.starfield) {
        this.starfield.rotation.y += 0.0001;
        this.starfield.rotation.x += 0.00005;
    }
    if (this.nebula) {
        this.nebula.rotation.y += 0.00008;
        this.nebula.rotation.x += 0.00004;
    }
    this.chessRenderer.update();
    this.particleManager.update();
    // this.renderer.render(this.scene, this.camera);
    this.composer.render();
  }
  setupSocket() {
    this.socketManager.on('gameCreated', ({ gameId, color }) => {
      this.loginScreen.style.display = 'none';
      this.gameContainer.style.display = 'block';
      this.onWindowResize(); // Adjust canvas size
      
      this.playerColor = color;
      this.gameIdDisplay.textContent = gameId;
      this.gameIdContainer.style.display = 'flex';
      
      document.getElementById('status').textContent = `Waiting for opponent... Share Game ID: ${gameId}`;
      this.audioManager.playSound('gameStart');
    });
    
    this.socketManager.on('joinedGame', ({ gameId, color, opponentName }) => {
        this.loginScreen.style.display = 'none';
        this.gameContainer.style.display = 'block';
        this.onWindowResize(); // Adjust canvas size
        
        this.playerColor = color;
        this.isMyTurn = this.playerColor === 'white';
        const statusText = this.isMyTurn ? "Game started. It's your turn." : `Game started vs ${opponentName}. Waiting for their move.`;
        document.getElementById('status').textContent = statusText;
        
        if (color === 'black') {
            this.camera.position.set(0, 12, 8);
            this.camera.lookAt(0, 0, 0);
        }
    });
    this.socketManager.on('gameStart', ({ opponentName }) => {
      this.gameIdContainer.style.display = 'none'; // Hide the Game ID display
      this.isMyTurn = this.playerColor === 'white';
      const statusText = this.isMyTurn ? `Game started vs ${opponentName}. It's your turn.` : "Game started. Waiting for opponent's move.";
      document.getElementById('status').textContent = statusText;
    });
    this.socketManager.on('opponentDisconnect', () => {
      this.isMyTurn = false;
      document.getElementById('status').textContent = 'Opponent disconnected. Game over.';
    });
    this.socketManager.on('move', (move) => {
      // The server has validated this move, so we can apply it locally.
      const { from, to } = move;
      const moveDetails = this.chessGame.getMoveDetails(from.row, from.col, to.row, to.col);
      
      this.chessGame.makeMove(from.row, from.col, to.row, to.col);
      this.chessRenderer.animateMove(from.row, from.col, to.row, to.col);
      this.chessRenderer.highlightLastMove(move);
      this.handleMoveSound(moveDetails);
      this.updateCheckStatus();
      this.updateCapturedPiecesUI();
      this.updateMoveHistoryUI();
      this.isMyTurn = this.chessGame.currentPlayer === this.playerColor;
      if (this.chessGame.gameStatus === 'promoting') {
        if (this.isMyTurn) {
          this.showPromotionDialog();
        } else {
          document.getElementById('status').textContent = "Opponent is promoting...";
        }
      } else if (this.chessGame.gameStatus === 'checkmate' || this.chessGame.gameStatus === 'stalemate') {
          // Game is over, no one's turn
          this.isMyTurn = false;
      } else {
          document.getElementById('status').textContent = this.isMyTurn ? "It's your turn." : "Waiting for opponent's move.";
      }
    });
    this.socketManager.on('promote', ({ pieceType }) => {
      // Server validated promotion, apply it locally.
      const { row, col } = this.chessGame.promotionSquare;
      this.chessGame.promotePawn(pieceType);
      this.chessRenderer.promotePawn(row, col, pieceType);
      this.updateCheckStatus();
      this.isMyTurn = this.chessGame.currentPlayer === this.playerColor;
      document.getElementById('status').textContent = this.isMyTurn ? "It's your turn." : "Waiting for opponent's move.";
    });
    this.socketManager.on('reset', () => {
      this.chessGame.reset();
      this.chessRenderer.reset();
      this.gameOverScreen.style.display = 'none';
      this.audioManager.playSound('gameStart');
      this.updateCapturedPiecesUI();
      this.updateMoveHistoryUI();
      this.chessRenderer.clearCheckIndicator();
      this.chessRenderer.clearLastMoveHighlight();
      
      // Reset turn logic and UI
      this.isMyTurn = this.playerColor === 'white';
      const statusText = this.isMyTurn ? "Game started. It's your turn." : "Game started. Waiting for opponent's move.";
      document.getElementById('status').textContent = statusText;
    });
    this.socketManager.on('opponentResigned', () => {
      this.isMyTurn = false;
      this.showGameOverScreen('You Win!', 'Your opponent has resigned.');
      this.chessRenderer.clearCheckIndicator();
    });
    this.socketManager.on('gameOver', ({ reason, winner }) => {
      this.isMyTurn = false;
      this.chessRenderer.clearCheckIndicator();
      let resultText, reasonText;
      const isWinner = this.playerColor && winner && this.playerColor === winner.toLowerCase();
      switch (reason) {
        case 'stalemate':
          resultText = 'Draw';
          reasonText = 'The game is a stalemate.';
          break;
        case 'checkmate':
          resultText = isWinner ? 'You Win!' : 'You Lose';
          reasonText = `By checkmate.`;
          break;
        case 'draw_repetition':
          resultText = 'Draw';
          reasonText = 'By threefold repetition.';
          break;
        default:
          resultText = 'Game Over';
          reasonText = `Reason: ${reason}`;
      }
      this.showGameOverScreen(resultText, reasonText);
    });
    this.socketManager.on('drawProposed', () => {
        this.drawOfferNotification.style.display = 'block';
    });
    this.socketManager.on('drawRejected', () => {
        document.getElementById('status').textContent = 'Draw offer rejected. Your turn.';
        this.drawButton.disabled = false;
    });
    this.socketManager.on('gameDraw', () => {
        this.isMyTurn = false;
        this.showGameOverScreen('Draw', 'By mutual agreement.');
        this.chessRenderer.clearCheckIndicator();
    });
    // Don't connect automatically on load
    this.socketManager.connect();
  }
  showGameOverScreen(result, reason) {
    this.gameOverResult.textContent = result;
    this.gameOverReason.textContent = reason;
    this.gameOverScreen.style.display = 'flex';
    // Trigger particle effects based on the result
    if (result.toLowerCase().includes('win')) {
      this.particleManager.createGameOverEffect('win');
    } else if (result.toLowerCase().includes('lose')) {
      this.particleManager.createGameOverEffect('lose');
    } else {
      this.particleManager.createGameOverEffect('draw');
    }
  }
}
// Initialize the game
// Only initialize the app, don't show the game screen yet.
const app = new ChessApp();