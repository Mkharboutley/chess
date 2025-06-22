export class ChessPieces {
  static isValidPieceMove(type, fromRow, fromCol, toRow, toCol, board, enPassantTarget) {
    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const piece = board[fromRow][fromCol];
    
    switch (type) {
      case 'pawn':
        return this.isValidPawnMove(piece, fromRow, fromCol, toRow, toCol, board, enPassantTarget);
      case 'rook':
        return this.isValidRookMove(fromRow, fromCol, toRow, toCol, board);
      case 'knight':
        return this.isValidKnightMove(rowDiff, colDiff);
      case 'bishop':
        return this.isValidBishopMove(fromRow, fromCol, toRow, toCol, board);
      case 'queen':
        return this.isValidQueenMove(fromRow, fromCol, toRow, toCol, board);
      case 'king':
        return this.isValidKingMove(rowDiff, colDiff) || Math.abs(colDiff) === 2 && rowDiff === 0;
      default:
        return false;
    }
  }
  
  static isValidPawnMove(piece, fromRow, fromCol, toRow, toCol, board, enPassantTarget) {
    const rowDiff = toRow - fromRow;
    const colDiff = Math.abs(toCol - fromCol);
    const direction = piece.color === 'white' ? 1 : -1;
    const startRow = piece.color === 'white' ? 1 : 6;
    
    // Forward move
    if (colDiff === 0) {
      if (rowDiff === direction && !board[toRow][toCol]) return true;
      if (fromRow === startRow && rowDiff === 2 * direction && !board[toRow][toCol] && !board[fromRow + direction][fromCol]) return true;
    }
    
    // Diagonal capture
    if (colDiff === 1 && rowDiff === direction) {
      // Standard capture
      if (board[toRow][toCol] && board[toRow][toCol].color !== piece.color) return true;
      // En passant capture
      if (enPassantTarget && toRow === enPassantTarget.row && toCol === enPassantTarget.col) {
        return true;
      }
    }
    
    return false;
  }
  
  static isValidRookMove(fromRow, fromCol, toRow, toCol, board) {
    if (fromRow !== toRow && fromCol !== toCol) return false;
    return this.isPathClear(fromRow, fromCol, toRow, toCol, board);
  }
  
  static isValidKnightMove(rowDiff, colDiff) {
    return (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) ||
           (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2);
  }
  
  static isValidBishopMove(fromRow, fromCol, toRow, toCol, board) {
    if (Math.abs(toRow - fromRow) !== Math.abs(toCol - fromCol)) return false;
    return this.isPathClear(fromRow, fromCol, toRow, toCol, board);
  }
  
  static isValidQueenMove(fromRow, fromCol, toRow, toCol, board) {
    return this.isValidRookMove(fromRow, fromCol, toRow, toCol, board) ||
           this.isValidBishopMove(fromRow, fromCol, toRow, toCol, board);
  }
  
  static isValidKingMove(rowDiff, colDiff) {
    return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
  }
  
  static isPathClear(fromRow, fromCol, toRow, toCol, board) {
    const rowStep = toRow === fromRow ? 0 : (toRow > fromRow ? 1 : -1);
    const colStep = toCol === fromCol ? 0 : (toCol > fromCol ? 1 : -1);
    
    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;
    
    while (currentRow !== toRow || currentCol !== toCol) {
      if (board[currentRow][currentCol]) return false;
      currentRow += rowStep;
      currentCol += colStep;
    }
    
    return true;
  }
}