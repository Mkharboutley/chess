import * as THREE from 'three';
export class ChessRenderer {
  constructor(scene, chessGame, particleManager) {
    this.scene = scene;
    this.chessGame = chessGame;
    this.particleManager = particleManager;
    this.boardGroup = new THREE.Group();
    this.piecesGroup = new THREE.Group();
    this.highlightGroup = new THREE.Group();
    this.lastMoveHighlightGroup = new THREE.Group();
    this.checkIndicator = null;
    this.checkLight = null;
    this.animatingPieces = [];
    
    this.scene.add(this.boardGroup);
    this.scene.add(this.piecesGroup);
    this.scene.add(this.highlightGroup);
    this.scene.add(this.lastMoveHighlightGroup);
    
    this.createBoard();
    this.createPieces();
    this.setupRaycasting();
  }
  reset() {
    // Clear pieces from scene
    this.piecesGroup.children.forEach(child => this.piecesGroup.remove(child));
    this.piecesGroup.clear();
    
    // Recreate pieces
    this.createPieces();
    this.updateClickableObjects();
    this.clearSelection();
  }
  
  clearLastMoveHighlight() {
    this.lastMoveHighlightGroup.children.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    });
    this.lastMoveHighlightGroup.clear();
  }
  
  createBoard() {
    // Pedestal
    const pedestalGroup = new THREE.Group();
    const pedestalMaterial = new THREE.MeshStandardMaterial({
      color: 0x4B3A26, // Darker wood/stone color
      roughness: 0.8,
      metalness: 0.2
    });
    const createCylinder = (radiusTop, radiusBottom, height, y, material) => {
        const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 64);
        const cylinder = new THREE.Mesh(geometry, material);
        cylinder.position.y = y;
        cylinder.receiveShadow = true;
        cylinder.castShadow = true;
        pedestalGroup.add(cylinder);
        return cylinder;
    };
    
    // Bottom base
    createCylinder(5.5, 5.5, 0.2, -0.6, pedestalMaterial);
    // Tapered middle section
    createCylinder(4.5, 5.5, 0.5, -0.25, pedestalMaterial);
    // Top plate support
    createCylinder(4.3, 4.3, 0.2, 0.1, pedestalMaterial);
    
    // Top plate (where squares sit)
    const boardGeometry = new THREE.BoxGeometry(8.5, 0.2, 8.5);
    const boardMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const board = new THREE.Mesh(boardGeometry, boardMaterial);
    board.position.y = 0.2;
    board.receiveShadow = true;
    pedestalGroup.add(board);
    
    this.boardGroup.add(pedestalGroup);
    // Chess squares
    const textureLoader = new THREE.TextureLoader();
    const lightWoodTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/hardwood2_diffuse.jpg');
    const darkWoodTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/wood/parkay_512.jpg');
    
    this.squares = [];
    for (let row = 0; row < 8; row++) {
      this.squares[row] = [];
      for (let col = 0; col < 8; col++) {
        const squareGeometry = new THREE.BoxGeometry(0.95, 0.05, 0.95);
        const isLight = (row + col) % 2 === 0;
        const squareMaterial = new THREE.MeshLambertMaterial({ 
          map: isLight ? lightWoodTexture : darkWoodTexture
        });
        
        const square = new THREE.Mesh(squareGeometry, squareMaterial);
        square.position.set(col - 3.5, 0.325, row - 3.5);
        square.receiveShadow = true;
        square.userData = { row, col, type: 'square' };
        
        this.squares[row][col] = square;
        this.boardGroup.add(square);
      }
    }
  }
  
  createPieces() {
    this.pieces = Array(8).fill(null).map(() => Array(8).fill(null));
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.chessGame.board[row][col];
        if (piece) {
          this.pieces[row][col] = this.createPiece(piece.type, piece.color, row, col);
        }
      }
    }
  }
  
  createPiece(type, color, row, col) {
    const pieceGroup = new THREE.Group();
    const material = new THREE.MeshPhongMaterial({
      color: color === 'white' ? 0xFFFFF0 : 0x2F2F2F,
      shininess: 30,
      emissive: 0x000000,
    });
    const createPart = (geometry, y, parent = pieceGroup) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = y;
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    
    let base, body, head;
    switch (type) {
      case 'pawn':
        base = createPart(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12), 0);
        body = createPart(new THREE.CylinderGeometry(0.1, 0.15, 0.3, 12), 0.2);
        head = createPart(new THREE.SphereGeometry(0.12, 12, 12), 0.45);
        break;
      case 'rook':
        base = createPart(new THREE.CylinderGeometry(0.22, 0.22, 0.15, 12), 0);
        body = createPart(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 12), 0.35);
        head = createPart(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 12), 0.65);
        for (let i = 0; i < 6; i++) {
          const notchGeo = new THREE.BoxGeometry(0.1, 0.15, 0.1);
          const notch = new THREE.Mesh(notchGeo, material);
          const angle = (i / 6) * Math.PI * 2;
          notch.position.set(Math.cos(angle) * 0.18, 0.7, Math.sin(angle) * 0.18);
          notch.rotation.y = angle;
          pieceGroup.add(notch);
        }
        break;
      case 'knight':
        base = createPart(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 12), 0);
        body = createPart(new THREE.BoxGeometry(0.2, 0.5, 0.2), 0.3);
        head = new THREE.Group();
        const neck = createPart(new THREE.BoxGeometry(0.15, 0.3, 0.15), 0, head);
        neck.rotation.z = Math.PI / 6;
        const face = createPart(new THREE.BoxGeometry(0.3, 0.18, 0.15), 0.15, head);
        face.position.x = 0.1;
        head.position.set(0, 0.6, 0);
        pieceGroup.add(head);
        break;
      case 'bishop':
        base = createPart(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 12), 0);
        body = createPart(new THREE.CylinderGeometry(0.15, 0.2, 0.6, 12), 0.4);
        head = createPart(new THREE.SphereGeometry(0.15, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0.7);
        head.rotation.x = -Math.PI/2;
        const slit = createPart(new THREE.BoxGeometry(0.05, 0.1, 0.15), 0.8);
        slit.rotation.y = Math.PI / 4;
        break;
        
      case 'queen':
        base = createPart(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 16), 0);
        body = createPart(new THREE.CylinderGeometry(0.15, 0.22, 0.8, 16), 0.45);
        head = createPart(new THREE.SphereGeometry(0.15, 16, 16), 0.9);
        const crownMaterial = new THREE.MeshPhongMaterial({ color: 0xFFD700, shininess: 80 });
        for (let i = 0; i < 8; i++) {
          const spikeGeo = new THREE.ConeGeometry(0.05, 0.2, 4);
          const spike = new THREE.Mesh(spikeGeo, crownMaterial);
          const angle = (i / 8) * Math.PI * 2;
          spike.position.set(Math.cos(angle) * 0.12, 1.0, Math.sin(angle) * 0.12);
          spike.rotation.z = Math.PI;
          pieceGroup.add(spike);
        }
        break;
      case 'king':
        base = createPart(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 16), 0);
        body = createPart(new THREE.CylinderGeometry(0.2, 0.2, 0.9, 16), 0.5);
        head = createPart(new THREE.CylinderGeometry(0.22, 0.22, 0.15, 16), 1.0);
        const cross = new THREE.Group();
        const crossBarV = createPart(new THREE.BoxGeometry(0.04, 0.25, 0.04), 0.1, cross);
        const crossBarH = createPart(new THREE.BoxGeometry(0.15, 0.04, 0.04), 0.1, cross);
        cross.position.y = 1.1;
        pieceGroup.add(cross);
        break;
    }
    pieceGroup.position.set(col - 3.5, 0.5, row - 3.5);
    pieceGroup.scale.set(0.8, 0.8, 0.8);
    // Use the group as the main object for raycasting and logic
    const pieceMesh = pieceGroup;
    pieceMesh.userData = { row, col, type: 'piece', pieceType: type, color };
    // Set castShadow for all children
    pieceMesh.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        // Assign userData to children for easier click detection
        child.userData = pieceMesh.userData;
      }
    });
    this.piecesGroup.add(pieceMesh);
    return pieceMesh;
  }
  
  setupRaycasting() {
    this.raycaster = new THREE.Raycaster();
    this.clickableObjects = [];
    
    // Add all squares and pieces to clickable objects
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        this.clickableObjects.push(this.squares[row][col]);
        if (this.pieces[row][col]) {
          this.clickableObjects.push(this.pieces[row][col]);
        }
      }
    }
  }
  
  getClickedSquare(raycaster) {
    const intersects = raycaster.intersectObjects(this.clickableObjects, true);
    if (intersects.length > 0) {
      let clickedObject = intersects[0].object;
      // Traverse up to find the parent Group which holds the user data
      while (clickedObject && (!clickedObject.userData || clickedObject.userData.row === undefined)) {
        clickedObject = clickedObject.parent;
      }
      if (clickedObject && clickedObject.userData && clickedObject.userData.row !== undefined) {
        return clickedObject.userData;
      }
    }
    return null;
  }
  
  handleHover(raycaster) {
    const intersects = raycaster.intersectObjects(this.clickableObjects, true);
    
    // Reset hover effects
    if (this.hoveredPiece && this.hoveredPiece.userData.type === 'piece') {
      this.hoveredPiece.traverse(child => {
          if (child.isMesh) child.material.emissive.setHex(0x000000);
      });
      this.hoveredPiece = null;
    }
    
    if (intersects.length > 0) {
      let hoveredObject = intersects[0].object;
       while (hoveredObject && (!hoveredObject.userData || hoveredObject.userData.type !== 'piece')) {
        hoveredObject = hoveredObject.parent;
      }
      
      if (hoveredObject && hoveredObject.userData.type === 'piece') {
        this.hoveredPiece = hoveredObject;
        this.hoveredPiece.traverse(child => {
          if (child.isMesh) child.material.emissive.setHex(0x555500);
        });
      }
    }
  }
  
  selectSquare(row, col) {
    const piece = this.chessGame.board[row][col];
    // Only allow selection if it's a piece of the current player
    if (piece && piece.color === this.chessGame.currentPlayer) {
      this.chessGame.selectedSquare = { row, col };
      // Highlight selected square
      this.highlightSquare(row, col, 0x3498db);
      // Highlight valid moves
      const validMoves = this.chessGame.getValidMoves(row, col);
      validMoves.forEach(move => {
        this.highlightSquare(move.row, move.col, 0x2ecc71);
      });
    } else {
      this.clearSelection();
    }
  }
  
  clearSelection() {
    this.chessGame.selectedSquare = null;
    this.clearHighlights();
  }
  
  highlightSquare(row, col, color) {
    const highlightGeometry = new THREE.RingGeometry(0.3, 0.45, 16);
    const highlightMaterial = new THREE.MeshBasicMaterial({ 
      color, 
      transparent: true, 
      opacity: 0.7 
    });
    
    const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    highlight.position.set(col - 3.5, 0.4, row - 3.5);
    highlight.rotation.x = -Math.PI / 2;
    
    this.highlightGroup.add(highlight);
  }
  
  clearHighlights() {
    this.highlightGroup.children.forEach(child => {
      this.highlightGroup.remove(child);
    });
    this.highlightGroup.clear();
  }
  
  highlightLastMove({ from, to }) {
    this.clearLastMoveHighlight();
    
    this.addSquareHighlight(from.row, from.col, 0xf1c40f, this.lastMoveHighlightGroup, 0.4);
    this.addSquareHighlight(to.row, to.col, 0xf1c40f, this.lastMoveHighlightGroup, 0.4);
  }
  
  addSquareHighlight(row, col, color, group, opacity = 0.7) {
    const highlightGeometry = new THREE.PlaneGeometry(0.95, 0.95);
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: opacity,
      side: THREE.DoubleSide
    });
    const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    highlight.position.set(col - 3.5, 0.33, row - 3.5);
    highlight.rotation.x = -Math.PI / 2;
    group.add(highlight);
  }
  showCheckIndicator() {
    this.clearCheckIndicator(); // Clear previous one if any
    const kingColor = this.chessGame.currentPlayer;
    let kingPos = null;
    // Find the king of the current player
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.chessGame.board[row][col];
        if (piece && piece.type === 'king' && piece.color === kingColor) {
          kingPos = { row, col };
          break;
        }
      }
      if (kingPos) break;
    }
    
    if (!kingPos) return;
    const geometry = new THREE.PlaneGeometry(0.95, 0.95);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    
    this.checkIndicator = new THREE.Mesh(geometry, material);
    this.checkIndicator.position.set(kingPos.col - 3.5, 0.33, kingPos.row - 3.5);
    this.checkIndicator.rotation.x = -Math.PI / 2;
    this.scene.add(this.checkIndicator);
    // Add a pulsing red light above the king
    this.checkLight = new THREE.PointLight(0xff0000, 0, 5);
    this.checkLight.position.set(kingPos.col - 3.5, 1.8, kingPos.row - 3.5);
    this.scene.add(this.checkLight);
  }
  clearCheckIndicator() {
    if (this.checkIndicator) {
      this.scene.remove(this.checkIndicator);
      this.checkIndicator.geometry.dispose();
      this.checkIndicator.material.dispose();
      this.checkIndicator = null;
    }
    if (this.checkLight) {
        this.scene.remove(this.checkLight);
        this.checkLight.dispose();
        this.checkLight = null;
    }
  }
  
  animateMove(fromRow, fromCol, toRow, toCol) {
    const piece = this.pieces[fromRow][fromCol];
    if (!piece) return;
    
    // Capture animation
    if (this.pieces[toRow][toCol]) {
      const capturedPiece = this.pieces[toRow][toCol];
      this.particleManager.createExplosion(capturedPiece.position, capturedPiece.userData.color);
      this.animatePieceCapture(capturedPiece);
    }
    
    // En-passant capture animation
    const movedPieceData = this.chessGame.board[toRow][toCol];
    if (movedPieceData.type === 'pawn' && fromCol !== toCol && !this.pieces[toRow][toCol]) {
      const capturedPawnRow = toRow + (movedPieceData.color === 'white' ? -1 : 1);
      const capturedPawn = this.pieces[capturedPawnRow][toCol];
      if (capturedPawn) {
        this.particleManager.createExplosion(capturedPawn.position, capturedPawn.userData.color);
        this.animatePieceCapture(capturedPawn);
      }
    }
    // Move animation
    const targetX = toCol - 3.5;
    const targetZ = toRow - 3.5;
    
    this.animatePieceMove(piece, targetX, targetZ);
    
    // Handle castling animation for the rook
    const movedPiece = this.chessGame.board[toRow][toCol];
    if (movedPiece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
      if (toCol > fromCol) { // Kingside
        const rook = this.pieces[fromRow][7];
        this.animatePieceMove(rook, 5 - 3.5, toRow - 3.5);
        this.pieces[toRow][5] = rook;
        this.pieces[fromRow][7] = null;
        rook.userData.col = 5;
      } else { // Queenside
        const rook = this.pieces[fromRow][0];
        this.animatePieceMove(rook, 3 - 3.5, toRow - 3.5);
        this.pieces[toRow][3] = rook;
        this.pieces[fromRow][0] = null;
        rook.userData.col = 3;
      }
    }
    
    // Update piece position in array
    this.pieces[toRow][toCol] = piece;
    this.pieces[fromRow][fromCol] = null;
    
    // Update piece userData
    piece.userData.row = toRow;
    piece.userData.col = toCol;
    
    // Update clickable objects
    this.updateClickableObjects();
    this.updateClickableObjects();
  }
  
  promotePawn(row, col, pieceType) {
    // Remove the pawn mesh
    const pawnMesh = this.pieces[row][col];
    this.piecesGroup.remove(pawnMesh);
    
    // Create the new promoted piece mesh
    const newPiece = this.createPiece(pieceType, pawnMesh.userData.color, row, col);
    this.pieces[row][col] = newPiece;
    
    // Update clickable objects
    this.updateClickableObjects();
  }
  
  animatePieceMove(piece, targetX, targetZ) {
    const startX = piece.position.x;
    const startZ = piece.position.z;
    const duration = 500; // milliseconds
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Smooth easing
      const eased = 1 - Math.pow(1 - progress, 3);
      
      piece.position.x = startX + (targetX - startX) * eased;
      piece.position.z = startZ + (targetZ - startZ) * eased;
      piece.position.y = 0.5 + Math.sin(progress * Math.PI) * 0.3; // Arc
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        piece.position.y = 0.5;
      }
    };
    
    animate();
  }
  
  animatePieceCapture(piece) {
    const duration = 300;
    const startTime = Date.now();
    const startScale = piece.scale.clone();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      piece.scale.copy(startScale).multiplyScalar(1 - progress);
      piece.rotation.y += 0.1;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
          this.piecesGroup.remove(piece);
      }
    };
    
    animate();
  }
  
  updateClickableObjects() {
    this.clickableObjects = [];
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        this.clickableObjects.push(this.squares[row][col]);
        if (this.pieces[row][col]) {
          this.clickableObjects.push(this.pieces[row][col]);
        }
      }
    }
  }
  
  update() {
    // Update any ongoing animations
    this.animatingPieces.forEach(animation => {
      if (animation.update) {
        animation.update();
      }
    });
    // Animate check indicator
    if (this.checkIndicator) {
      const time = Date.now() * 0.005;
      const pulse = 0.4 + Math.sin(time * 3) * 0.3;
      this.checkIndicator.material.opacity = pulse;
      if (this.checkLight) {
          this.checkLight.intensity = (pulse - 0.1) * 3; // Adjust intensity based on opacity pulse
      }
    }
  }
}