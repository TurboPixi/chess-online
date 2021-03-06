import * as PIXI from 'pixi.js-legacy';
import {Piece } from './piece';
import {
    Color,
    PGN,
    PGNObject,
    PieceKind,
    PieceDirection,
    CastlesInfo,
    BOARD_WIDTH,
    BOARD_HEIGHT,
    CELL_WIDTH,
    CELL_HEIGHT
} from '../server/shared';
import * as TWEEN from '@tweenjs/tween.js';

interface CheckInfo {
    available: number[][];
    isInCheck: boolean;
    isCheckmate: boolean;
    checkCells: number[][];
    piecesAttacking: Piece[];
}

interface PieceList {
    leftRook: Piece;
    leftKnight: Piece;
    leftBishop: Piece;
    queen: Piece;
    king: Piece;
    rightBishop: Piece;
    rightKnight: Piece;
    rightRook: Piece;
    pawn0: Piece;
    pawn1: Piece;
    pawn2: Piece;
    pawn3: Piece;
    pawn4: Piece;
    pawn5: Piece;
    pawn6: Piece;
    pawn7: Piece;
    [key: string]: Piece;
}

interface Pieces {
    white: PieceList;
    black: PieceList;
    [key: string]: PieceList;
}

interface Pool {
    white: Piece[];
    black: Piece[];
    [key: string]: Piece[];
}

interface Cell {
    isAvailable: boolean;
    isAttacked: boolean;
    isSelected: boolean;
    isHighlighted: boolean;
    color: CellColor;
    piece: Piece;
    graphics: PIXI.Graphics;
}

enum CellColor {
    Light = 0xffffff,
    Dark = 0xc88340,
    LightHighlight = 0xfeef42,
    DarkHighlight = 0xc0b100,
    Selected = 0x9662f6,
    Attacked = 0xff0000,
    LightAvailable = 0x2fff2f,
    DarkAvailable = 0x00ad00,
}

export class Board extends PIXI.Sprite {

    protected cells: Cell[][] = [];

    private pieces: Pieces;
    private alivePieces: Pool;

    private availableCells: number[][] = [];
    private attackedCells: number[][] = [];
    private highlightedCells: number[][] = [];
    private selectedCell: Cell;

    private letters: PIXI.Text[] = [];

    private spriteSheet: PIXI.Spritesheet = null;

    public isInCheck: boolean = false;
    private kingMustMove: boolean = false;
    private allowedToMove: number[] = [];

    public moves = -1;

    constructor() {
        super();
        
        let switchColor = false;
        for (let row = 0; row < 8; row++) {
            this.cells.push([]);
            for (let col = 0; col < 8; col++) {
                this.cells[row].push({
                    // color: switchColor ? 0xa76626 : 0xc2bdb9,
                    color: switchColor ? CellColor.Dark : CellColor.Light,
                    isAvailable: false,
                    isAttacked: false,
                    isSelected: false,
                    isHighlighted: false,
                    piece: null,
                    graphics: new PIXI.Graphics()
                });

                let x = col * CELL_WIDTH;
                let y = row * CELL_HEIGHT;

                let cell = this.cells[row][col];

                if (PIXI.utils.isWebGLSupported()) {
                    cell.graphics
                        .beginFill(CellColor.Light)
                            .drawRect(0, 0, CELL_WIDTH, CELL_HEIGHT)
                        .endFill();
                }
                else {
                    cell.graphics
                        .beginFill(cell.color)
                            .drawRect(0, 0, CELL_WIDTH, CELL_HEIGHT)
                        .endFill();
                }
                
                cell.graphics.x = x;
                cell.graphics.y = y;

                this.addChild(cell.graphics);
                switchColor = !switchColor;
            }
            switchColor = !switchColor;
        }

        this.redrawBoard();
    }

    createBoard(app: PIXI.Application) {
        let sheet = app.loader.resources["images/spritesheet.min.json"].spritesheet;

        this.spriteSheet = sheet;

        this.pieces = {
            black: {
                leftRook: new Piece(sheet.textures["rook_black"], PieceKind.Rook, PieceDirection.Sides, 8),
                leftKnight: new Piece(sheet.textures["knight_black"], PieceKind.Knight ,0),
                leftBishop: new Piece(sheet.textures["bishop_black"], PieceKind.Bishop, PieceDirection.Corners, 8),
                queen: new Piece(sheet.textures["queen_black"], PieceKind.Queen, PieceDirection.All, 8),
                king: new Piece(sheet.textures["king_black"], PieceKind.King, PieceDirection.All, 1),
                rightBishop: new Piece(sheet.textures["bishop_black"], PieceKind.Bishop, PieceDirection.Corners, 8),
                rightKnight: new Piece(sheet.textures["knight_black"], PieceKind.Knight, 0),
                rightRook: new Piece(sheet.textures["rook_black"], PieceKind.Rook, PieceDirection.Sides, 8),
                pawn0: new Piece(sheet.textures["pawn_black"], PieceKind.Pawn, PieceDirection.Up, 2),
                pawn1: new Piece(sheet.textures["pawn_black"], PieceKind.Pawn, PieceDirection.Up, 2),
                pawn2: new Piece(sheet.textures["pawn_black"], PieceKind.Pawn, PieceDirection.Up, 2),
                pawn3: new Piece(sheet.textures["pawn_black"], PieceKind.Pawn, PieceDirection.Up, 2),
                pawn4: new Piece(sheet.textures["pawn_black"], PieceKind.Pawn, PieceDirection.Up, 2),
                pawn5: new Piece(sheet.textures["pawn_black"], PieceKind.Pawn, PieceDirection.Up, 2),
                pawn6: new Piece(sheet.textures["pawn_black"], PieceKind.Pawn, PieceDirection.Up, 2),
                pawn7: new Piece(sheet.textures["pawn_black"], PieceKind.Pawn, PieceDirection.Up, 2),
            },
            white: {
                leftRook: new Piece(sheet.textures["rook_white"], PieceKind.Rook, PieceDirection.Sides, 8),
                leftKnight: new Piece(sheet.textures["knight_white"], PieceKind.Knight, 0),
                leftBishop: new Piece(sheet.textures["bishop_white"], PieceKind.Bishop, PieceDirection.Corners, 8),
                queen: new Piece(sheet.textures["queen_white"], PieceKind.Queen, PieceDirection.All, 8),
                king: new Piece(sheet.textures["king_white"], PieceKind.King, PieceDirection.All, 1),
                rightBishop: new Piece(sheet.textures["bishop_white"], PieceKind.Bishop, PieceDirection.Corners, 8),
                rightKnight: new Piece(sheet.textures["knight_white"], PieceKind.Knight, 0),
                rightRook: new Piece(sheet.textures["rook_white"], PieceKind.Rook, PieceDirection.Sides, 8),
                pawn0: new Piece(sheet.textures["pawn_white"], PieceKind.Pawn, PieceDirection.Up, 2),
                pawn1: new Piece(sheet.textures["pawn_white"], PieceKind.Pawn, PieceDirection.Up, 2),
                pawn2: new Piece(sheet.textures["pawn_white"], PieceKind.Pawn, PieceDirection.Up, 2),
                pawn3: new Piece(sheet.textures["pawn_white"], PieceKind.Pawn, PieceDirection.Up, 2),
                pawn4: new Piece(sheet.textures["pawn_white"], PieceKind.Pawn, PieceDirection.Up, 2),
                pawn5: new Piece(sheet.textures["pawn_white"], PieceKind.Pawn, PieceDirection.Up, 2),
                pawn6: new Piece(sheet.textures["pawn_white"], PieceKind.Pawn, PieceDirection.Up, 2),
                pawn7: new Piece(sheet.textures["pawn_white"], PieceKind.Pawn, PieceDirection.Up, 2),
            },
        }

        this.alivePieces = {
            white: [],
            black: []
        };

        for (const color in this.pieces) {
            for (const key in this.pieces[color]) {
                let piece = this.pieces[color][key];
                piece.on('piecedown', this.onPieceDown, this);
                piece.board = this;
                this.alivePieces[color].push(piece);
            }
        }

        // letters
        for (let j = 0; j < 2; j++) {
            let c = 'a';
            for (let i = 0; i < 8; i++) {
                this.letters.push(new PIXI.Text(c, {
                    fill: 0xC2C2DA,
                    fontSize: 20
                }));

                let letter = this.letters[this.letters.length - 1];

                letter.anchor.set(0.5, 0.5);
                letter.x = CELL_WIDTH / 2 + i * CELL_WIDTH;
                letter.y = -letter.height / 2 - 6 + j * (BOARD_HEIGHT + letter.height + 6);
                this.addChild(letter);

                c = String.fromCharCode(c.charCodeAt(0) + 1);
            }
        }

        // numbers
        for (let j = 0; j < 2; j++) {
            let c = '8';
            for (let i = 0; i < 8; i++) {
                this.letters.push(new PIXI.Text(c, {
                    fill: 0xC2C2DA,
                    fontSize: 20
                }));

                let letter = this.letters[this.letters.length - 1];
                letter.anchor.set(0.5, 0.5);
                letter.x = -letter.width / 2 - 10 + j * (BOARD_WIDTH + letter.width / 2 + 25);
                letter.y = i * CELL_HEIGHT + CELL_HEIGHT / 2;
                this.addChild(letter);

                c = String.fromCharCode(c.charCodeAt(0) - 1);
            }
        }
    }

    resetBoard(app: PIXI.Application) {

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                this.cells[row][col].isAvailable = false;
                this.cells[row][col].isSelected = false;
                this.cells[row][col].isAttacked = false;
                this.cells[row][col].piece = null;
            }
        }

        let myRow = 7;
        let enemyRow = 0;

        let myPieces = this.pieces[this.color];
        let enemyPieces = this.pieces[this.enemyColor];

        this.setPieceIn(myRow, 0, myPieces.leftRook);
        this.setPieceIn(myRow, 1, myPieces.leftKnight);
        this.setPieceIn(myRow, 2, myPieces.leftBishop);
        this.setPieceIn(myRow, 5, myPieces.rightBishop);
        this.setPieceIn(myRow, 6, myPieces.rightKnight);
        this.setPieceIn(myRow, 7, myPieces.rightRook);

        this.addChild(myPieces.leftRook, myPieces.leftKnight, myPieces.leftBishop, myPieces.queen, myPieces.king, myPieces.rightBishop, myPieces.rightKnight, myPieces.rightRook);

        this.setPieceIn(enemyRow, 0, enemyPieces.leftRook);
        this.setPieceIn(enemyRow, 1, enemyPieces.leftKnight);
        this.setPieceIn(enemyRow, 2, enemyPieces.leftBishop);
        this.setPieceIn(enemyRow, 5, enemyPieces.rightBishop);
        this.setPieceIn(enemyRow, 6, enemyPieces.rightKnight);
        this.setPieceIn(enemyRow, 7, enemyPieces.rightRook);

        this.addChild(enemyPieces.leftRook, enemyPieces.leftKnight, enemyPieces.leftBishop, enemyPieces.queen, enemyPieces.king, enemyPieces.rightBishop, enemyPieces.rightKnight, enemyPieces.rightRook);

        if (this.color == Color.Black) {
            this.setPieceIn(myRow, 3, myPieces.king);
            this.setPieceIn(myRow, 4, myPieces.queen);
            this.setPieceIn(enemyRow, 3, enemyPieces.king);
            this.setPieceIn(enemyRow, 4, enemyPieces.queen);
        }
        else {
            this.setPieceIn(myRow, 3, myPieces.queen);
            this.setPieceIn(myRow, 4, myPieces.king);
            this.setPieceIn(enemyRow, 3, enemyPieces.queen);
            this.setPieceIn(enemyRow, 4, enemyPieces.king);
        }

        for (let i = 0; i < 8; i++) {
            let piece = this.pieces.black["pawn" + i];
            this.addChild(piece);

            if (this.color == Color.Black) {
                this.setPieceIn(6, i, piece);
                piece.directions = PieceDirection.Up;
            }
            else {
                this.setPieceIn(1, i, piece);
                piece.directions = PieceDirection.Down;
            }
        }

        for (let i = 0; i < 8; i++) {
            let piece = this.pieces.white["pawn" + i];
            this.addChild(piece);

            if (this.color == Color.White) {
                this.setPieceIn(6, i, piece);
                piece.directions = PieceDirection.Up;
            }
            else {
                this.setPieceIn(1, i, piece);
                piece.directions = PieceDirection.Down;
            }
        }

        this.resetLetters();
    }

    resetLetters() {
        // letters
        for (let j = 0; j < 2; j++) {
            let c = this.color == Color.Black ? 'h' : 'a';
            for (let i = 0 + j * 8; i < 8 + j * 8; i++) {
                this.letters[i].text = c;

                if (this.color == Color.Black)
                    c = String.fromCharCode(c.charCodeAt(0) - 1);
                else
                    c = String.fromCharCode(c.charCodeAt(0) + 1);
            }
        }

        // numbers
        for (let j = 0; j < 2; j++) {
            let c = this.color == Color.Black ? '1' : '8';
            for (let i = 16 + j * 8; i < 24 + j * 8; i++) {
                this.letters[i].text = c;

                if (this.color == Color.Black)    
                    c = String.fromCharCode(c.charCodeAt(0) + 1);
                else
                    c = String.fromCharCode(c.charCodeAt(0) - 1);
            }
        }
    }

    redrawBoard() {

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {

                let cell = this.cells[row][col];
                let color;

                if (cell.isAttacked) {
                    color = CellColor.Attacked;
                }
                else if (cell.isAvailable) {
                    
                    if (cell.color != CellColor.Light)
                        color = CellColor.DarkAvailable;
                    else
                        color = CellColor.LightAvailable;
                }
                else if (cell.isSelected) {
                    color = CellColor.Selected;
                }
                else if (cell.isHighlighted) {

                    if (cell.color != CellColor.Light)
                        color = CellColor.DarkHighlight;
                    else
                        color = CellColor.LightHighlight;
                }
                else {
                    color = cell.color;
                }

                cell.graphics.clear()
                    .beginFill(color)
                        .drawRect(0, 0, CELL_WIDTH, CELL_HEIGHT)
                    .endFill();
            }
        }
    }

    clearPassants() {
        for (const color in this.alivePieces) {
            for (let piece of this.alivePieces[color]) {
                piece.isAdvanced = false;
                piece.isEnPassant = false;
            }
        }
    }

    setActionsEnabled(isEnabled: boolean) {
        for (let piece of this.alivePieces[this.color]) {
            piece.interactive = isEnabled;
            piece.buttonMode = isEnabled;
        }
    }

    private enableAllowedPieces() {
        for (let i = 0; i < this.alivePieces[this.color].length; i++) {
            let piece = this.alivePieces[this.color][i];
            if (this.allowedToMove.indexOf(i) == -1) {
                piece.interactive = false;
                piece.buttonMode = false;
            }
            else {
                piece.interactive = true;
                piece.buttonMode = true;
            }
        }
    }

    changePieceKind(piece: Piece, newKind: PieceKind) {
        piece.kind = newKind;

        let color = piece.isPlayer ? this.color : this.enemyColor;

        switch (newKind) {
            case PieceKind.Queen:
                piece.texture = this.spriteSheet.textures[`queen_${color}`];
                piece.directions = this.pieces[color].queen.directions;
                piece.count = this.pieces[color].queen.count;
                break;
            
            case PieceKind.Bishop:
                piece.texture = this.spriteSheet.textures[`bishop_${color}`];
                piece.directions = this.pieces[color].leftBishop.directions;
                piece.count = this.pieces[color].leftBishop.count;
                break;

            case PieceKind.Rook:
                piece.texture = this.spriteSheet.textures[`rook_${color}`];
                piece.directions = this.pieces[color].leftRook.directions;
                piece.count = this.pieces[color].leftRook.count;
                break;
            
            case PieceKind.Knight:
                piece.texture = this.spriteSheet.textures[`knight_${color}`];
                piece.directions = this.pieces[color].leftKnight.directions;
                piece.count = this.pieces[color].leftKnight.count;
                break;
        
            default:
                break;
        }
    }

    verifyCheck(color: Color = this.color, checkNear: boolean = false, change: boolean = true): CheckInfo {
        let enemyColor = color == Color.White ? Color.Black : Color.White;
        let king = this.pieces[color].king;
        let kingCells = king.getAvailableCells();

        let checkCells: number[][] = [];
        let piecesAttacking: Piece[] = [];

        if (change) {
            this.allowedToMove.splice(0, this.allowedToMove.length);
        }

        for (let piece of this.alivePieces[enemyColor]) {

            let cells = piece.getAvailableCells();

            // verify how many and which pieces are attacking the king
            for (let i = 0; i < cells.length; i++) {
                let [row, col] = cells[i];
                if (row == king.row && col == king.col) {
                    let canBreak = false;

                    let biggerCol = Math.max(king.col, piece.col);
                    let biggerRow = Math.max(king.row, piece.row);
                    let smallerCol = Math.min(king.col, piece.col);
                    let smallerRow = Math.max(king.row, piece.row);

                    let distance = ((biggerCol-smallerCol)^2 + (biggerRow-smallerRow)^2)^0.5;

                    if (distance > 1) {
                        // get the cells in the same direction as the king
                        for (let j = i - 1; j >= 0; j--) {
                            let [prevRow, prevCol] = cells[j];
                            checkCells.push([prevRow, prevCol]);

                            for (let r = prevRow - 1; r <= prevRow + 1; r++) {
                                for (let c = prevCol - 1; c <= prevCol + 1; c++) {
                                    if (r == piece.row && c == piece.col) {
                                        canBreak = true;
                                        break;
                                    }
                                }
                                if (canBreak)
                                    break;
                            }
                            if (canBreak)
                                break;
                        }
                    }

                    piecesAttacking.push(piece);
                }
            }
        }

        let isInCheck = piecesAttacking.length > 0;
        let isCheckmate = false;
        let canCapture = false;
        let canCover = false;

        if (isInCheck) {

            // double check, king must move
            if (piecesAttacking.length > 1) {
                if (change)
                    this.kingMustMove = true;
                
                // no cells available, it's a checkmate
                if (kingCells.length == 0) {
                    if (change) {
                        isCheckmate = true;
                    }
                }
                else {
                    if (change)
                        this.allowedToMove.push(this.alivePieces[color].indexOf(king));
                }
            }
            else {
                if (change) {
                    this.kingMustMove = false;
                    this.allowedToMove.push(this.alivePieces[color].indexOf(king));
                }
                
                let attacker = piecesAttacking[0];

                // check if the attacker can be captured by other piece
                for (let piece of this.alivePieces[color]) {
                    if (piece.kind == PieceKind.King)
                        continue;
                    
                    let cells = piece.getAvailableCells();
                    for (let i = 0; i < cells.length; i++) {
                        let [cellRow, cellCol] = cells[i];

                        // friendly piece can capture the attacker
                        if (cellRow == attacker.row && cellCol == attacker.col) {
                            if (change) {
                                let index = this.alivePieces[color].indexOf(piece);
                                if (this.allowedToMove.indexOf(index) == -1) {
                                    this.allowedToMove.push(index);
                                }
                            }
                            canCapture = true;
                        }
                    }
                }

                // check if it's possible to cover the check
                for (let piece of this.alivePieces[color]) {
                    if (piece.kind == PieceKind.King)
                        continue;
                    
                    let cells = piece.getAvailableCells();
                    for (let i = 0; i < cells.length; i++) {
                        let [row, col] = cells[i];
                        for (let j = 0; j < checkCells.length; j++) {
                            let [attackRow, attackCol] = checkCells[j];
                            if (attackRow == row && attackCol == col) {
                                if (change) {
                                    let index = this.alivePieces[color].indexOf(piece);
                                    if (this.allowedToMove.indexOf(index) == -1) {
                                        this.allowedToMove.push(index);
                                    }
                                }
                                canCover = true;
                            }
                        }
                    }
                }
            }
        }

        if (checkNear) {
            let oldRow = king.row;
            let oldCol = king.col;

            for (let i = kingCells.length - 1; i >= 0; i--) {
                let [kingRow, kingCol] = kingCells[i];

                this.cells[oldRow][oldCol].piece = null;

                let oldPiece = this.cells[kingRow][kingCol].piece;
                this.setPieceIn(kingRow, kingCol, king);

                let checkInfo = this.verifyCheck(color, false, false);

                if (checkInfo.isInCheck || checkInfo.isCheckmate) {
                    kingCells.splice(i, 1);
                }

                this.cells[kingRow][kingCol].piece = null;
                this.setPieceIn(oldRow, oldCol, king);

                if (oldPiece)
                    this.setPieceIn(kingRow, kingCol, oldPiece);
            }
        }

        if (change) {
            if (kingCells.length == 0)
                this.allowedToMove.splice(0, 1);
        }

        if (isInCheck && !canCover && !canCapture && kingCells.length == 0) {
            isCheckmate = true;
        }

        if (change) {
            if (color == this.color)
                this.isInCheck = isInCheck;
        }

        return {
            available: kingCells,
            checkCells: checkCells,
            isInCheck: isInCheck,
            isCheckmate: isCheckmate,
            piecesAttacking: piecesAttacking
        }
    }

    validateMove(moveText: string) {
        let move = PGN.translateFrom(this.color == Color.White ? Color.Black : Color.White, moveText);

        this.clearHighlightedCells();

        if (move.isKingSideCastle || move.isQueenSideCastle) {
            let rookRow = 0;
            let rookCol = 0;
            let newRookCol = 0;
            let newKingCol = 0;
            let king = this.pieces[this.enemyColor].king;

            if (move.isKingSideCastle) {
                if (this.color == Color.Black) {
                    // left rook
                    newKingCol = 1;
                    newRookCol = 2;
                }
                else {
                    // right rook
                    rookCol = 7;
                    newRookCol = 5;
                    newKingCol = 6;
                }
            }
            else if (move.isQueenSideCastle) {
                if (this.color == Color.Black) {
                    // right rook
                    rookCol = 7;
                    newKingCol = 4;
                    newRookCol = 5;
                }
                else {
                    // left rook
                    newRookCol = 3;
                    newKingCol = 2;
                }
            }

            let rook = this.getPieceIn(rookRow, rookCol);
            if (rook && rook.kind == PieceKind.Rook && !rook.hasMoved) {
                this.cells[rook.row][rook.col].piece = null;
                this.cells[rook.row][rook.col].isSelected = null;
                this.cells[king.row][king.col].piece = null;
                this.cells[king.row][king.col].isSelected = null;

                this.setCellHighlighted(rook.row, rook.col, true);
                this.setCellHighlighted(rookRow, newRookCol, true);

                this.setCellHighlighted(king.row, king.col, true);
                this.setCellHighlighted(rookRow, newKingCol, true);

                let tweenKing = new TWEEN.Tween(king);
                let tweenRook = new TWEEN.Tween(rook);

                tweenRook
                    .to({ x: CELL_WIDTH / 2 + newRookCol * CELL_WIDTH, y: CELL_HEIGHT / 2 + rookRow * CELL_HEIGHT }, 100)
                    .easing(TWEEN.Easing.Linear.None)
                    .onComplete(() => {
                        this.setPieceIn(rookRow, newRookCol, rook);
                        TWEEN.remove(tweenKing);
                        TWEEN.remove(tweenRook);
                    });
                
                tweenKing
                    .to({ x: CELL_WIDTH / 2 + newKingCol * CELL_WIDTH, y: CELL_HEIGHT / 2 + rookRow * CELL_HEIGHT }, 100)
                    .easing(TWEEN.Easing.Linear.None)
                    .onComplete(() => {
                        this.setPieceIn(rookRow, newKingCol, king);
                    })
                    .chain(tweenRook)
                    .start();
                
                this.setPieceIn(rookRow, newRookCol, rook, false);
                this.setPieceIn(rookRow, newKingCol, king, false);
                
                rook.hasMoved =  true;
                king.hasMoved = true;
            }

            this.redrawBoard();

            if (move.isCheck) {
                let checkInfo = this.verifyCheck(this.color);

                this.enableAllowedPieces();
                this.emit('check');
            }
            else if (move.isCheckmate) {
                this.setActionsEnabled(false);
                this.emit('checkmate');
            }

            return;
        }

        let row = move.toRow;
        let col = move.toCol;
        let fromRow = move.fromRow;
        let fromCol = move.fromCol;

        if (this.color == Color.Black) {
            row = 7 - row;
            col = 7 - col;
            fromRow = 7 - fromRow;
            fromCol = 7 - fromCol;
        }

        let piece = this.cells[fromRow][fromCol].piece;
        let cells = piece.getAvailableCells();

        if (piece.kind == move.pieceKind) {
            for (let i = 0; i < cells.length; i++) {
                let cell = cells[i];
                if (row == cell[0] && col == cell[1]) {

                    if (move.isPawnPromotion) {
                        this.changePieceKind(piece, move.promotionKind);
                    }

                    if (piece.kind == PieceKind.Pawn) {
                        if (!piece.hasMoved) {
                            piece.isEnPassant = true;
                        }
                        else {
                            // en passant
                            for (let j = fromCol - 1; j <= fromCol + 1; j += 2) {
                                let cellPiece = this.getPieceIn(fromRow, j);
                                if (cellPiece && cellPiece.isEnPassant) {
                                    this.removePieceFrom(fromRow, j);
                                }
                            }
                        }
                    }

                    if (move.hasCapture) {
                        this.setCellAttacked(row, col, true);
                    }
                    else {
                        this.setCellAvailable(row, col, true);
                    }

                    this.setCellHighlighted(fromRow, fromCol, true);
                    this.setCellHighlighted(row, col, true);

                    this.placePieceIn(row, col, piece);

                    if (move.isCheck) {
                        let checkInfo = this.verifyCheck(this.color);

                        this.enableAllowedPieces();
                        this.emit('check');
                    }
                    else if (move.isCheckmate) {
                        this.setActionsEnabled(false);
                        this.emit('checkmate');
                    }

                    break;
                }
            }
        }
    }

    isValidCell(row: number, col: number): boolean {
        return (row >= 0 && row <= 7 && col >= 0 && col <= 7);
    }

    getPieceIn(row: number, col: number): Piece {
        if (row >= 0 && row <= 7 && col >= 0 && col <= 7)
            return this.cells[row][col].piece;
        
        return null;
    }

    setPieceIn(row: number, col: number, piece: Piece, immediate: boolean = true) {
        if (piece) {
            piece.row = row;
            piece.col = col;
            if (immediate) {
                piece.x = CELL_WIDTH / 2 + col * CELL_WIDTH;
                piece.y = CELL_HEIGHT / 2 + row * CELL_HEIGHT;
            }
        }
        this.cells[row][col].piece = piece;
    }

    setCellAttacked(row: number, col: number, attacked: boolean = true) {
        if (row >= 0 && row <= 7 && col >= 0 && col <= 7) {
            let cell = this.cells[row][col];
            cell.isAttacked = attacked;

            if (attacked) {
                this.attackedCells.push([row, col]);
                cell.graphics.on('click', this.onCellClick, this);
                cell.graphics.buttonMode = true;
                cell.graphics.interactive = true;
            }
            else {
                cell.graphics.off('click', this.onCellClick, this);
                cell.graphics.buttonMode = false;
                cell.graphics.interactive = false;
            }
            
            this.redrawBoard();
        }
    }

    setCellAvailable(row: number, col: number, available: boolean = true) {
        if (row >= 0 && row <= 7 && col >= 0 && col <= 7) {
            let cell = this.cells[row][col];
            cell.isAvailable = available;

            if (available) {
                this.availableCells.push([row, col]);
                cell.graphics.on('click', this.onCellClick, this);
                cell.graphics.buttonMode = true;
                cell.graphics.interactive = true;
            }
            else {
                cell.graphics.off('click', this.onCellClick, this);
                cell.graphics.buttonMode = false;
                cell.graphics.interactive = false;
            }

            this.redrawBoard();
        }
    }

    setCellHighlighted(row: number, col: number, isHighlighted: boolean) {
        this.cells[row][col].isHighlighted = isHighlighted;
        if (isHighlighted) {
            this.highlightedCells.push([row, col]);
        }
    }

    clearHighlightedCells() {
        for (let i = 0; i < this.highlightedCells.length; i++) {
            const [row, col] = this.highlightedCells[i];
            this.setCellHighlighted(row, col, false);
        }
        this.highlightedCells.splice(0, this.highlightedCells.length);
    }

    clearAvailableCells() {
        for (let i = 0; i < this.availableCells.length; i++) {
            const pos = this.availableCells[i];
            this.setCellAvailable(pos[0], pos[1], false);
        }
        this.availableCells.splice(0, this.availableCells.length);
    }

    clearAttackedCells() {
        for (let i = 0; i < this.attackedCells.length; i++) {
            const pos = this.attackedCells[i];
            this.setCellAttacked(pos[0], pos[1], false);
        }
        this.attackedCells.splice(0, this.attackedCells.length);
    }

    removePieceFrom(row: number, col: number) {
        let piece = this.getPieceIn(row, col);
        if (piece) {
            this.cells[row][col].piece = null;
            piece.parent.removeChild(piece);

            let color = piece.isPlayer ? this.color : this.enemyColor;
            for (let i = 0; i < this.alivePieces[color].length; i++) {
                if (this.alivePieces[color][i] == piece) {
                    this.alivePieces[color].splice(i, 1);
                    break;
                }
            }
        }
    }

    placePieceIn(row: number, col: number, piece: Piece): boolean {
        if (row >= 0 && row <= 7 && col >= 0 && col <= 7) {

            if (this.cells[row][col].isAttacked || this.cells[row][col].isAvailable) {
                this.emit('uncheck');

                let oldRow = piece.row;
                let oldCol = piece.col;
                
                if (this.cells[row][col].isAttacked) {
                    let attackedPiece = this.cells[row][col].piece;
                    if (!attackedPiece) {
                        attackedPiece = this.cells[row+1][col].piece;
                        if (attackedPiece && attackedPiece.isEnPassant) {
                            this.removePieceFrom(row+1, col);
                        }
                    }
                    else {
                        this.removePieceFrom(row, col);
                    }
                }

                if (piece.kind == PieceKind.Pawn) {
                    if (Math.abs(row - oldRow) == 2) {
                        piece.isAdvanced = true;
                        for (let i = col - 1; i <= col + 1; i += 2) {
                            let cellPiece = this.getPieceIn(row, i);
                            if (cellPiece) {
                                piece.isEnPassant = true;
                                break;
                            }
                        }
                    }
                }

                let tween = new TWEEN.Tween(piece);

                tween
                    .to({ x: CELL_WIDTH / 2 + col * CELL_WIDTH, y: CELL_HEIGHT / 2 + row * CELL_HEIGHT }, 100)
                    .easing(TWEEN.Easing.Linear.None)
                    .onComplete(() => {
                        this.setPieceIn(row, col, piece);
                        TWEEN.remove(tween);
                    })
                    .start();

                this.cells[oldRow][oldCol].isSelected = false;
                this.cells[oldRow][oldCol].piece = null;
                
                this.setPieceIn(row, col, piece, false);

                this.clearAvailableCells();
                this.clearAttackedCells();

                this.redrawBoard();
                piece.hasMoved = true;
                return true;
            }
        }
        return false;
    }

    private onCellClick(event: PIXI.interaction.InteractionEvent) {

        let { x: clickX, y: clickY } = event.data.getLocalPosition(this);

        let row = Math.floor(clickY / CELL_HEIGHT);
        let col = Math.floor(clickX / CELL_WIDTH);

        let piece = this.selectedCell.piece;

        let oldRow = piece.row;
        let oldCol = piece.col;

        let pgn: PGNObject = {
            fromCol: oldCol,
            fromRow: oldRow,
            toCol: col,
            toRow: row,
            isCheck: false,
            isCheckmate: false,
            isKingSideCastle: false,
            isQueenSideCastle: false,
            hasCapture: false,
            promotionKind: null,
            isPawnPromotion: false,
            pieceKind: piece.kind
        };

        this.clearHighlightedCells();

        if (this.cells[row][col].isAttacked) {
            pgn.hasCapture = true;
        }

        // pawn promotion
        if (piece.kind == PieceKind.Pawn) {
            if (row == 0) {
                pgn.isPawnPromotion = true;
                this.emit('showpromotion', piece, row, col, pgn);
                return;
            }
        }
        
        // castles
        if (piece.kind == PieceKind.King) {
            
            let castlesInfo = this.getCastlesInfo();

            let rookRow = 0, rookCol = 0;
            let newKingCol = 0, newRookCol = 0;

            if (col == 1 || col == 6) {
                if (castlesInfo.canKingCastle) {
                    if (this.color == Color.Black) {
                        // left rook
                        rookRow = 7;
                        rookCol = 0;
                        newKingCol = 1;
                        newRookCol = 2;
                    }
                    else {
                        // right rook
                        rookRow = 7;
                        rookCol = 7;
                        newKingCol = 6;
                        newRookCol = 5;
                    }

                    let rook = this.getPieceIn(rookRow, rookCol);

                    this.placePieceIn(7, newKingCol, piece);

                    this.setCellAvailable(7, newRookCol, true);
                    this.placePieceIn(7, newRookCol, rook);

                    pgn.isKingSideCastle = true;
                }
            }
            else if (col == 5 || col == 2) {
                if (castlesInfo.canQueenCastle) {
                    if (this.color == Color.Black) {
                        // right rook
                        rookRow = 7;
                        rookCol = 7;
                        newKingCol = 5;
                        newRookCol = 4;
                    }
                    else {
                        // left rook
                        rookRow = 7;
                        rookCol = 0;
                        newKingCol = 2;
                        newRookCol = 3;
                    }

                    let rook = this.getPieceIn(rookRow, rookCol);

                    this.placePieceIn(7, newKingCol, piece);

                    this.setCellAvailable(7, newRookCol, true);
                    this.placePieceIn(7, newRookCol, rook);

                    pgn.isQueenSideCastle = true;
                }
            }

            if (pgn.isKingSideCastle || pgn.isQueenSideCastle) {
                let checkState = this.verifyCheck(<Color>this.enemyColor, true);
                pgn.isCheck = checkState.isInCheck;

                if (checkState.isCheckmate) {
                    pgn.isCheck = false;
                    pgn.isCheckmate = true;
                    this.emit('youwon');
                }

                this.emit('movepiece', PGN.translateInto(this.color, pgn));
                return;
            }
        }

        this.placePieceIn(row, col, piece);

        this.isInCheck = false;

        let checkState = this.verifyCheck(this.color == Color.Black ? Color.White : Color.Black, true);
        pgn.isCheck = checkState.isInCheck;

        if (checkState.isCheckmate) {
            pgn.isCheck = false;
            pgn.isCheckmate = true;
            this.emit('youwon');
        }

        this.emit('movepiece', PGN.translateInto(this.color, pgn));
    }

    private onPieceDown(event: PIXI.interaction.InteractionEvent) {
        let piece = <Piece>event.target;

        // bring piece to front in the Z index
        piece.parent.setChildIndex(piece, piece.parent.children.length - 1);

        this.clearAvailableCells();
        this.clearAttackedCells();

        if (this.selectedCell)
            this.selectedCell.isSelected = false;
        
        this.selectedCell = this.cells[piece.row][piece.col];
        this.cells[piece.row][piece.col].isSelected = true;
        
        let cells: number[][];
        let checkState = this.verifyCheck(this.color, true);

        if (piece.kind == PieceKind.King) {
            cells = checkState.available;

            // add the castles cells if any available
            if (!this.isInCheck) {
                let castlesInfo = this.getCastlesInfo();
                if (castlesInfo.canKingCastle) {
                    if (this.color == Color.Black)
                        cells.push([7, 1]);
                    else
                        cells.push([7, 6]);
                }

                if (castlesInfo.canQueenCastle) {
                    if (this.color == Color.Black)
                        cells.push([7, 5]);
                    else
                        cells.push([7, 2]);
                }
            }
        }
        else {
            cells = piece.getAvailableCells();

            if (!this.isInCheck) {
                let oldRow = piece.row;
                let oldCol = piece.col;
                this.cells[oldRow][oldCol].piece = null;

                // checks the available cells the piece can go if there's a xray
                let newCheckInfo = this.verifyCheck(this.color, false, false);
                let attacker = newCheckInfo.piecesAttacking[0];
                if (newCheckInfo.isInCheck || newCheckInfo.isCheckmate) {
                    for (let i = cells.length - 1; i >= 0; i--) {
                        let [row, col] = cells[i];

                        // if the piece can attack, continue
                        if (row == attacker.row && col == attacker.col)
                            continue;

                        let hasFound = false;
                        for (let j = 0; j < newCheckInfo.checkCells.length; j++) {
                            let [checkRow, checkCol] = newCheckInfo.checkCells[j];
                            if (row == checkRow && col == checkCol) {
                                hasFound = true;
                                break;
                            }
                        }
                        // remove the cells the piece can't go
                        if (!hasFound) {
                            cells.splice(i, 1);
                        }
                    }
                }

                this.cells[oldRow][oldCol].piece = piece;
            }
            else {

                let attacker = checkState.piecesAttacking[0];

                for (let i = cells.length - 1; i >= 0; i--) {
                    let [row, col] = cells[i];

                    if (row == attacker.row && col == attacker.col)
                        continue;
                    
                    let hasFound = false;
                    for (let j = 0; j < checkState.checkCells.length; j++) {
                        let [checkRow, checkCol] = checkState.checkCells[j];
                        if (checkRow == row && checkCol == col) {
                            hasFound = true;
                            break;
                        }
                    }

                    if (!hasFound) {
                        cells.splice(i, 1);
                    }
                }
            }
        }

        for (let i = 0; i < cells.length; i++) {
            let [row, col] = cells[i];
            let cellPiece = this.getPieceIn(row, col);

            if (cellPiece) {
                if (cellPiece.isPlayer != piece.isPlayer) {
                    this.setCellAttacked(row, col, true);
                }
            }
            else {
                if (piece.kind == PieceKind.Pawn) {
                    // en passant stuff
                    let cellPiece = this.getPieceIn(row + 1, col);
                    if (cellPiece && cellPiece.isEnPassant) {
                        this.setCellAttacked(row, col, true);
                    }
                    else {
                        this.setCellAvailable(row, col, true);
                    }
                }
                else {
                    this.setCellAvailable(row, col, true);
                }
            }
        }

        this.redrawBoard();
    }

    private getCastlesInfo(): CastlesInfo {
        let king = this.pieces[this.color].king;

        let rookCol = 0;
        let fromCol = 0, toCol = 0;

        let canQueenCastle = true;
        let canKingCastle = true;

        if (!king.hasMoved) {

            // checks if can king side castle
            if (this.color == Color.Black) {
                // left rook
                rookCol = 0;
                fromCol = 1;
                toCol = 2;
            }
            else {
                // right rook
                rookCol = 7;
                fromCol = 5;
                toCol = 6;
            }

            let rook = this.getPieceIn(7, rookCol);
            if (rook && rook.kind == PieceKind.Rook && !rook.hasMoved) {
                for (let col = fromCol; col <= toCol; col++) {
                    // if there's a piece in the way, can't castle
                    if (this.getPieceIn(7, col)) {
                        canKingCastle = false;
                        break;
                    }
                    else {
                        // check if the king can go without getting checked
                        let oldRow = king.row;
                        let oldCol = king.col;

                        this.setPieceIn(7, col, king);

                        let checkInfo = this.verifyCheck(this.color, false, false);

                        this.setPieceIn(oldRow, oldCol, king);
                        this.cells[7][col].piece = null;

                        if (checkInfo.isInCheck) {
                            canKingCastle = false;
                            break;
                        }
                    }
                }
            }
            else {
                canKingCastle = false;
            }

            // checks if can queen side castle
            if (this.color == Color.Black) {
                // right rook
                rookCol = 7;
                fromCol = 4;
                toCol = 6;
            }
            else {
                // left rook
                rookCol = 0;
                fromCol = 1;
                toCol = 3;
            }

            rook = this.getPieceIn(7, rookCol);
            if (rook && rook.kind == PieceKind.Rook && !rook.hasMoved) {
                for (let col = fromCol; col <= toCol; col++) {
                    // if there's a piece in the way, can't castle
                    if (this.getPieceIn(7, col)) {
                        canQueenCastle = false;
                        break;
                    }
                    else {
                        // don't need to check the last col in queen side
                        if (this.color == Color.Black) {
                            if (col == toCol)
                                continue;
                        }
                        else {
                            if (col == fromCol)
                                continue;
                        }

                        // check if the king can go without getting checked
                        let oldRow = king.row;
                        let oldCol = king.col;

                        this.setPieceIn(7, col, king);

                        let checkInfo = this.verifyCheck(this.color, false, false);

                        this.setPieceIn(oldRow, oldCol, king);
                        this.cells[7][col].piece = null;

                        if (checkInfo.isInCheck) {
                            canQueenCastle = false;
                            break;
                        }
                    }
                }
            }
            else {
                canQueenCastle = false;
            }
        }
        else {
            canKingCastle = false;
            canQueenCastle = false;
        }

        return {
            canKingCastle: canKingCastle,
            canQueenCastle: canQueenCastle
        };
    }
    
    private _color : Color = Color.White;
    public get color() : Color {
        return this._color;
    }
    public set color(v : Color) {
        for (const key in this.pieces[this.color]) {
            let piece = this.pieces[this.color][key];
            piece.isPlayer = false;
            piece.buttonMode = false
            piece.interactive = false;
            
            let otherPiece = this.pieces[v][key];
            otherPiece.isPlayer = true;
            otherPiece.buttonMode = true;
            otherPiece.interactive = true;
        }

        this._color = v;
    }

    private get enemyColor(): string {
        return this.color == Color.Black ? Color.White : Color.Black;
    }
}