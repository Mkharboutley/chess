import { ChessPieces } from './chessPieces.js';

export class ChessGame {
  constructor() {
    this.board = this.createInitialBoard();
    this.currentPlayer = 'white';
    this.selectedSquare = null;
    this.gameStatus = 'playing';
    this.moveHistory = [];
    this.enPassantTarget = null;
    this.castlingRights = {
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true }
    };
    this.promotionSquare = null;
    this.capturedPieces = { white: [], black: [] };
    this.boardStateHistory = new Map();
  }
  
  reset() {
    this.board = this.createInitialBoard();
    this.currentPlayer = 'white';
    this.selectedSquare = null;
    this.gameStatus = 'playing';
    this.moveHistory = [];
    this.enPassantTarget = null;
    this.castlingRights = {
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true }
    };
    this.promotionSquare = null;
    this.capturedPieces = { white: [], black: [] };
    this.boardStateHistory = new Map();
    // Don't call updateGameStatus on reset, wait for game to be set up.
  }
  
  createInitialBoard() {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Place pawns
    for (let i = 0; i < 8; i++) {
      board[1][i] = { type: 'pawn', color: 'white' };
      board[6][i] = { type: 'pawn', color: 'black' };
    }
    
    // Place other pieces
    const backRow = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    for (let i = 0; i < 8; i++) {
      board[0][i] = { type: backRow[i], color: 'white' };
      board[7][i] = { type: backRow[i], color: 'black' };
    }
    
    return board;
  }
  
  isValidMove(fromRow, fromCol, toRow, toCol) {
    const piece = this.board[fromRow][fromCol];
    if (!piece || piece.color !== this.currentPlayer) return false;
    
    const targetPiece = this.board[toRow][toCol];
    if (targetPiece && targetPiece.color === piece.color) return false;
    
    // Check piece-specific movement rules
    if (!ChessPieces.isValidPieceMove(piece.type, fromRow, fromCol, toRow, toCol, this.board, this.enPassantTarget)) {
      return false;
    }
    
    // Check if move puts own king in check
    const testBoard = JSON.parse(JSON.stringify(this.board));
    testBoard[toRow][toCol] = testBoard[fromRow][fromCol];
    testBoard[fromRow][fromCol] = null;
    
    if (this.isKingInCheck(piece.color, testBoard)) {
      return false;
    }
    
    // Handle castling move validation
    if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
      return this.isValidCastle(fromRow, fromCol, toRow, toCol);
    }
    
    return true;
  }
  
  makeMove(fromRow, fromCol, toRow, toCol) {
    if (!this.isValidMove(fromRow, fromCol, toRow, toCol)) return false;
    
    const piece = this.board[fromRow][fromCol];
    const capturedPiece = { ...this.board[toRow][toCol] }; // copy to avoid reference issues
    
    // Handle en passant capture
    if (piece.type === 'pawn' && this.enPassantTarget && 
        toRow === this.enPassantTarget.row && toCol === this.enPassantTarget.col) {
      const enPassantCapturedPiece = { ...this.board[fromRow][toCol] };
      this.capturedPieces[this.currentPlayer].push(enPassantCapturedPiece);
      this.board[fromRow][toCol] = null; // Remove captured pawn
    } else if (this.board[toRow][toCol]) {
       this.capturedPieces[this.currentPlayer].push(capturedPiece);
    }
    
    // Make the move
    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;
    
    // Check for pawn promotion
    if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
      this.gameStatus = 'promoting';
      this.promotionSquare = { row: toRow, col: toCol };
      // Don't switch player or update status yet, wait for promotion choice
      this.updateGameStatus();
      return true;
    }
    
    // Handle castling move
    if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
      // Kingside castle
      if (toCol > fromCol) {
        const rook = this.board[fromRow][7];
        this.board[fromRow][5] = rook;
        this.board[fromRow][7] = null;
      } 
      // Queenside castle
      else {
        const rook = this.board[fromRow][0];
        this.board[fromRow][3] = rook;
        this.board[fromRow][0] = null;
      }
    }
    
    // Update castling rights
    if (piece.type === 'king') {
      this.castlingRights[piece.color].kingside = false;
      this.castlingRights[piece.color].queenside = false;
    }
    if (piece.type === 'rook') {
      if (fromCol === 0) this.castlingRights[piece.color].queenside = false;
      if (fromCol === 7) this.castlingRights[piece.color].kingside = false;
    }
    
    // Set en passant target
    this.enPassantTarget = null;
    if (piece.type === 'pawn' && Math.abs(toRow - fromRow) === 2) {
      this.enPassantTarget = { row: (fromRow + toRow) / 2, col: fromCol };
    }
    
    // Handle special notation for castling
    if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
      const notation = toCol > fromCol ? 'O-O' : 'O-O-O';
      this.moveHistory.push(notation);
    } else {
      // Get standard notation for the move
      const notation = this.getNotation(piece, fromRow, fromCol, toRow, toCol, !!capturedPiece || (piece.type === 'pawn' && this.enPassantTarget && toRow === this.enPassantTarget.row && toCol === this.enPassantTarget.col));
      this.moveHistory.push(notation);
    }
    
    // Switch players
    this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
    
    // Check for checkmate/stalemate and append to the last move notation
    this.updateGameStatus();
    
    const lastMoveIndex = this.moveHistory.length - 1;
    if (this.gameStatus === 'checkmate') {
      this.moveHistory[lastMoveIndex] += '#';
    } else if (this.gameStatus === 'check') {
      this.moveHistory[lastMoveIndex] += '+';
    }
    
    return true;
  }
  getMoveDetails(fromRow, fromCol, toRow, toCol) {
    if (!this.isValidMove(fromRow, fromCol, toRow, toCol)) return null;
    const piece = this.board[fromRow][fromCol];
    const captured = !!this.board[toRow][toCol] || 
      (piece.type === 'pawn' && this.enPassantTarget && toRow === this.enPassantTarget.row && toCol === this.enPassantTarget.col);
    const castled = piece.type === 'king' && Math.abs(toCol - fromCol) === 2;
    return { captured, castled };
  }
  promotePawn(pieceType) {
    if (this.gameStatus !== 'promoting' || !this.promotionSquare) return;
    const { row, col } = this.promotionSquare;
    const color = this.board[row][col].color;
    this.board[row][col] = { type: pieceType, color };
    this.promotionSquare = null;
    this.gameStatus = 'playing';
    // Append promotion piece to the last move in history
    const lastMoveIndex = this.moveHistory.length - 1;
    if (lastMoveIndex >= 0) {
      const pieceChar = pieceType === 'knight' ? 'N' : pieceType.charAt(0).toUpperCase();
      this.moveHistory[lastMoveIndex] += `=${pieceChar}`;
    }
    // Now switch players and check game status
    this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
    this.updateGameStatus();
    // Append check/checkmate status
    if (lastMoveIndex >= 0) {
        if (this.gameStatus === 'checkmate') {
            this.moveHistory[lastMoveIndex] += '#';
        } else if (this.gameStatus === 'check') {
            this.moveHistory[lastMoveIndex] += '+';
        }
    }
  }
  
  isKingInCheck(color, board = this.board) {
    // Find the king
    let kingPos = null;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === 'king' && piece.color === color) {
          kingPos = { row, col };
          break;
        }
      }
      if (kingPos) break;
    }
    
    if (!kingPos) return false;
    
    // Check if any enemy piece can attack the king
    const enemyColor = color === 'white' ? 'black' : 'white';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === enemyColor) {
          // En-passant checks are complex and rare, ignoring for general check detection for simplicity
          if (ChessPieces.isValidPieceMove(piece.type, row, col, kingPos.row, kingPos.col, board, null)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  updateGameStatus() {
    // This should only be called after a move is fully completed.
    const hash = this.getBoardStateHash();
    const count = (this.boardStateHistory.get(hash) || 0) + 1;
    this.boardStateHistory.set(hash, count);
    if (count >= 3) {
      this.gameStatus = 'draw_repetition';
      return;
    }
    // Determine check/checkmate/stalemate
    if (this.isKingInCheck(this.currentPlayer)) {
      if (this.hasNoValidMoves(this.currentPlayer)) {
        this.gameStatus = 'checkmate';
      } else {
        this.gameStatus = 'check';
      }
    } else if (this.hasNoValidMoves(this.currentPlayer)) {
      this.gameStatus = 'stalemate';
    } else {
      this.gameStatus = 'playing';
    }
  }
  
  hasNoValidMoves(color) {
    for (let fromRow = 0; fromRow < 8; fromRow++) {
      for (let fromCol = 0; fromCol < 8; fromCol++) {
        const piece = this.board[fromRow][fromCol];
        if (piece && piece.color === color) {
          for (let toRow = 0; toRow < 8; toRow++) {
            for (let toCol = 0; toCol < 8; toCol++) {
              if (this.isValidMove(fromRow, fromCol, toRow, toCol)) {
                return false;
              }
            }
          }
        }
      }
    }
    return true;
  }
  
  getValidMoves(fromRow, fromCol) {
    const moves = [];
    const piece = this.board[fromRow][fromCol];
    if (!piece || piece.color !== this.currentPlayer) return moves;
    
    for (let toRow = 0; toRow < 8; toRow++) {
      for (let toCol = 0; toCol < 8; toCol++) {
        if (this.isValidMove(fromRow, fromCol, toRow, toCol)) {
          moves.push({ row: toRow, col: toCol });
        }
      }
    }
    
    // Check for castling moves
    if (piece.type === 'king') {
      // Kingside
      if (this.isValidCastle(fromRow, fromCol, fromRow, fromCol + 2)) {
        moves.push({ row: fromRow, col: fromCol + 2 });
      }
      // Queenside
      if (this.isValidCastle(fromRow, fromCol, fromRow, fromCol - 2)) {
        moves.push({ row: fromRow, col: fromCol - 2 });
      }
    }
    
    return moves;
  }
  isValidCastle(fromRow, fromCol, toRow, toCol) {
    const piece = this.board[fromRow][fromCol];
    if (piece.type !== 'king' || fromRow !== toRow) return false;
  
    const colDiff = toCol - fromCol;
    if (Math.abs(colDiff) !== 2) return false;
  
    const direction = colDiff > 0 ? 1 : -1;
    const rookCol = direction === 1 ? 7 : 0;
    const castlingRight = direction === 1 ? 'kingside' : 'queenside';
  
    if (!this.castlingRights[piece.color][castlingRight]) return false;
  
    // King must not be in check
    if (this.isKingInCheck(piece.color)) return false;
  
    // Path must be clear between king and rook
    for (let c = fromCol + direction; c !== rookCol; c += direction) {
      if (this.board[fromRow][c]) return false;
    }
  
    // Squares king moves through must not be under attack
    for (let c = 1; c <= 2; c++) {
      const testBoard = JSON.parse(JSON.stringify(this.board));
      testBoard[fromRow][fromCol + c * direction] = testBoard[fromRow][fromCol];
      testBoard[fromRow][fromCol] = null;
      if (this.isKingInCheck(piece.color, testBoard)) {
        return false;
      }
    }
  
    return true;
  }
  
  getBoardStateHash() {
    let hash = '';
    // 1. Piece placement
    for (let row = 7; row >= 0; row--) {
      let empty = 0;
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece) {
          if (empty > 0) {
            hash += empty;
            empty = 0;
          }
          let char = piece.type.charAt(0);
          if (piece.type === 'knight') char = 'n';
          hash += piece.color === 'white' ? char.toUpperCase() : char;
        } else {
          empty++;
        }
      }
      if (empty > 0) {
        hash += empty;
      }
      if (row > 0) {
        hash += '/';
      }
    }
    // 2. Active color
    hash += ` ${this.currentPlayer.charAt(0)}`;
    // 3. Castling availability
    hash += ' ';
    let castling = '';
    if (this.castlingRights.white.kingside) castling += 'K';
    if (this.castlingRights.white.queenside) castling += 'Q';
    if (this.castlingRights.black.kingside) castling += 'k';
    if (this.castlingRights.black.queenside) castling += 'q';
    hash += castling || '-';
    // 4. En passant target square
    hash += ' ';
    if (this.enPassantTarget) {
      const col = String.fromCharCode(97 + this.enPassantTarget.col);
      const row = this.enPassantTarget.row + 1;
      hash += `${col}${row}`;
    } else {
      hash += '-';
    }
    
    return hash;
  }
  getNotation(piece, fromRow, fromCol, toRow, toCol, isCapture) {
    const file = String.fromCharCode('a'.charCodeAt(0) + toCol);
    const rank = toRow + 1;
    let notation = '';
    if (piece.type !== 'pawn') {
      let pieceChar = piece.type.charAt(0).toUpperCase();
      if (piece.type === 'knight') pieceChar = 'N';
      notation += pieceChar;
      // Add disambiguation if needed
      const disambiguation = this.getDisambiguation(piece, fromRow, fromCol, toRow, toCol);
      if (disambiguation) {
        notation += disambiguation;
      }
    }
    
    if (isCapture) {
      if (piece.type === 'pawn') {
        const fromFile = String.fromCharCode('a'.charCodeAt(0) + fromCol);
        notation += fromFile;
      }
      notation += 'x';
    }
    
    notation += file + rank;
    
    return notation;
  }
  getDisambiguation(pieceToMove, fromRow, fromCol, toRow, toCol) {
    const ambiguousPieces = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (
          piece &&
          piece.type === pieceToMove.type &&
          piece.color === pieceToMove.color &&
          (r !== fromRow || c !== fromCol) &&
          this.isValidMove(r, c, toRow, toCol)
        ) {
          ambiguousPieces.push({ r, c });
        }
      }
    }
    if (ambiguousPieces.length === 0) return '';
    const fromFile = String.fromCharCode('a'.charCodeAt(0) + fromCol);
    const fromRank = fromRow + 1;
    let useFile = false;
    let useRank = false;
    for (const p of ambiguousPieces) {
      if (p.c !== fromCol) useFile = true;
      if (p.r !== fromRow) useRank = true;
    }
    
    if (useFile) {
        // If files are different, file is enough for disambiguation.
        // Check if there's another piece on the same file that could also move there.
        const sameFileAmbiguity = ambiguousPieces.some(p => p.c === fromCol);
        if (sameFileAmbiguity) {
             return fromFile + fromRank;
        }
        return fromFile;
    }
    if (useRank) {
       return fromRank.toString();
    }
    
    // Fallback if pieces are on the same file and rank, which is impossible for standard pieces other than promoted ones.
    // This case is very rare. Usually file or rank is enough.
    return fromFile + fromRank;
  }
}