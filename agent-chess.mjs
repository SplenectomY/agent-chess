#!/usr/bin/env node
// Agent Chess CLI — generated from tools/cli.mjs by tools/build.sh. Includes chess.js (BSD-2-Clause, (c) Jeff Hlywa).
// tools/cli.mjs
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";

// vendor/chess.js
/*! chess.js v1.4.0 | (c) 2025 Jeff Hlywa | BSD-2-Clause | https://github.com/jhlywa/chess.js — bundled without the PGN parser */
function parse(_, __) {
  throw new Error("loadPgn is not available in this build");
}
var MASK64 = 0xffffffffffffffffn;
function rotl(x, k) {
  return (x << k | x >> 64n - k) & 0xffffffffffffffffn;
}
function wrappingMul(x, y) {
  return x * y & MASK64;
}
function xoroshiro128(state) {
  return function() {
    let s0 = BigInt(state & MASK64);
    let s1 = BigInt(state >> 64n & MASK64);
    const result = wrappingMul(rotl(wrappingMul(s0, 5n), 7n), 9n);
    s1 ^= s0;
    s0 = (rotl(s0, 24n) ^ s1 ^ s1 << 16n) & MASK64;
    s1 = rotl(s1, 37n);
    state = s1 << 64n | s0;
    return result;
  };
}
var rand = xoroshiro128(0xa187eb39cdcaed8f31c4b365b102e01en);
var PIECE_KEYS = Array.from({ length: 2 }, () => Array.from({ length: 6 }, () => Array.from({ length: 128 }, () => rand())));
var EP_KEYS = Array.from({ length: 8 }, () => rand());
var CASTLING_KEYS = Array.from({ length: 16 }, () => rand());
var SIDE_KEY = rand();
var WHITE = "w";
var BLACK = "b";
var PAWN = "p";
var KNIGHT = "n";
var BISHOP = "b";
var ROOK = "r";
var QUEEN = "q";
var KING = "k";
var SUFFIX_LIST = ["!", "?", "!!", "!?", "?!", "??"];
var DEFAULT_POSITION = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

class Move {
  color;
  from;
  to;
  piece;
  captured;
  promotion;
  flags;
  san;
  lan;
  before;
  after;
  constructor(internal, san, before, after) {
    const { color, piece, from, to, flags, captured, promotion } = internal;
    const fromAlgebraic = algebraic(from);
    const toAlgebraic = algebraic(to);
    this.color = color;
    this.piece = piece;
    this.from = fromAlgebraic;
    this.to = toAlgebraic;
    this.san = san;
    this.lan = fromAlgebraic + toAlgebraic;
    this.before = before;
    this.after = after;
    this.flags = "";
    for (const flag in BITS) {
      if (BITS[flag] & flags) {
        this.flags += FLAGS[flag];
      }
    }
    if (captured) {
      this.captured = captured;
    }
    if (promotion) {
      this.promotion = promotion;
      this.lan += promotion;
    }
  }
  isCapture() {
    return this.flags.indexOf(FLAGS["CAPTURE"]) > -1;
  }
  isPromotion() {
    return this.flags.indexOf(FLAGS["PROMOTION"]) > -1;
  }
  isEnPassant() {
    return this.flags.indexOf(FLAGS["EP_CAPTURE"]) > -1;
  }
  isKingsideCastle() {
    return this.flags.indexOf(FLAGS["KSIDE_CASTLE"]) > -1;
  }
  isQueensideCastle() {
    return this.flags.indexOf(FLAGS["QSIDE_CASTLE"]) > -1;
  }
  isBigPawn() {
    return this.flags.indexOf(FLAGS["BIG_PAWN"]) > -1;
  }
  isNullMove() {
    return this.flags.indexOf(FLAGS["NULL_MOVE"]) > -1;
  }
  isCheck() {
    return this.san.includes("+") || this.san.includes("#");
  }
}
var EMPTY = -1;
var FLAGS = {
  NORMAL: "n",
  CAPTURE: "c",
  BIG_PAWN: "b",
  EP_CAPTURE: "e",
  PROMOTION: "p",
  KSIDE_CASTLE: "k",
  QSIDE_CASTLE: "q",
  NULL_MOVE: "-"
};
var BITS = {
  NORMAL: 1,
  CAPTURE: 2,
  BIG_PAWN: 4,
  EP_CAPTURE: 8,
  PROMOTION: 16,
  KSIDE_CASTLE: 32,
  QSIDE_CASTLE: 64,
  NULL_MOVE: 128
};
var SEVEN_TAG_ROSTER = {
  Event: "?",
  Site: "?",
  Date: "????.??.??",
  Round: "?",
  White: "?",
  Black: "?",
  Result: "*"
};
var SUPLEMENTAL_TAGS = {
  WhiteTitle: null,
  BlackTitle: null,
  WhiteElo: null,
  BlackElo: null,
  WhiteUSCF: null,
  BlackUSCF: null,
  WhiteNA: null,
  BlackNA: null,
  WhiteType: null,
  BlackType: null,
  EventDate: null,
  EventSponsor: null,
  Section: null,
  Stage: null,
  Board: null,
  Opening: null,
  Variation: null,
  SubVariation: null,
  ECO: null,
  NIC: null,
  Time: null,
  UTCTime: null,
  UTCDate: null,
  TimeControl: null,
  SetUp: null,
  FEN: null,
  Termination: null,
  Annotator: null,
  Mode: null,
  PlyCount: null
};
var HEADER_TEMPLATE = {
  ...SEVEN_TAG_ROSTER,
  ...SUPLEMENTAL_TAGS
};
var Ox88 = {
  a8: 0,
  b8: 1,
  c8: 2,
  d8: 3,
  e8: 4,
  f8: 5,
  g8: 6,
  h8: 7,
  a7: 16,
  b7: 17,
  c7: 18,
  d7: 19,
  e7: 20,
  f7: 21,
  g7: 22,
  h7: 23,
  a6: 32,
  b6: 33,
  c6: 34,
  d6: 35,
  e6: 36,
  f6: 37,
  g6: 38,
  h6: 39,
  a5: 48,
  b5: 49,
  c5: 50,
  d5: 51,
  e5: 52,
  f5: 53,
  g5: 54,
  h5: 55,
  a4: 64,
  b4: 65,
  c4: 66,
  d4: 67,
  e4: 68,
  f4: 69,
  g4: 70,
  h4: 71,
  a3: 80,
  b3: 81,
  c3: 82,
  d3: 83,
  e3: 84,
  f3: 85,
  g3: 86,
  h3: 87,
  a2: 96,
  b2: 97,
  c2: 98,
  d2: 99,
  e2: 100,
  f2: 101,
  g2: 102,
  h2: 103,
  a1: 112,
  b1: 113,
  c1: 114,
  d1: 115,
  e1: 116,
  f1: 117,
  g1: 118,
  h1: 119
};
var PAWN_OFFSETS = {
  b: [16, 32, 17, 15],
  w: [-16, -32, -17, -15]
};
var PIECE_OFFSETS = {
  n: [-18, -33, -31, -14, 18, 33, 31, 14],
  b: [-17, -15, 17, 15],
  r: [-16, 1, 16, -1],
  q: [-17, -16, -15, 1, 17, 16, 15, -1],
  k: [-17, -16, -15, 1, 17, 16, 15, -1]
};
var ATTACKS = [
  20,
  0,
  0,
  0,
  0,
  0,
  0,
  24,
  0,
  0,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  0,
  24,
  0,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  24,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  24,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  24,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  20,
  2,
  24,
  2,
  20,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  2,
  53,
  56,
  53,
  2,
  0,
  0,
  0,
  0,
  0,
  0,
  24,
  24,
  24,
  24,
  24,
  24,
  56,
  0,
  56,
  24,
  24,
  24,
  24,
  24,
  24,
  0,
  0,
  0,
  0,
  0,
  0,
  2,
  53,
  56,
  53,
  2,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  20,
  2,
  24,
  2,
  20,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  24,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  24,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  24,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  0,
  24,
  0,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  0,
  0,
  24,
  0,
  0,
  0,
  0,
  0,
  0,
  20
];
var RAYS = [
  17,
  0,
  0,
  0,
  0,
  0,
  0,
  16,
  0,
  0,
  0,
  0,
  0,
  0,
  15,
  0,
  0,
  17,
  0,
  0,
  0,
  0,
  0,
  16,
  0,
  0,
  0,
  0,
  0,
  15,
  0,
  0,
  0,
  0,
  17,
  0,
  0,
  0,
  0,
  16,
  0,
  0,
  0,
  0,
  15,
  0,
  0,
  0,
  0,
  0,
  0,
  17,
  0,
  0,
  0,
  16,
  0,
  0,
  0,
  15,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  17,
  0,
  0,
  16,
  0,
  0,
  15,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  17,
  0,
  16,
  0,
  15,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  17,
  16,
  15,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  0,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  -15,
  -16,
  -17,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  -15,
  0,
  -16,
  0,
  -17,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  -15,
  0,
  0,
  -16,
  0,
  0,
  -17,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  -15,
  0,
  0,
  0,
  -16,
  0,
  0,
  0,
  -17,
  0,
  0,
  0,
  0,
  0,
  0,
  -15,
  0,
  0,
  0,
  0,
  -16,
  0,
  0,
  0,
  0,
  -17,
  0,
  0,
  0,
  0,
  -15,
  0,
  0,
  0,
  0,
  0,
  -16,
  0,
  0,
  0,
  0,
  0,
  -17,
  0,
  0,
  -15,
  0,
  0,
  0,
  0,
  0,
  0,
  -16,
  0,
  0,
  0,
  0,
  0,
  0,
  -17
];
var PIECE_MASKS = { p: 1, n: 2, b: 4, r: 8, q: 16, k: 32 };
var SYMBOLS = "pnbrqkPNBRQK";
var PROMOTIONS = [KNIGHT, BISHOP, ROOK, QUEEN];
var RANK_1 = 7;
var RANK_2 = 6;
var RANK_7 = 1;
var RANK_8 = 0;
var SIDES = {
  [KING]: BITS.KSIDE_CASTLE,
  [QUEEN]: BITS.QSIDE_CASTLE
};
var ROOKS = {
  w: [
    { square: Ox88.a1, flag: BITS.QSIDE_CASTLE },
    { square: Ox88.h1, flag: BITS.KSIDE_CASTLE }
  ],
  b: [
    { square: Ox88.a8, flag: BITS.QSIDE_CASTLE },
    { square: Ox88.h8, flag: BITS.KSIDE_CASTLE }
  ]
};
var SECOND_RANK = { b: RANK_7, w: RANK_2 };
var SAN_NULLMOVE = "--";
function rank(square) {
  return square >> 4;
}
function file(square) {
  return square & 15;
}
function isDigit(c) {
  return "0123456789".indexOf(c) !== -1;
}
function algebraic(square) {
  const f = file(square);
  const r = rank(square);
  return "abcdefgh".substring(f, f + 1) + "87654321".substring(r, r + 1);
}
function swapColor(color) {
  return color === WHITE ? BLACK : WHITE;
}
function validateFen(fen) {
  const tokens = fen.split(/\s+/);
  if (tokens.length !== 6) {
    return {
      ok: false,
      error: "Invalid FEN: must contain six space-delimited fields"
    };
  }
  const moveNumber = parseInt(tokens[5], 10);
  if (isNaN(moveNumber) || moveNumber <= 0) {
    return {
      ok: false,
      error: "Invalid FEN: move number must be a positive integer"
    };
  }
  const halfMoves = parseInt(tokens[4], 10);
  if (isNaN(halfMoves) || halfMoves < 0) {
    return {
      ok: false,
      error: "Invalid FEN: half move counter number must be a non-negative integer"
    };
  }
  if (!/^(-|[abcdefgh][36])$/.test(tokens[3])) {
    return { ok: false, error: "Invalid FEN: en-passant square is invalid" };
  }
  if (/[^kKqQ-]/.test(tokens[2])) {
    return { ok: false, error: "Invalid FEN: castling availability is invalid" };
  }
  if (!/^(w|b)$/.test(tokens[1])) {
    return { ok: false, error: "Invalid FEN: side-to-move is invalid" };
  }
  const rows = tokens[0].split("/");
  if (rows.length !== 8) {
    return {
      ok: false,
      error: "Invalid FEN: piece data does not contain 8 '/'-delimited rows"
    };
  }
  for (let i = 0;i < rows.length; i++) {
    let sumFields = 0;
    let previousWasNumber = false;
    for (let k = 0;k < rows[i].length; k++) {
      if (isDigit(rows[i][k])) {
        if (previousWasNumber) {
          return {
            ok: false,
            error: "Invalid FEN: piece data is invalid (consecutive number)"
          };
        }
        sumFields += parseInt(rows[i][k], 10);
        previousWasNumber = true;
      } else {
        if (!/^[prnbqkPRNBQK]$/.test(rows[i][k])) {
          return {
            ok: false,
            error: "Invalid FEN: piece data is invalid (invalid piece)"
          };
        }
        sumFields += 1;
        previousWasNumber = false;
      }
    }
    if (sumFields !== 8) {
      return {
        ok: false,
        error: "Invalid FEN: piece data is invalid (too many squares in rank)"
      };
    }
  }
  if (tokens[3][1] == "3" && tokens[1] == "w" || tokens[3][1] == "6" && tokens[1] == "b") {
    return { ok: false, error: "Invalid FEN: illegal en-passant square" };
  }
  const kings = [
    { color: "white", regex: /K/g },
    { color: "black", regex: /k/g }
  ];
  for (const { color, regex } of kings) {
    if (!regex.test(tokens[0])) {
      return { ok: false, error: `Invalid FEN: missing ${color} king` };
    }
    if ((tokens[0].match(regex) || []).length > 1) {
      return { ok: false, error: `Invalid FEN: too many ${color} kings` };
    }
  }
  if (Array.from(rows[0] + rows[7]).some((char) => char.toUpperCase() === "P")) {
    return {
      ok: false,
      error: "Invalid FEN: some pawns are on the edge rows"
    };
  }
  return { ok: true };
}
function getDisambiguator(move, moves) {
  const from = move.from;
  const to = move.to;
  const piece = move.piece;
  let ambiguities = 0;
  let sameRank = 0;
  let sameFile = 0;
  for (let i = 0, len = moves.length;i < len; i++) {
    const ambigFrom = moves[i].from;
    const ambigTo = moves[i].to;
    const ambigPiece = moves[i].piece;
    if (piece === ambigPiece && from !== ambigFrom && to === ambigTo) {
      ambiguities++;
      if (rank(from) === rank(ambigFrom)) {
        sameRank++;
      }
      if (file(from) === file(ambigFrom)) {
        sameFile++;
      }
    }
  }
  if (ambiguities > 0) {
    if (sameRank > 0 && sameFile > 0) {
      return algebraic(from);
    } else if (sameFile > 0) {
      return algebraic(from).charAt(1);
    } else {
      return algebraic(from).charAt(0);
    }
  }
  return "";
}
function addMove(moves, color, from, to, piece, captured = undefined, flags = BITS.NORMAL) {
  const r = rank(to);
  if (piece === PAWN && (r === RANK_1 || r === RANK_8)) {
    for (let i = 0;i < PROMOTIONS.length; i++) {
      const promotion = PROMOTIONS[i];
      moves.push({
        color,
        from,
        to,
        piece,
        captured,
        promotion,
        flags: flags | BITS.PROMOTION
      });
    }
  } else {
    moves.push({
      color,
      from,
      to,
      piece,
      captured,
      flags
    });
  }
}
function inferPieceType(san) {
  let pieceType = san.charAt(0);
  if (pieceType >= "a" && pieceType <= "h") {
    const matches = san.match(/[a-h]\d.*[a-h]\d/);
    if (matches) {
      return;
    }
    return PAWN;
  }
  pieceType = pieceType.toLowerCase();
  if (pieceType === "o") {
    return KING;
  }
  return pieceType;
}
function strippedSan(move) {
  return move.replace(/=/, "").replace(/[+#]?[?!]*$/, "");
}

class Chess {
  _board = new Array(128);
  _turn = WHITE;
  _header = {};
  _kings = { w: EMPTY, b: EMPTY };
  _epSquare = -1;
  _fenEpSquare = -1;
  _halfMoves = 0;
  _moveNumber = 0;
  _history = [];
  _comments = {};
  _suffixes = {};
  _nags = {};
  _castling = { w: 0, b: 0 };
  _hash = 0n;
  _positionCount = new Map;
  constructor(fen = DEFAULT_POSITION, { skipValidation = false } = {}) {
    this._comments = {};
    this._suffixes = {};
    this._nags = {};
    this.load(fen, { skipValidation });
  }
  clear({ preserveHeaders = false } = {}) {
    this._board = new Array(128);
    this._kings = { w: EMPTY, b: EMPTY };
    this._turn = WHITE;
    this._castling = { w: 0, b: 0 };
    this._epSquare = EMPTY;
    this._fenEpSquare = EMPTY;
    this._halfMoves = 0;
    this._moveNumber = 1;
    this._history = [];
    this._comments = {};
    this._header = preserveHeaders ? this._header : { ...HEADER_TEMPLATE };
    this._hash = this._computeHash();
    this._positionCount = new Map;
    this._header["SetUp"] = null;
    this._header["FEN"] = null;
  }
  load(fen, { skipValidation = false, preserveHeaders = false } = {}) {
    let tokens = fen.split(/\s+/);
    if (tokens.length >= 2 && tokens.length < 6) {
      const adjustments = ["-", "-", "0", "1"];
      fen = tokens.concat(adjustments.slice(-(6 - tokens.length))).join(" ");
    }
    tokens = fen.split(/\s+/);
    if (!skipValidation) {
      const { ok, error } = validateFen(fen);
      if (!ok) {
        throw new Error(error);
      }
    }
    const position = tokens[0];
    let square = 0;
    this.clear({ preserveHeaders });
    for (let i = 0;i < position.length; i++) {
      const piece = position.charAt(i);
      if (piece === "/") {
        square += 8;
      } else if (isDigit(piece)) {
        square += parseInt(piece, 10);
      } else {
        const color = piece < "a" ? WHITE : BLACK;
        this._put({ type: piece.toLowerCase(), color }, algebraic(square));
        square++;
      }
    }
    this._turn = tokens[1];
    if (tokens[2].indexOf("K") > -1) {
      this._castling.w |= BITS.KSIDE_CASTLE;
    }
    if (tokens[2].indexOf("Q") > -1) {
      this._castling.w |= BITS.QSIDE_CASTLE;
    }
    if (tokens[2].indexOf("k") > -1) {
      this._castling.b |= BITS.KSIDE_CASTLE;
    }
    if (tokens[2].indexOf("q") > -1) {
      this._castling.b |= BITS.QSIDE_CASTLE;
    }
    this._updateCastlingRights();
    this._epSquare = tokens[3] === "-" ? EMPTY : Ox88[tokens[3]];
    this._fenEpSquare = this._epSquare;
    this._halfMoves = parseInt(tokens[4], 10);
    this._moveNumber = parseInt(tokens[5], 10);
    this._hash = this._computeHash();
    this._updateSetup(fen);
    this._incPositionCount();
  }
  fen({
    forceEnpassantSquare = false
  } = {}) {
    let empty = 0;
    let fen = "";
    for (let i = Ox88.a8;i <= Ox88.h1; i++) {
      if (this._board[i]) {
        if (empty > 0) {
          fen += empty;
          empty = 0;
        }
        const { color, type: piece } = this._board[i];
        fen += color === WHITE ? piece.toUpperCase() : piece.toLowerCase();
      } else {
        empty++;
      }
      if (i + 1 & 136) {
        if (empty > 0) {
          fen += empty;
        }
        if (i !== Ox88.h1) {
          fen += "/";
        }
        empty = 0;
        i += 8;
      }
    }
    let castling = "";
    if (this._castling[WHITE] & BITS.KSIDE_CASTLE) {
      castling += "K";
    }
    if (this._castling[WHITE] & BITS.QSIDE_CASTLE) {
      castling += "Q";
    }
    if (this._castling[BLACK] & BITS.KSIDE_CASTLE) {
      castling += "k";
    }
    if (this._castling[BLACK] & BITS.QSIDE_CASTLE) {
      castling += "q";
    }
    castling = castling || "-";
    let epSquare = "-";
    if (this._fenEpSquare !== EMPTY) {
      if (forceEnpassantSquare) {
        epSquare = algebraic(this._fenEpSquare);
      } else if (this._epSquare !== EMPTY) {
        const bigPawnSquare = this._epSquare + (this._turn === WHITE ? 16 : -16);
        const squares = [bigPawnSquare + 1, bigPawnSquare - 1];
        for (const square of squares) {
          if (square & 136) {
            continue;
          }
          const color = this._turn;
          if (this._board[square]?.color === color && this._board[square]?.type === PAWN) {
            this._makeMove({
              color,
              from: square,
              to: this._epSquare,
              piece: PAWN,
              captured: PAWN,
              flags: BITS.EP_CAPTURE
            });
            const isLegal = !this._isKingAttacked(color);
            this._undoMove();
            if (isLegal) {
              epSquare = algebraic(this._epSquare);
              break;
            }
          }
        }
      }
    }
    return [
      fen,
      this._turn,
      castling,
      epSquare,
      this._halfMoves,
      this._moveNumber
    ].join(" ");
  }
  _pieceKey(i) {
    if (!this._board[i]) {
      return 0n;
    }
    const { color, type } = this._board[i];
    const colorIndex = {
      w: 0,
      b: 1
    }[color];
    const typeIndex = {
      p: 0,
      n: 1,
      b: 2,
      r: 3,
      q: 4,
      k: 5
    }[type];
    return PIECE_KEYS[colorIndex][typeIndex][i];
  }
  _epKey() {
    return this._epSquare === EMPTY ? 0n : EP_KEYS[this._epSquare & 7];
  }
  _castlingKey() {
    const index = this._castling.w >> 5 | this._castling.b >> 3;
    return CASTLING_KEYS[index];
  }
  _computeHash() {
    let hash = 0n;
    for (let i = Ox88.a8;i <= Ox88.h1; i++) {
      if (i & 136) {
        i += 7;
        continue;
      }
      if (this._board[i]) {
        hash ^= this._pieceKey(i);
      }
    }
    hash ^= this._epKey();
    hash ^= this._castlingKey();
    if (this._turn === "b") {
      hash ^= SIDE_KEY;
    }
    return hash;
  }
  _updateSetup(fen) {
    if (this._history.length > 0)
      return;
    if (fen !== DEFAULT_POSITION) {
      this._header["SetUp"] = "1";
      this._header["FEN"] = fen;
    } else {
      this._header["SetUp"] = null;
      this._header["FEN"] = null;
    }
  }
  reset() {
    this.load(DEFAULT_POSITION);
    this._comments = {};
    this._suffixes = {};
    this._nags = {};
  }
  get(square) {
    return this._board[Ox88[square]];
  }
  findPiece(piece) {
    const squares = [];
    for (let i = Ox88.a8;i <= Ox88.h1; i++) {
      if (i & 136) {
        i += 7;
        continue;
      }
      if (!this._board[i] || this._board[i]?.color !== piece.color) {
        continue;
      }
      if (this._board[i].color === piece.color && this._board[i].type === piece.type) {
        squares.push(algebraic(i));
      }
    }
    return squares;
  }
  put({ type, color }, square) {
    if (this._put({ type, color }, square)) {
      this._updateCastlingRights();
      this._updateEnPassantSquare();
      this._updateSetup(this.fen());
      return true;
    }
    return false;
  }
  _set(sq, piece) {
    this._hash ^= this._pieceKey(sq);
    this._board[sq] = piece;
    this._hash ^= this._pieceKey(sq);
  }
  _put({ type, color }, square) {
    if (SYMBOLS.indexOf(type.toLowerCase()) === -1) {
      return false;
    }
    if (!(square in Ox88)) {
      return false;
    }
    const sq = Ox88[square];
    if (type == KING && !(this._kings[color] == EMPTY || this._kings[color] == sq)) {
      return false;
    }
    const currentPieceOnSquare = this._board[sq];
    if (currentPieceOnSquare && currentPieceOnSquare.type === KING) {
      this._kings[currentPieceOnSquare.color] = EMPTY;
    }
    this._set(sq, { type, color });
    if (type === KING) {
      this._kings[color] = sq;
    }
    return true;
  }
  _clear(sq) {
    this._hash ^= this._pieceKey(sq);
    delete this._board[sq];
  }
  remove(square) {
    const piece = this.get(square);
    this._clear(Ox88[square]);
    if (piece && piece.type === KING) {
      this._kings[piece.color] = EMPTY;
    }
    this._updateCastlingRights();
    this._updateEnPassantSquare();
    this._updateSetup(this.fen());
    return piece;
  }
  _updateCastlingRights() {
    this._hash ^= this._castlingKey();
    const whiteKingInPlace = this._board[Ox88.e1]?.type === KING && this._board[Ox88.e1]?.color === WHITE;
    const blackKingInPlace = this._board[Ox88.e8]?.type === KING && this._board[Ox88.e8]?.color === BLACK;
    if (!whiteKingInPlace || this._board[Ox88.a1]?.type !== ROOK || this._board[Ox88.a1]?.color !== WHITE) {
      this._castling.w &= ~BITS.QSIDE_CASTLE;
    }
    if (!whiteKingInPlace || this._board[Ox88.h1]?.type !== ROOK || this._board[Ox88.h1]?.color !== WHITE) {
      this._castling.w &= ~BITS.KSIDE_CASTLE;
    }
    if (!blackKingInPlace || this._board[Ox88.a8]?.type !== ROOK || this._board[Ox88.a8]?.color !== BLACK) {
      this._castling.b &= ~BITS.QSIDE_CASTLE;
    }
    if (!blackKingInPlace || this._board[Ox88.h8]?.type !== ROOK || this._board[Ox88.h8]?.color !== BLACK) {
      this._castling.b &= ~BITS.KSIDE_CASTLE;
    }
    this._hash ^= this._castlingKey();
  }
  _updateEnPassantSquare() {
    if (this._epSquare === EMPTY) {
      return;
    }
    const startSquare = this._epSquare + (this._turn === WHITE ? -16 : 16);
    const currentSquare = this._epSquare + (this._turn === WHITE ? 16 : -16);
    const attackers = [currentSquare + 1, currentSquare - 1];
    if (this._board[startSquare] !== null || this._board[this._epSquare] !== null || this._board[currentSquare]?.color !== swapColor(this._turn) || this._board[currentSquare]?.type !== PAWN) {
      this._hash ^= this._epKey();
      this._epSquare = EMPTY;
      return;
    }
    const canCapture = (square) => !(square & 136) && this._board[square]?.color === this._turn && this._board[square]?.type === PAWN;
    if (!attackers.some(canCapture)) {
      this._hash ^= this._epKey();
      this._epSquare = EMPTY;
    }
  }
  _attacked(color, square, verbose) {
    const attackers = [];
    for (let i = Ox88.a8;i <= Ox88.h1; i++) {
      if (i & 136) {
        i += 7;
        continue;
      }
      if (this._board[i] === undefined || this._board[i].color !== color) {
        continue;
      }
      const piece = this._board[i];
      const difference = i - square;
      if (difference === 0) {
        continue;
      }
      const index = difference + 119;
      if (ATTACKS[index] & PIECE_MASKS[piece.type]) {
        if (piece.type === PAWN) {
          if (difference > 0 && piece.color === WHITE || difference <= 0 && piece.color === BLACK) {
            if (!verbose) {
              return true;
            } else {
              attackers.push(algebraic(i));
            }
          }
          continue;
        }
        if (piece.type === "n" || piece.type === "k") {
          if (!verbose) {
            return true;
          } else {
            attackers.push(algebraic(i));
            continue;
          }
        }
        const offset = RAYS[index];
        let j = i + offset;
        let blocked = false;
        while (j !== square) {
          if (this._board[j] != null) {
            blocked = true;
            break;
          }
          j += offset;
        }
        if (!blocked) {
          if (!verbose) {
            return true;
          } else {
            attackers.push(algebraic(i));
            continue;
          }
        }
      }
    }
    if (verbose) {
      return attackers;
    } else {
      return false;
    }
  }
  attackers(square, attackedBy) {
    if (!attackedBy) {
      return this._attacked(this._turn, Ox88[square], true);
    } else {
      return this._attacked(attackedBy, Ox88[square], true);
    }
  }
  _isKingAttacked(color) {
    const square = this._kings[color];
    return square === -1 ? false : this._attacked(swapColor(color), square);
  }
  hash() {
    return this._hash.toString(16);
  }
  isAttacked(square, attackedBy) {
    return this._attacked(attackedBy, Ox88[square]);
  }
  isCheck() {
    return this._isKingAttacked(this._turn);
  }
  inCheck() {
    return this.isCheck();
  }
  isCheckmate() {
    return this.isCheck() && this._moves().length === 0;
  }
  isStalemate() {
    return !this.isCheck() && this._moves().length === 0;
  }
  isInsufficientMaterial() {
    const pieces = {
      b: 0,
      n: 0,
      r: 0,
      q: 0,
      k: 0,
      p: 0
    };
    const bishops = [];
    let numPieces = 0;
    let squareColor = 0;
    for (let i = Ox88.a8;i <= Ox88.h1; i++) {
      squareColor = (squareColor + 1) % 2;
      if (i & 136) {
        i += 7;
        continue;
      }
      const piece = this._board[i];
      if (piece) {
        pieces[piece.type] = piece.type in pieces ? pieces[piece.type] + 1 : 1;
        if (piece.type === BISHOP) {
          bishops.push(squareColor);
        }
        numPieces++;
      }
    }
    if (numPieces === 2) {
      return true;
    } else if (numPieces === 3 && (pieces[BISHOP] === 1 || pieces[KNIGHT] === 1)) {
      return true;
    } else if (numPieces === pieces[BISHOP] + 2) {
      let sum = 0;
      const len = bishops.length;
      for (let i = 0;i < len; i++) {
        sum += bishops[i];
      }
      if (sum === 0 || sum === len) {
        return true;
      }
    }
    return false;
  }
  isThreefoldRepetition() {
    return this._getPositionCount(this._hash) >= 3;
  }
  isDrawByFiftyMoves() {
    return this._halfMoves >= 100;
  }
  isDraw() {
    return this.isDrawByFiftyMoves() || this.isStalemate() || this.isInsufficientMaterial() || this.isThreefoldRepetition();
  }
  isGameOver() {
    return this.isCheckmate() || this.isDraw();
  }
  isPromotion({ from, to }) {
    return this._moves({ square: from, piece: "p" }).some((move) => move.to === Ox88[to] && move.promotion);
  }
  _createMove(internal) {
    const san = this._moveToSan(internal, this._moves({ legal: true }));
    const before = this.fen();
    this._makeMove(internal);
    const after = this.fen();
    this._undoMove();
    return new Move(internal, san, before, after);
  }
  moves({
    verbose = false,
    square = undefined,
    piece = undefined
  } = {}) {
    const moves = this._moves({ square, piece });
    if (verbose) {
      return moves.map((move) => this._createMove(move));
    } else {
      return moves.map((move) => this._moveToSan(move, moves));
    }
  }
  _moves({
    legal = true,
    piece = undefined,
    square = undefined
  } = {}) {
    const forSquare = square ? square.toLowerCase() : undefined;
    const forPiece = piece?.toLowerCase();
    const moves = [];
    const us = this._turn;
    const them = swapColor(us);
    let firstSquare = Ox88.a8;
    let lastSquare = Ox88.h1;
    let singleSquare = false;
    if (forSquare) {
      if (!(forSquare in Ox88)) {
        return [];
      } else {
        firstSquare = lastSquare = Ox88[forSquare];
        singleSquare = true;
      }
    }
    for (let from = firstSquare;from <= lastSquare; from++) {
      if (from & 136) {
        from += 7;
        continue;
      }
      if (!this._board[from] || this._board[from].color === them) {
        continue;
      }
      const { type } = this._board[from];
      let to;
      if (type === PAWN) {
        if (forPiece && forPiece !== type)
          continue;
        to = from + PAWN_OFFSETS[us][0];
        if (!this._board[to]) {
          addMove(moves, us, from, to, PAWN);
          to = from + PAWN_OFFSETS[us][1];
          if (SECOND_RANK[us] === rank(from) && !this._board[to]) {
            addMove(moves, us, from, to, PAWN, undefined, BITS.BIG_PAWN);
          }
        }
        for (let j = 2;j < 4; j++) {
          to = from + PAWN_OFFSETS[us][j];
          if (to & 136)
            continue;
          if (this._board[to]?.color === them) {
            addMove(moves, us, from, to, PAWN, this._board[to].type, BITS.CAPTURE);
          } else if (to === this._epSquare) {
            addMove(moves, us, from, to, PAWN, PAWN, BITS.EP_CAPTURE);
          }
        }
      } else {
        if (forPiece && forPiece !== type)
          continue;
        for (let j = 0, len = PIECE_OFFSETS[type].length;j < len; j++) {
          const offset = PIECE_OFFSETS[type][j];
          to = from;
          while (true) {
            to += offset;
            if (to & 136)
              break;
            if (!this._board[to]) {
              addMove(moves, us, from, to, type);
            } else {
              if (this._board[to].color === us)
                break;
              addMove(moves, us, from, to, type, this._board[to].type, BITS.CAPTURE);
              break;
            }
            if (type === KNIGHT || type === KING)
              break;
          }
        }
      }
    }
    if (forPiece === undefined || forPiece === KING) {
      if (!singleSquare || lastSquare === this._kings[us]) {
        if (this._castling[us] & BITS.KSIDE_CASTLE) {
          const castlingFrom = this._kings[us];
          const castlingTo = castlingFrom + 2;
          if (!this._board[castlingFrom + 1] && !this._board[castlingTo] && !this._attacked(them, this._kings[us]) && !this._attacked(them, castlingFrom + 1) && !this._attacked(them, castlingTo)) {
            addMove(moves, us, this._kings[us], castlingTo, KING, undefined, BITS.KSIDE_CASTLE);
          }
        }
        if (this._castling[us] & BITS.QSIDE_CASTLE) {
          const castlingFrom = this._kings[us];
          const castlingTo = castlingFrom - 2;
          if (!this._board[castlingFrom - 1] && !this._board[castlingFrom - 2] && !this._board[castlingFrom - 3] && !this._attacked(them, this._kings[us]) && !this._attacked(them, castlingFrom - 1) && !this._attacked(them, castlingTo)) {
            addMove(moves, us, this._kings[us], castlingTo, KING, undefined, BITS.QSIDE_CASTLE);
          }
        }
      }
    }
    if (!legal || this._kings[us] === -1) {
      return moves;
    }
    const legalMoves = [];
    for (let i = 0, len = moves.length;i < len; i++) {
      this._makeMove(moves[i]);
      if (!this._isKingAttacked(us)) {
        legalMoves.push(moves[i]);
      }
      this._undoMove();
    }
    return legalMoves;
  }
  move(move, { strict = false } = {}) {
    let moveObj = null;
    if (typeof move === "string") {
      moveObj = this._moveFromSan(move, strict);
    } else if (move === null) {
      moveObj = this._moveFromSan(SAN_NULLMOVE, strict);
    } else if (typeof move === "object") {
      const moves = this._moves();
      for (let i = 0, len = moves.length;i < len; i++) {
        if (move.from === algebraic(moves[i].from) && move.to === algebraic(moves[i].to) && (!("promotion" in moves[i]) || move.promotion === moves[i].promotion)) {
          moveObj = moves[i];
          break;
        }
      }
    }
    if (!moveObj) {
      if (typeof move === "string") {
        throw new Error(`Invalid move: ${move}`);
      } else {
        throw new Error(`Invalid move: ${JSON.stringify(move)}`);
      }
    }
    if (this.isCheck() && moveObj.flags & BITS.NULL_MOVE) {
      throw new Error("Null move not allowed when in check");
    }
    const prettyMove = this._createMove(moveObj);
    this._makeMove(moveObj);
    this._incPositionCount();
    return prettyMove;
  }
  _push(move) {
    this._history.push({
      move,
      kings: { b: this._kings.b, w: this._kings.w },
      turn: this._turn,
      castling: { b: this._castling.b, w: this._castling.w },
      epSquare: this._epSquare,
      fenEpSquare: this._fenEpSquare,
      halfMoves: this._halfMoves,
      moveNumber: this._moveNumber
    });
  }
  _movePiece(from, to) {
    this._hash ^= this._pieceKey(from);
    this._board[to] = this._board[from];
    delete this._board[from];
    this._hash ^= this._pieceKey(to);
  }
  _makeMove(move) {
    const us = this._turn;
    const them = swapColor(us);
    this._push(move);
    if (move.flags & BITS.NULL_MOVE) {
      if (us === BLACK) {
        this._moveNumber++;
      }
      this._halfMoves++;
      this._turn = them;
      this._epSquare = EMPTY;
      return;
    }
    this._hash ^= this._epKey();
    this._hash ^= this._castlingKey();
    if (move.captured) {
      this._hash ^= this._pieceKey(move.to);
    }
    this._movePiece(move.from, move.to);
    if (move.flags & BITS.EP_CAPTURE) {
      if (this._turn === BLACK) {
        this._clear(move.to - 16);
      } else {
        this._clear(move.to + 16);
      }
    }
    if (move.promotion) {
      this._clear(move.to);
      this._set(move.to, { type: move.promotion, color: us });
    }
    if (this._board[move.to].type === KING) {
      this._kings[us] = move.to;
      if (move.flags & BITS.KSIDE_CASTLE) {
        const castlingTo = move.to - 1;
        const castlingFrom = move.to + 1;
        this._movePiece(castlingFrom, castlingTo);
      } else if (move.flags & BITS.QSIDE_CASTLE) {
        const castlingTo = move.to + 1;
        const castlingFrom = move.to - 2;
        this._movePiece(castlingFrom, castlingTo);
      }
      this._castling[us] = 0;
    }
    if (this._castling[us]) {
      for (let i = 0, len = ROOKS[us].length;i < len; i++) {
        if (move.from === ROOKS[us][i].square && this._castling[us] & ROOKS[us][i].flag) {
          this._castling[us] ^= ROOKS[us][i].flag;
          break;
        }
      }
    }
    if (this._castling[them]) {
      for (let i = 0, len = ROOKS[them].length;i < len; i++) {
        if (move.to === ROOKS[them][i].square && this._castling[them] & ROOKS[them][i].flag) {
          this._castling[them] ^= ROOKS[them][i].flag;
          break;
        }
      }
    }
    this._hash ^= this._castlingKey();
    if (move.flags & BITS.BIG_PAWN) {
      let epSquare;
      if (us === BLACK) {
        epSquare = move.to - 16;
      } else {
        epSquare = move.to + 16;
      }
      this._fenEpSquare = epSquare;
      if (!(move.to - 1 & 136) && this._board[move.to - 1]?.type === PAWN && this._board[move.to - 1]?.color === them || !(move.to + 1 & 136) && this._board[move.to + 1]?.type === PAWN && this._board[move.to + 1]?.color === them) {
        this._epSquare = epSquare;
        this._hash ^= this._epKey();
      } else {
        this._epSquare = EMPTY;
      }
    } else {
      this._epSquare = EMPTY;
      this._fenEpSquare = EMPTY;
    }
    if (move.piece === PAWN) {
      this._halfMoves = 0;
    } else if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
      this._halfMoves = 0;
    } else {
      this._halfMoves++;
    }
    if (us === BLACK) {
      this._moveNumber++;
    }
    this._turn = them;
    this._hash ^= SIDE_KEY;
  }
  undo() {
    const hash = this._hash;
    const move = this._undoMove();
    if (move) {
      const prettyMove = this._createMove(move);
      this._decPositionCount(hash);
      return prettyMove;
    }
    return null;
  }
  _undoMove() {
    const old = this._history.pop();
    if (old === undefined) {
      return null;
    }
    this._hash ^= this._epKey();
    this._hash ^= this._castlingKey();
    const move = old.move;
    this._kings = old.kings;
    this._turn = old.turn;
    this._castling = old.castling;
    this._epSquare = old.epSquare;
    this._fenEpSquare = old.fenEpSquare;
    this._halfMoves = old.halfMoves;
    this._moveNumber = old.moveNumber;
    this._hash ^= this._epKey();
    this._hash ^= this._castlingKey();
    this._hash ^= SIDE_KEY;
    const us = this._turn;
    const them = swapColor(us);
    if (move.flags & BITS.NULL_MOVE) {
      return move;
    }
    this._movePiece(move.to, move.from);
    if (move.piece) {
      this._clear(move.from);
      this._set(move.from, { type: move.piece, color: us });
    }
    if (move.captured) {
      if (move.flags & BITS.EP_CAPTURE) {
        let index;
        if (us === BLACK) {
          index = move.to - 16;
        } else {
          index = move.to + 16;
        }
        this._set(index, { type: PAWN, color: them });
      } else {
        this._set(move.to, { type: move.captured, color: them });
      }
    }
    if (move.flags & (BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE)) {
      let castlingTo, castlingFrom;
      if (move.flags & BITS.KSIDE_CASTLE) {
        castlingTo = move.to + 1;
        castlingFrom = move.to - 1;
      } else {
        castlingTo = move.to - 2;
        castlingFrom = move.to + 1;
      }
      this._movePiece(castlingFrom, castlingTo);
    }
    return move;
  }
  pgn({
    newline = `
`,
    maxWidth = 0
  } = {}) {
    const result = [];
    let headerExists = false;
    for (const i in this._header) {
      const headerTag = this._header[i];
      if (headerTag)
        result.push(`[${i} "${this._header[i]}"]` + newline);
      headerExists = true;
    }
    if (headerExists && this._history.length) {
      result.push(newline);
    }
    const appendComment = (moveString) => {
      const comment = this._comments[this.fen()];
      if (typeof comment !== "undefined") {
        const delimiter = moveString.length > 0 ? " " : "";
        moveString = `${moveString}${delimiter}{${comment}}`;
      }
      return moveString;
    };
    const reversedHistory = [];
    while (this._history.length > 0) {
      reversedHistory.push(this._undoMove());
    }
    const moves = [];
    let moveString = "";
    if (reversedHistory.length === 0) {
      moves.push(appendComment(""));
    }
    while (reversedHistory.length > 0) {
      moveString = appendComment(moveString);
      const move = reversedHistory.pop();
      if (!move) {
        break;
      }
      if (!this._history.length && move.color === "b") {
        const prefix = `${this._moveNumber}. ...`;
        moveString = moveString ? `${moveString} ${prefix}` : prefix;
      } else if (move.color === "w") {
        if (moveString.length) {
          moves.push(moveString);
        }
        moveString = this._moveNumber + ".";
      }
      moveString = moveString + " " + this._moveToSan(move, this._moves({ legal: true }));
      this._makeMove(move);
    }
    if (moveString.length) {
      moves.push(appendComment(moveString));
    }
    moves.push(this._header.Result || "*");
    if (maxWidth === 0) {
      return result.join("") + moves.join(" ");
    }
    const strip = function() {
      if (result.length > 0 && result[result.length - 1] === " ") {
        result.pop();
        return true;
      }
      return false;
    };
    const wrapComment = function(width, move) {
      for (const token of move.split(" ")) {
        if (!token) {
          continue;
        }
        if (width + token.length > maxWidth) {
          while (strip()) {
            width--;
          }
          result.push(newline);
          width = 0;
        }
        result.push(token);
        width += token.length;
        result.push(" ");
        width++;
      }
      if (strip()) {
        width--;
      }
      return width;
    };
    let currentWidth = 0;
    for (let i = 0;i < moves.length; i++) {
      if (currentWidth + moves[i].length > maxWidth) {
        if (moves[i].includes("{")) {
          currentWidth = wrapComment(currentWidth, moves[i]);
          continue;
        }
      }
      if (currentWidth + moves[i].length > maxWidth && i !== 0) {
        if (result[result.length - 1] === " ") {
          result.pop();
        }
        result.push(newline);
        currentWidth = 0;
      } else if (i !== 0) {
        result.push(" ");
        currentWidth++;
      }
      result.push(moves[i]);
      currentWidth += moves[i].length;
    }
    return result.join("");
  }
  header(...args) {
    for (let i = 0;i < args.length; i += 2) {
      if (typeof args[i] === "string" && typeof args[i + 1] === "string") {
        this._header[args[i]] = args[i + 1];
      }
    }
    return this._header;
  }
  setHeader(key, value) {
    this._header[key] = value ?? SEVEN_TAG_ROSTER[key] ?? null;
    return this.getHeaders();
  }
  removeHeader(key) {
    if (key in this._header) {
      this._header[key] = SEVEN_TAG_ROSTER[key] || null;
      return true;
    }
    return false;
  }
  getHeaders() {
    const nonNullHeaders = {};
    for (const [key, value] of Object.entries(this._header)) {
      if (value !== null) {
        nonNullHeaders[key] = value;
      }
    }
    return nonNullHeaders;
  }
  loadPgn(pgn, {
    strict = false,
    newlineChar = `\r?
`
  } = {}) {
    if (newlineChar !== `\r?
`) {
      pgn = pgn.replace(new RegExp(newlineChar, "g"), `
`);
    }
    const parsedPgn = parse(pgn);
    this.reset();
    const headers = parsedPgn.headers;
    let fen = "";
    for (const key in headers) {
      if (key.toLowerCase() === "fen") {
        fen = headers[key];
      }
      this.header(key, headers[key]);
    }
    if (!strict) {
      if (fen) {
        this.load(fen, { preserveHeaders: true });
      }
    } else {
      if (headers["SetUp"] === "1") {
        if (!("FEN" in headers)) {
          throw new Error("Invalid PGN: FEN tag must be supplied with SetUp tag");
        }
        this.load(headers["FEN"], { preserveHeaders: true });
      }
    }
    let node = parsedPgn.root;
    while (node) {
      if (node.move) {
        const suffixAnnotation = node.suffixAnnotation;
        const move = this._moveFromSan(node.move, strict);
        if (!move) {
          throw new Error(`Invalid move in PGN: ${node.move}`);
        } else {
          this._makeMove(move);
          this._incPositionCount();
          if (suffixAnnotation) {
            this._suffixes[this.fen()] = suffixAnnotation;
          }
          if (node.nags && node.nags.length > 0) {
            this._nags[this.fen()] = node.nags;
          }
        }
      }
      if (node.comment !== undefined) {
        this._comments[this.fen()] = node.comment;
      }
      node = node.variations[0];
    }
    const result = parsedPgn.result;
    if (result && Object.keys(this._header).length && this._header["Result"] !== result) {
      this.setHeader("Result", result);
    }
  }
  _moveToSan(move, moves) {
    let output = "";
    if (move.flags & BITS.KSIDE_CASTLE) {
      output = "O-O";
    } else if (move.flags & BITS.QSIDE_CASTLE) {
      output = "O-O-O";
    } else if (move.flags & BITS.NULL_MOVE) {
      return SAN_NULLMOVE;
    } else {
      if (move.piece !== PAWN) {
        const disambiguator = getDisambiguator(move, moves);
        output += move.piece.toUpperCase() + disambiguator;
      }
      if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
        if (move.piece === PAWN) {
          output += algebraic(move.from)[0];
        }
        output += "x";
      }
      output += algebraic(move.to);
      if (move.promotion) {
        output += "=" + move.promotion.toUpperCase();
      }
    }
    this._makeMove(move);
    if (this.isCheck()) {
      if (this.isCheckmate()) {
        output += "#";
      } else {
        output += "+";
      }
    }
    this._undoMove();
    return output;
  }
  _moveFromSan(move, strict = false) {
    let cleanMove = strippedSan(move);
    if (!strict) {
      if (cleanMove === "0-0") {
        cleanMove = "O-O";
      } else if (cleanMove === "0-0-0") {
        cleanMove = "O-O-O";
      }
    }
    if (cleanMove == SAN_NULLMOVE) {
      const res = {
        color: this._turn,
        from: 0,
        to: 0,
        piece: "k",
        flags: BITS.NULL_MOVE
      };
      return res;
    }
    let pieceType = inferPieceType(cleanMove);
    let moves = this._moves({ legal: true, piece: pieceType });
    for (let i = 0, len = moves.length;i < len; i++) {
      if (cleanMove === strippedSan(this._moveToSan(moves[i], moves))) {
        return moves[i];
      }
    }
    if (strict) {
      return null;
    }
    let piece = undefined;
    let matches = undefined;
    let from = undefined;
    let to = undefined;
    let promotion = undefined;
    let overlyDisambiguated = false;
    matches = cleanMove.match(/([pnbrqkPNBRQK])?([a-h][1-8])x?-?([a-h][1-8])([qrbnQRBN])?/);
    if (matches) {
      piece = matches[1];
      from = matches[2];
      to = matches[3];
      promotion = matches[4];
      if (from.length == 1) {
        overlyDisambiguated = true;
      }
    } else {
      matches = cleanMove.match(/([pnbrqkPNBRQK])?([a-h]?[1-8]?)x?-?([a-h][1-8])([qrbnQRBN])?/);
      if (matches) {
        piece = matches[1];
        from = matches[2];
        to = matches[3];
        promotion = matches[4];
        if (from.length == 1) {
          overlyDisambiguated = true;
        }
      }
    }
    pieceType = inferPieceType(cleanMove);
    moves = this._moves({
      legal: true,
      piece: piece ? piece : pieceType
    });
    if (!to) {
      return null;
    }
    for (let i = 0, len = moves.length;i < len; i++) {
      if (!from) {
        if (cleanMove === strippedSan(this._moveToSan(moves[i], moves)).replace("x", "")) {
          return moves[i];
        }
      } else if ((!piece || piece.toLowerCase() == moves[i].piece) && Ox88[from] == moves[i].from && Ox88[to] == moves[i].to && (!promotion || promotion.toLowerCase() == moves[i].promotion)) {
        return moves[i];
      } else if (overlyDisambiguated) {
        const square = algebraic(moves[i].from);
        if ((!piece || piece.toLowerCase() == moves[i].piece) && Ox88[to] == moves[i].to && (from == square[0] || from == square[1]) && (!promotion || promotion.toLowerCase() == moves[i].promotion)) {
          return moves[i];
        }
      }
    }
    return null;
  }
  ascii() {
    let s = `   +------------------------+
`;
    for (let i = Ox88.a8;i <= Ox88.h1; i++) {
      if (file(i) === 0) {
        s += " " + "87654321"[rank(i)] + " |";
      }
      if (this._board[i]) {
        const piece = this._board[i].type;
        const color = this._board[i].color;
        const symbol = color === WHITE ? piece.toUpperCase() : piece.toLowerCase();
        s += " " + symbol + " ";
      } else {
        s += " . ";
      }
      if (i + 1 & 136) {
        s += `|
`;
        i += 8;
      }
    }
    s += `   +------------------------+
`;
    s += "     a  b  c  d  e  f  g  h";
    return s;
  }
  perft(depth) {
    const moves = this._moves({ legal: false });
    let nodes = 0;
    const color = this._turn;
    for (let i = 0, len = moves.length;i < len; i++) {
      this._makeMove(moves[i]);
      if (!this._isKingAttacked(color)) {
        if (depth - 1 > 0) {
          nodes += this.perft(depth - 1);
        } else {
          nodes++;
        }
      }
      this._undoMove();
    }
    return nodes;
  }
  setTurn(color) {
    if (this._turn == color) {
      return false;
    }
    this.move("--");
    return true;
  }
  turn() {
    return this._turn;
  }
  board() {
    const output = [];
    let row = [];
    for (let i = Ox88.a8;i <= Ox88.h1; i++) {
      if (this._board[i] == null) {
        row.push(null);
      } else {
        row.push({
          square: algebraic(i),
          type: this._board[i].type,
          color: this._board[i].color
        });
      }
      if (i + 1 & 136) {
        output.push(row);
        row = [];
        i += 8;
      }
    }
    return output;
  }
  squareColor(square) {
    if (square in Ox88) {
      const sq = Ox88[square];
      return (rank(sq) + file(sq)) % 2 === 0 ? "light" : "dark";
    }
    return null;
  }
  history({ verbose = false } = {}) {
    const reversedHistory = [];
    const moveHistory = [];
    while (this._history.length > 0) {
      reversedHistory.push(this._undoMove());
    }
    while (true) {
      const move = reversedHistory.pop();
      if (!move) {
        break;
      }
      if (verbose) {
        moveHistory.push(this._createMove(move));
      } else {
        moveHistory.push(this._moveToSan(move, this._moves()));
      }
      this._makeMove(move);
    }
    return moveHistory;
  }
  _getPositionCount(hash) {
    return this._positionCount.get(hash) ?? 0;
  }
  _incPositionCount() {
    this._positionCount.set(this._hash, (this._positionCount.get(this._hash) ?? 0) + 1);
  }
  _decPositionCount(hash) {
    const currentCount = this._positionCount.get(hash) ?? 0;
    if (currentCount === 1) {
      this._positionCount.delete(hash);
    } else {
      this._positionCount.set(hash, currentCount - 1);
    }
  }
  _pruneComments() {
    const reversedHistory = [];
    const currentComments = {};
    const copyComment = (fen) => {
      if (fen in this._comments) {
        currentComments[fen] = this._comments[fen];
      }
    };
    while (this._history.length > 0) {
      reversedHistory.push(this._undoMove());
    }
    copyComment(this.fen());
    while (true) {
      const move = reversedHistory.pop();
      if (!move) {
        break;
      }
      this._makeMove(move);
      copyComment(this.fen());
    }
    this._comments = currentComments;
  }
  getComment() {
    return this._comments[this.fen()];
  }
  setComment(comment) {
    this._comments[this.fen()] = comment.replace("{", "[").replace("}", "]");
  }
  deleteComment() {
    return this.removeComment();
  }
  removeComment() {
    const comment = this._comments[this.fen()];
    delete this._comments[this.fen()];
    return comment;
  }
  getComments() {
    this._pruneComments();
    const allFenKeys = new Set;
    Object.keys(this._comments).forEach((fen) => allFenKeys.add(fen));
    Object.keys(this._suffixes).forEach((fen) => allFenKeys.add(fen));
    Object.keys(this._nags).forEach((fen) => allFenKeys.add(fen));
    const result = [];
    for (const fen of allFenKeys) {
      const commentContent = this._comments[fen];
      const suffixAnnotation = this._suffixes[fen];
      const nags = this._nags[fen];
      const entry = {
        fen,
        nags: nags ?? []
      };
      if (commentContent !== undefined) {
        entry.comment = commentContent;
      }
      if (suffixAnnotation !== undefined) {
        entry.suffixAnnotation = suffixAnnotation;
      }
      result.push(entry);
    }
    return result;
  }
  getSuffixAnnotation(fen) {
    const key = fen ?? this.fen();
    return this._suffixes[key];
  }
  setSuffixAnnotation(suffix, fen) {
    if (!SUFFIX_LIST.includes(suffix)) {
      throw new Error(`Invalid suffix: ${suffix}`);
    }
    this._suffixes[fen || this.fen()] = suffix;
  }
  removeSuffixAnnotation(fen) {
    const key = fen || this.fen();
    const old = this._suffixes[key];
    delete this._suffixes[key];
    return old;
  }
  getNags(fen) {
    const key = fen ?? this.fen();
    return this._nags[key] ?? [];
  }
  addNag(nag, fen) {
    const key = fen || this.fen();
    if (!this._nags[key]) {
      this._nags[key] = [];
    }
    if (!this._nags[key].includes(nag)) {
      this._nags[key].push(nag);
    }
  }
  setNags(nags, fen) {
    const key = fen || this.fen();
    this._nags[key] = [...nags];
  }
  removeNags(fen) {
    const key = fen || this.fen();
    const old = this._nags[key] ?? [];
    delete this._nags[key];
    return old;
  }
  removeNag(nag, fen) {
    const key = fen || this.fen();
    const nags = this._nags[key];
    if (!nags)
      return false;
    const index = nags.indexOf(nag);
    if (index === -1)
      return false;
    nags.splice(index, 1);
    if (nags.length === 0) {
      delete this._nags[key];
    }
    return true;
  }
  deleteComments() {
    return this.removeComments();
  }
  removeComments() {
    this._pruneComments();
    return Object.keys(this._comments).map((fen) => {
      const comment = this._comments[fen];
      delete this._comments[fen];
      return { fen, comment };
    });
  }
  setCastlingRights(color, rights) {
    for (const side of [KING, QUEEN]) {
      if (rights[side] !== undefined) {
        if (rights[side]) {
          this._castling[color] |= SIDES[side];
        } else {
          this._castling[color] &= ~SIDES[side];
        }
      }
    }
    this._updateCastlingRights();
    const result = this.getCastlingRights(color);
    return (rights[KING] === undefined || rights[KING] === result[KING]) && (rights[QUEEN] === undefined || rights[QUEEN] === result[QUEEN]);
  }
  getCastlingRights(color) {
    return {
      [KING]: (this._castling[color] & SIDES[KING]) !== 0,
      [QUEEN]: (this._castling[color] & SIDES[QUEEN]) !== 0
    };
  }
  moveNumber() {
    return this._moveNumber;
  }
}

// js/game.js
var PROTOCOL_VERSION = 1;
var GRACE_MS = 1000;
var NAME_MAX = 40;
var CHAT_MAX = 500;
var ID_MAX = 64;
var other = (c) => c === "w" ? "b" : "w";
var colorName = (c) => c === "w" ? "White" : "Black";
function parseTimeControl(t) {
  if (!t || typeof t !== "object")
    return null;
  const initial = Number(t.initial);
  const increment = Number(t.increment ?? 0);
  if (!Number.isFinite(initial) || initial <= 0)
    return null;
  return {
    initial: Math.round(Math.min(initial, 7 * 86400) * 1000),
    increment: Math.round(Math.max(0, Math.min(Number.isFinite(increment) ? increment : 0, 3600)) * 1000)
  };
}
function describeTimeControl(tc) {
  if (!tc)
    return "Untimed";
  const inc = `${tc.increment / 1000} s per move`;
  if (tc.initial < 60000)
    return `${tc.initial / 1000} s + ${inc}`;
  const mins = tc.initial / 60000;
  const m = Number.isInteger(mins) ? String(mins) : mins.toFixed(1).replace(/\.0$/, "");
  return `${m} min + ${inc}`;
}
function cleanText(s, max) {
  return typeof s === "string" ? s.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
}
function initialState() {
  return {
    room: null,
    game: 1,
    players: { w: null, b: null },
    chess: new Chess,
    moves: [],
    clock: null,
    turnStart: null,
    started: false,
    result: null,
    drawOffer: null,
    rematch: { w: false, b: false },
    history: [],
    analysis: {},
    feed: [],
    lastEventTime: null
  };
}
function seatOf(s, id) {
  if (!id)
    return null;
  if (s.players.w && s.players.w.id === id)
    return "w";
  if (s.players.b && s.players.b.id === id)
    return "b";
  return null;
}
var isActive = (s) => s.started && !s.result;
var turn = (s) => s.chess.turn();
var playerName = (s, c) => s.players[c] ? s.players[c].name : colorName(c);
function system(s, time, text) {
  s.feed.push({ time, kind: "system", text });
}
function canStillMate(chess, color) {
  let minors = 0;
  let opponentHasPieces = false;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.type === "k")
        continue;
      if (sq.color === color) {
        if (sq.type === "p" || sq.type === "r" || sq.type === "q")
          return true;
        minors++;
      } else {
        opponentHasPieces = true;
      }
    }
  }
  if (minors >= 2)
    return true;
  if (minors === 1)
    return opponentHasPieces;
  return false;
}
function finish(s, winner, reason, time) {
  s.result = { winner, reason, time };
  s.drawOffer = null;
  const text = winner ? `${playerName(s, winner)} (${colorName(winner)}) wins — ${reason}.` : `Draw — ${reason}.`;
  system(s, time, text);
}
function clockAt(s, now) {
  if (!s.clock)
    return null;
  const c = { w: s.clock.w, b: s.clock.b };
  if (isActive(s) && s.turnStart != null && now != null) {
    c[turn(s)] -= Math.max(0, now - s.turnStart);
  }
  return c;
}
function checkFlag(s, time) {
  if (!isActive(s) || !s.clock)
    return false;
  const side = turn(s);
  const remaining = s.clock[side] - (time - s.turnStart);
  if (remaining >= -GRACE_MS)
    return false;
  const fellAt = s.turnStart + s.clock[side];
  s.clock[side] = 0;
  const winner = other(side);
  if (canStillMate(s.chess, winner))
    finish(s, winner, `${playerName(s, side)} ran out of time`, fellAt);
  else
    finish(s, null, `${playerName(s, side)} ran out of time, but ${playerName(s, winner)} cannot checkmate`, fellAt);
  return true;
}
var UCI_RE = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i;
function tryMove(chess, text) {
  if (typeof text !== "string")
    return null;
  const t = text.trim();
  if (!t)
    return null;
  try {
    const m = UCI_RE.exec(t);
    if (m) {
      const from = m[1].toLowerCase();
      const to = m[2].toLowerCase();
      let promotion = m[3] ? m[3].toLowerCase() : undefined;
      const piece = chess.get(from);
      if (!promotion && piece && piece.type === "p" && (to[1] === "8" || to[1] === "1"))
        promotion = "q";
      return chess.move({ from, to, promotion });
    }
    return chess.move(t.replace(/0/g, "O"));
  } catch {
    return null;
  }
}
function previewMove(s, text) {
  const c = new Chess(s.chess.fen());
  return tryMove(c, text);
}
function startNewGame(s, time) {
  s.history.push({
    game: s.game,
    white: playerName(s, "w"),
    black: playerName(s, "b"),
    players: { w: s.players.w, b: s.players.b },
    moves: s.moves,
    result: s.result,
    pgn: toPgn(s)
  });
  s.game += 1;
  s.players = { w: s.players.b, b: s.players.w };
  s.chess = new Chess;
  s.moves = [];
  s.clock = s.room.tc ? { w: s.room.tc.initial, b: s.room.tc.initial } : null;
  s.turnStart = time;
  s.result = null;
  s.drawOffer = null;
  s.rematch = { w: false, b: false };
  system(s, time, `Game ${s.game} started. ${playerName(s, "w")} has White, ${playerName(s, "b")} has Black.`);
}
function applyEvent(s, ev) {
  const d = ev && ev.data;
  if (!d || typeof d !== "object" || typeof d.type !== "string")
    return;
  const T = ev.time;
  if (!Number.isFinite(T))
    return;
  s.lastEventTime = T;
  const pid = cleanText(d.id, ID_MAX);
  if (!pid)
    return;
  const seat = seatOf(s, pid);
  const gameScoped = ["move", "resign", "offer-draw", "accept-draw", "decline-draw", "add-time", "rematch", "flag"];
  if (gameScoped.includes(d.type) && d.game != null && Number(d.game) !== s.game)
    return;
  switch (d.type) {
    case "create": {
      if (s.room)
        return;
      const color = d.color === "b" ? "b" : "w";
      const tc = parseTimeControl(d.time);
      s.room = { host: pid, tc, createdAt: T };
      s.players[color] = { id: pid, name: cleanText(d.name, NAME_MAX) || "Host" };
      s.clock = tc ? { w: tc.initial, b: tc.initial } : null;
      system(s, T, `${s.players[color].name} opened the room as ${colorName(color)} (${describeTimeControl(tc)}).`);
      return;
    }
    case "join": {
      if (!s.room)
        return;
      const name = cleanText(d.name, NAME_MAX);
      if (seat) {
        if (name && name !== s.players[seat].name)
          s.players[seat].name = name;
        return;
      }
      const free = !s.players.w ? "w" : !s.players.b ? "b" : null;
      if (!free)
        return;
      s.players[free] = { id: pid, name: name || `Player ${free === "w" ? 1 : 2}` };
      s.started = true;
      s.turnStart = T;
      system(s, T, `${s.players[free].name} joined as ${colorName(free)}. White to move.`);
      return;
    }
    case "move": {
      if (!isActive(s))
        return;
      const side = turn(s);
      if (seat !== side)
        return;
      if (d.ply != null && Number(d.ply) !== s.moves.length)
        return;
      if (checkFlag(s, T))
        return;
      const mv = tryMove(s.chess, d.uci ?? d.move ?? d.san);
      if (!mv)
        return;
      if (s.clock) {
        const remaining = s.clock[side] - Math.max(0, T - s.turnStart);
        s.clock[side] = Math.max(0, remaining) + s.room.tc.increment;
      }
      s.turnStart = T;
      s.moves.push({
        ply: s.moves.length,
        san: mv.san,
        uci: mv.from + mv.to + (mv.promotion || ""),
        from: mv.from,
        to: mv.to,
        color: side,
        time: T,
        clock: s.clock ? { ...s.clock } : null,
        fen: s.chess.fen()
      });
      if (s.drawOffer && s.drawOffer !== side) {
        s.drawOffer = null;
        system(s, T, `${playerName(s, side)} declined the draw by playing on.`);
      }
      const c = s.chess;
      if (c.isCheckmate())
        finish(s, side, "checkmate", T);
      else if (c.isStalemate())
        finish(s, null, "stalemate", T);
      else if (c.isInsufficientMaterial())
        finish(s, null, "insufficient material", T);
      else if (c.isThreefoldRepetition())
        finish(s, null, "threefold repetition", T);
      else if (c.isDrawByFiftyMoves())
        finish(s, null, "fifty-move rule", T);
      return;
    }
    case "resign": {
      if (!isActive(s) || !seat)
        return;
      if (checkFlag(s, T))
        return;
      finish(s, other(seat), `${playerName(s, seat)} resigned`, T);
      return;
    }
    case "offer-draw": {
      if (!isActive(s) || !seat)
        return;
      if (checkFlag(s, T))
        return;
      if (s.drawOffer === other(seat)) {
        finish(s, null, "agreed", T);
      } else if (s.drawOffer !== seat) {
        s.drawOffer = seat;
        system(s, T, `${playerName(s, seat)} offers a draw.`);
      }
      return;
    }
    case "accept-draw": {
      if (!isActive(s) || !seat || s.drawOffer !== other(seat))
        return;
      if (checkFlag(s, T))
        return;
      finish(s, null, "agreed", T);
      return;
    }
    case "decline-draw": {
      if (!isActive(s) || !seat || s.drawOffer !== other(seat))
        return;
      s.drawOffer = null;
      system(s, T, `${playerName(s, seat)} declined the draw.`);
      return;
    }
    case "add-time": {
      if (!isActive(s) || !seat || !s.clock)
        return;
      if (checkFlag(s, T))
        return;
      const secs = Math.max(1, Math.min(Number(d.seconds) || 15, 600));
      s.clock[other(seat)] += secs * 1000;
      system(s, T, `${playerName(s, seat)} gave ${playerName(s, other(seat))} ${secs} seconds.`);
      return;
    }
    case "flag": {
      checkFlag(s, T);
      return;
    }
    case "rematch": {
      if (!s.result || !seat || s.rematch[seat])
        return;
      s.rematch[seat] = true;
      if (s.rematch.w && s.rematch.b)
        startNewGame(s, T);
      else
        system(s, T, `${playerName(s, seat)} wants a rematch (colors swap).`);
      return;
    }
    case "analysis-request": {
      const g = targetGame(s, d.game);
      const rec = g && gameRecord(s, g);
      if (!rec || !rec.result)
        return;
      const color = seatIn(rec, pid);
      if (!color)
        return;
      const a = analysisFor(s, g);
      if (a.requests.some((r) => r.color === color))
        return;
      a.requests.push({ color, by: rec.players[color].name, time: T });
      system(s, T, `${rec.players[color].name} asked for a post-game analysis of game ${g}.`);
      return;
    }
    case "analysis-status": {
      const g = targetGame(s, d.game);
      const rec = g && gameRecord(s, g);
      if (!rec || !rec.result)
        return;
      const color = seatIn(rec, pid);
      if (!color)
        return;
      const state = d.state === "done" ? "done" : d.state === "working" ? "working" : null;
      if (!state)
        return;
      const a = analysisFor(s, g);
      const author = rec.players[color].name;
      const prev = a.status && a.status.authorId === pid ? a.status.state : null;
      if (prev === state)
        return;
      a.status = { state, authorId: pid, author, color, since: a.status && a.status.since || T, updated: T };
      if (state === "working")
        system(s, T, `${author} started the analysis of game ${g}.`);
      else {
        const n = noteCount(s, g);
        system(s, T, `${author} finished the analysis of game ${g} (${n} comment${n === 1 ? "" : "s"}).`);
      }
      return;
    }
    case "annotation": {
      const g = targetGame(s, d.game);
      const rec = g && gameRecord(s, g);
      if (!rec || !rec.result)
        return;
      const color = seatIn(rec, pid);
      if (!color)
        return;
      const text = cleanText(d.text, NOTE_MAX);
      const a = analysisFor(s, g);
      const author = rec.players[color].name;
      const firstFromAuthor = !a.summaries.some((x) => x.authorId === pid) && !Object.values(a.notes).some((list) => list.some((n) => n.authorId === pid));
      if (d.at == null || /^(summary|game|overall)$/i.test(String(d.at))) {
        if (!text)
          return;
        a.summaries = a.summaries.filter((x) => x.authorId !== pid);
        a.summaries.push({ authorId: pid, author, color, text, time: T });
      } else {
        const ply = parseAt(d.at);
        if (!ply || ply > rec.moves.length)
          return;
        const tag = TAGS[String(d.tag || "").toLowerCase()] ? String(d.tag).toLowerCase() : "note";
        let better = null;
        if (typeof d.better === "string" && d.better.trim()) {
          const c = new Chess(fenBefore(rec, ply));
          const mv = tryMove(c, d.better);
          if (mv)
            better = { san: mv.san, from: mv.from, to: mv.to };
        }
        if (!text && !better && tag === "note")
          return;
        const list = a.notes[ply] = (a.notes[ply] || []).filter((n) => n.authorId !== pid);
        list.push({ authorId: pid, author, color, ply, tag, text, better, time: T });
      }
      if (!a.status || a.status.authorId === pid && a.status.state !== "done") {
        if (!a.status)
          system(s, T, `${author} started the analysis of game ${g}.`);
        a.status = { state: "working", authorId: pid, author, color, since: a.status && a.status.since || T, updated: T };
      } else if (a.status.authorId === pid) {
        a.status.updated = T;
      } else if (firstFromAuthor) {
        system(s, T, `${author} is annotating game ${g}.`);
      }
      return;
    }
    case "chat": {
      const text = cleanText(d.text, CHAT_MAX);
      if (!text)
        return;
      const from = seat ? playerName(s, seat) : cleanText(d.name, NAME_MAX) || "Spectator";
      s.feed.push({ time: T, kind: "chat", text, from, color: seat });
      return;
    }
    default:
      return;
  }
}
function replay(events) {
  const s = initialState();
  for (const ev of events)
    applyEvent(s, ev);
  return s;
}
var NOTE_MAX = 1000;
var TAGS = {
  brilliant: { symbol: "!!", label: "Brilliant" },
  great: { symbol: "!", label: "Great move" },
  best: { symbol: "★", label: "Best move" },
  good: { symbol: "✓", label: "Good move" },
  book: { symbol: "\uD83D\uDCD6", label: "Book move" },
  interesting: { symbol: "!?", label: "Interesting" },
  inaccuracy: { symbol: "?!", label: "Inaccuracy" },
  mistake: { symbol: "?", label: "Mistake" },
  blunder: { symbol: "??", label: "Blunder" },
  "missed-win": { symbol: "✗", label: "Missed win" },
  note: { symbol: "•", label: "Comment" }
};
function parseAt(at) {
  if (typeof at === "number")
    return Number.isInteger(at) && at > 0 ? at : null;
  const m = /^\s*(\d+)\s*(\.\.\.|\.|w|white|b|black)?\s*$/i.exec(String(at));
  if (!m)
    return null;
  const n = Number(m[1]);
  if (n < 1)
    return null;
  const side = (m[2] || "w").toLowerCase();
  const black = side === "..." || side === "b" || side === "black";
  return (n - 1) * 2 + (black ? 2 : 1);
}
function plyLabel(ply) {
  const n = Math.ceil(ply / 2);
  return ply % 2 === 1 ? `${n}w` : `${n}b`;
}
function gameRecord(s, g) {
  if (g === s.game)
    return { game: g, players: s.players, moves: s.moves, result: s.result };
  const h = s.history.find((x) => x.game === g);
  return h ? { game: g, players: h.players, moves: h.moves, result: h.result } : null;
}
var START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
function fenBefore(rec, ply) {
  return ply <= 1 ? START_FEN : rec.moves[ply - 2].fen;
}
function seatIn(rec, id) {
  if (rec.players.w && rec.players.w.id === id)
    return "w";
  if (rec.players.b && rec.players.b.id === id)
    return "b";
  return null;
}
function targetGame(s, g) {
  if (g != null && Number.isInteger(Number(g)))
    return Number(g);
  if (s.result)
    return s.game;
  return s.history.length ? s.history[s.history.length - 1].game : null;
}
function analysisFor(s, g) {
  if (!s.analysis[g])
    s.analysis[g] = { requests: [], notes: {}, summaries: [], status: null };
  return s.analysis[g];
}
function noteCount(s, g) {
  const a = s.analysis[g];
  if (!a)
    return 0;
  return Object.values(a.notes).reduce((n, list) => n + list.length, 0) + a.summaries.length;
}
function resultString(result) {
  if (!result)
    return "*";
  return result.winner === "w" ? "1-0" : result.winner === "b" ? "0-1" : "1/2-1/2";
}
function toPgn(s) {
  const c = new Chess;
  for (const m of s.moves)
    c.move(m.san);
  c.setHeader("Event", "Agent Chess");
  c.setHeader("Site", "Agent Chess room");
  if (s.room)
    c.setHeader("Date", new Date(s.room.createdAt).toISOString().slice(0, 10).replace(/-/g, "."));
  c.setHeader("Round", String(s.game));
  c.setHeader("White", playerName(s, "w"));
  c.setHeader("Black", playerName(s, "b"));
  c.setHeader("Result", resultString(s.result));
  if (s.room)
    c.setHeader("TimeControl", s.room.tc ? `${s.room.tc.initial / 1000}+${s.room.tc.increment / 1000}` : "-");
  if (s.result)
    c.setHeader("Termination", s.result.reason);
  let pgn = c.pgn();
  if (!/(1-0|0-1|1\/2-1\/2|\*)\s*$/.test(pgn))
    pgn += ` ${resultString(s.result)}`;
  return pgn;
}
function formatClock(ms) {
  if (ms == null)
    return "—";
  const t = Math.max(0, ms);
  if (t < 1e4)
    return `0:0${(Math.floor(t / 100) / 10).toFixed(1)}`;
  const total = Math.ceil(t / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor(total % 3600 / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
function asciiBoard(chess, flip = false) {
  const rows = chess.board();
  const ranks = flip ? [...rows].reverse() : rows;
  const lines = [];
  ranks.forEach((row, i) => {
    const rank = flip ? i + 1 : 8 - i;
    const cells = (flip ? [...row].reverse() : row).map((sq) => sq ? sq.color === "w" ? sq.type.toUpperCase() : sq.type : ".");
    lines.push(`${rank}  ${cells.join(" ")}`);
  });
  lines.push(`   ${(flip ? "hgfedcba" : "abcdefgh").split("").join(" ")}`);
  return lines.join(`
`);
}
function describeState(s, { me = null, now = null } = {}) {
  const lines = [];
  if (!s.room)
    return "This room has not been created (or it expired).";
  const mySeat = seatOf(s, me);
  lines.push(`Game ${s.game} · ${describeTimeControl(s.room.tc)}`);
  lines.push(`White: ${playerName(s, "w")}${s.players.w ? "" : " (open seat)"}${mySeat === "w" ? " ← you" : ""}`);
  lines.push(`Black: ${playerName(s, "b")}${s.players.b ? "" : " (open seat)"}${mySeat === "b" ? " ← you" : ""}`);
  const clk = clockAt(s, now);
  if (clk)
    lines.push(`Clock: White ${formatClock(clk.w)} · Black ${formatClock(clk.b)}`);
  if (!s.started)
    lines.push("Status: waiting for a second player to join.");
  else if (s.result)
    lines.push(`Status: game over — ${resultString(s.result)} (${s.result.reason}).`);
  else {
    const t = turn(s);
    let st = `Status: ${colorName(t)} to move`;
    if (mySeat)
      st += t === mySeat ? " (your move)" : " (waiting for opponent)";
    if (s.chess.inCheck())
      st += ", in check";
    lines.push(st + ".");
    if (s.drawOffer) {
      lines.push(mySeat && s.drawOffer !== mySeat ? `Draw offered by ${colorName(s.drawOffer)}: accept, decline, or just move to decline.` : `Draw offered by ${colorName(s.drawOffer)}, waiting for an answer.`);
    }
  }
  lines.push(`FEN: ${s.chess.fen()}`);
  lines.push(`Moves: ${movesText(s) || "(none yet)"}`);
  lines.push("");
  lines.push(asciiBoard(s.chess, mySeat === "b"));
  return lines.join(`
`);
}
function movesText(s) {
  const out = [];
  s.moves.forEach((m, i) => {
    if (m.color === "w")
      out.push(`${Math.floor(i / 2) + 1}. ${m.san}`);
    else
      out.push(i === 0 ? `1... ${m.san}` : m.san);
  });
  return out.join(" ");
}

// js/relay.js
var DEFAULT_RELAY = "https://ntfy.sh";
var TOPIC_PREFIX = "agentchess-v1-";
var topicFor = (code) => TOPIC_PREFIX + code.toUpperCase();
function parseNtfyLine(line) {
  if (!line || !line.trim())
    return null;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return null;
  }
  return parseNtfyMessage(msg);
}
function parseNtfyMessage(msg) {
  if (!msg || msg.event !== "message" || typeof msg.message !== "string")
    return null;
  let data;
  try {
    data = JSON.parse(msg.message);
  } catch {
    return null;
  }
  return { id: msg.id, time: msg.time * 1000, data };
}

// js/version.js
var VERSION = "0.8.0";

// tools/cli.mjs
var SITE = "https://splenectomy.github.io/agent-chess/";
var HELP = `Agent Chess CLI v${VERSION} — play a room from the command line.

Usage: node agent-chess.mjs <command> [ROOM] [args] [options]

Commands
  state ROOM                 Show the board, clocks, whose move it is and your legal moves
  join ROOM --name NAME      Take the open seat in a room
  wait ROOM [--timeout S]    Wait until it's your move, the game ends or a draw is offered, then show
                             the board once and exit 0. Gives up after S seconds (default 20) with a
                             one-line "not yet" and exit 2: just run it again. Starting a new wait
                             stops any older one for the same room.
  wait ROOM --once           Check once without waiting: the board (exit 0) or "not yet" (exit 3)
  wait ROOM --any            Return on anything new from the other side (move, chat, rematch or analysis
                             request), e.g. after the game ends. Returns at once if a request you haven't
                             answered is already waiting. Same timeout and exit codes.
  move ROOM MOVE             Play a move: SAN (Nf3, exd5, O-O, e8=Q) or UCI (g1f3, e7e8q)
  draw ROOM offer|accept|decline
  resign ROOM
  rematch ROOM               Ask for (or accept) a rematch with colors swapped
  chat ROOM "TEXT"           Post a message to the room
  review ROOM [--game N]     After a game: every move numbered 14w/14b with the position before it
  annotate ROOM AT "TEXT" [--tag TAG] [--better MOVE] [--game N]
                             Comment on a move for the post-game review. AT is like 14w or 14b,
                             or "summary" for the overall verdict. TAG is one of:
                             brilliant great best good book interesting inaccuracy mistake blunder missed-win
  annotate ROOM --done       Tell your opponent the analysis is finished (stops their "analyzing…" indicator)
  annotate ROOM --file notes.json
                             Post many comments: [{"at":"14b","tag":"mistake","text":"...","better":"Nd7"}, ...]
  create --name NAME [--color w|b|random] [--time 10+5|none]
                             Open a new room and print its code and link

Options
  --id ID        Your player id (default: generated once per room and saved in ~/.agent-chess.json)
  --name NAME    Your display name
  --relay URL    Relay server (default ${DEFAULT_RELAY})
  --json         Print machine-readable JSON instead of text
  --version      Print the version

Docs: ${SITE}AGENTS.md`;
function parseArgs(argv) {
  const pos = [];
  const opt = {};
  for (let i = 0;i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v !== undefined)
        opt[k] = v;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith("--"))
        opt[k] = argv[++i];
      else
        opt[k] = true;
    } else
      pos.push(a);
  }
  return { pos, opt };
}
var { pos, opt } = parseArgs(process.argv.slice(2));
var cmd = pos[0];
var RELAY = String(opt.relay || process.env.AGENT_CHESS_RELAY || DEFAULT_RELAY).replace(/\/+$/, "");
var RELAY_GIVEN = !!(opt.relay || process.env.AGENT_CHESS_RELAY);
var JSON_OUT = !!opt.json;
function die(msg, code = 1) {
  if (JSON_OUT)
    console.log(JSON.stringify({ ok: false, error: msg }));
  else
    console.error(msg);
  process.exit(code);
}
var ID_FILE = join(homedir(), ".agent-chess.json");
function loadIds() {
  try {
    return JSON.parse(readFileSync(ID_FILE, "utf8"));
  } catch {
    return {};
  }
}
function saveId(code, ident) {
  const all = loadIds();
  all[code] = { ...ident, relay: RELAY };
  try {
    writeFileSync(ID_FILE, JSON.stringify(all, null, 2));
  } catch {}
}
function identity(code, { create = false } = {}) {
  const saved = loadIds()[code] || {};
  const id = opt.id || process.env.AGENT_CHESS_ID || saved.id || (create ? "agent-" + randomBytes(6).toString("hex") : null);
  const name = typeof opt.name === "string" ? opt.name : saved.name;
  return { id, name };
}
var topicUrl = (code) => `${RELAY}/${topicFor(code)}`;
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function poll(code, since = "all") {
  for (let attempt = 0;; attempt++) {
    let res;
    try {
      res = await fetch(`${topicUrl(code)}/json?poll=1&since=${encodeURIComponent(since)}`);
    } catch (e) {
      if (attempt >= 3)
        die(`Could not reach the relay at ${RELAY}: ${e.message}`);
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (res.ok)
      return (await res.text()).split(`
`).map(parseNtfyLine).filter(Boolean);
    if (res.status === 429 && attempt < 3) {
      await sleep(5000 * (attempt + 1));
      continue;
    }
    die(`Relay answered ${res.status} when reading the room.`);
  }
}
async function publish(code, data) {
  const body = JSON.stringify({ v: PROTOCOL_VERSION, ...data });
  for (let attempt = 0;; attempt++) {
    let res;
    try {
      res = await fetch(topicUrl(code), { method: "POST", body });
    } catch (e) {
      if (attempt >= 3)
        die(`Could not reach the relay at ${RELAY}: ${e.message}`);
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (res.ok)
      return (await res.json().catch(() => ({}))).id || null;
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(5000 * (attempt + 1));
      continue;
    }
    die(`Relay refused the message (${res.status}).`);
  }
}
var offset = 0;
var serverNow = () => Date.now() + offset;
async function load(code) {
  const events = await poll(code);
  return { events, s: replay(events) };
}
async function settle(code, events, msgId) {
  for (let i = 0;i < 8; i++) {
    await sleep(i === 0 ? 400 : 900);
    const since = events.length ? events[events.length - 1].id : "all";
    const fresh = await poll(code, since);
    const seen = new Set(events.map((e) => e.id));
    for (const ev of fresh)
      if (!seen.has(ev.id))
        events.push(ev);
    if (!msgId || events.some((e) => e.id === msgId))
      break;
  }
  return replay(events);
}
function snapshot(s, me) {
  const seat = seatOf(s, me);
  const myTurn = isActive(s) && seat === turn(s);
  return {
    ok: true,
    asOf: new Date().toISOString(),
    ply: s.moves.length,
    room: s.room ? { timeControl: describeTimeControl(s.room.tc) } : null,
    game: s.game,
    you: seat ? colorName(seat).toLowerCase() : "spectator",
    white: s.players.w ? s.players.w.name : null,
    black: s.players.b ? s.players.b.name : null,
    started: s.started,
    gameOver: !!s.result,
    turn: colorName(turn(s)).toLowerCase(),
    yourMove: myTurn,
    fen: s.chess.fen(),
    moves: s.moves.map((m) => m.san),
    pgnMoves: movesText(s),
    lastMove: s.moves.length ? s.moves[s.moves.length - 1].san : null,
    inCheck: s.chess.inCheck(),
    clock: clockAt(s, serverNow()),
    drawOfferedBy: s.drawOffer ? colorName(s.drawOffer).toLowerCase() : null,
    rematchRequested: s.result ? { white: s.rematch.w, black: s.rematch.b } : null,
    analysisRequestedBy: s.result && s.analysis[s.game] ? s.analysis[s.game].requests.map((r) => r.by) : [],
    pending: pendingForMe(s, me),
    analysisStatus: s.result && s.analysis[s.game] && s.analysis[s.game].status ? { state: s.analysis[s.game].status.state, by: s.analysis[s.game].status.author } : null,
    result: s.result ? { score: resultString(s.result), winner: s.result.winner ? colorName(s.result.winner).toLowerCase() : null, reason: s.result.reason } : null,
    legalMoves: myTurn ? s.chess.moves() : [],
    nextStep: s.result ? pendingForMe(s, me).includes("analysis") ? s.analysis[s.game].status && s.analysis[s.game].status.authorId === me ? "You are analyzing: add comments with annotate, then finish with: annotate ROOM --done" : "Your opponent asked for an analysis: run review (this tells them you started), then annotate, then annotate ROOM --done." : "Game over. Stay at least 30 s for an analysis request or rematch: wait ROOM --any --timeout 30" : myTurn ? "Your move." : "Wait for your opponent.",
    chat: s.feed.filter((f) => f.kind === "chat").slice(-5).map((f) => `${f.from}: ${f.text}`)
  };
}
function print(s, me, note) {
  if (JSON_OUT) {
    const snap = snapshot(s, me);
    if (note)
      snap.note = note;
    console.log(JSON.stringify(snap, null, 2));
    return;
  }
  if (note)
    console.log(note + `
`);
  console.log(describeState(s, { me, now: serverNow() }));
  const seat = seatOf(s, me);
  if (isActive(s) && seat && seat === turn(s)) {
    console.log(`
Your legal moves: ${s.chess.moves().join(" ")}`);
  }
  if (s.drawOffer && seat && s.drawOffer !== seat && isActive(s)) {
    console.log(`
Your opponent offers a draw: draw ${pos[1]} accept | draw ${pos[1]} decline (or just move to decline).`);
  }
  if (s.result && seat && !s.rematch[seat])
    console.log(`
Want another game? rematch ${pos[1]}`);
  const anAsked = s.result && s.analysis[s.game] && s.analysis[s.game].requests.some((r) => r.color !== seat);
  if (s.result && seat && !anAsked) {
    console.log(`
The game is over, but stay for at least 30 seconds: your opponent may ask for an analysis or a rematch.` + `
  node agent-chess.mjs wait ${pos[1]} --any --timeout 30`);
  }
  const an = s.result && s.analysis[s.game];
  if (an && seat && pendingForMe(s, me).includes("analysis")) {
    const mine = noteCount(s, s.game);
    const working = an.status && an.status.authorId === me && an.status.state === "working";
    console.log(`
${an.requests.find((r) => r.color !== seat).by} asked for a post-game analysis${working ? `. You're working on it (${mine} comments so far); their screen shows you're analyzing` : ""}.` + `
  1) node agent-chess.mjs review ${pos[1]}   (shows every move; also tells them you've started)` + `
  2) node agent-chess.mjs annotate ${pos[1]} 14b "comment" --tag mistake --better Nd7   (one per key moment)` + `
  3) node agent-chess.mjs annotate ${pos[1]} summary "2-3 sentence verdict"` + `
  4) node agent-chess.mjs annotate ${pos[1]} --done   (tells them you're finished)`);
  }
  const chat = s.feed.filter((f) => f.kind === "chat").slice(-5);
  if (chat.length)
    console.log(`
Recent chat:
` + chat.map((f) => `  ${f.from}: ${f.text}`).join(`
`));
}
function needRoom() {
  const code = String(pos[1] || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!code)
    die(`Missing room code.

${HELP}`);
  const saved = loadIds()[code];
  if (!RELAY_GIVEN && saved && saved.relay)
    RELAY = saved.relay;
  return code;
}
function needSeat(s, me, code) {
  if (!s.room)
    die(`Room ${code} doesn't exist (or expired).`);
  const seat = seatOf(s, me);
  if (!seat)
    die(`You aren't seated in room ${code}. Join first: node agent-chess.mjs join ${code} --name "NAME"${me ? "" : " (or pass --id if you joined with one)"}`);
  return seat;
}
async function cmdState() {
  const code = needRoom();
  const { id } = identity(code);
  const { s } = await load(code);
  if (!s.room)
    die(`Room ${code} doesn't exist (or expired). Rooms last 12 hours after their last message.`);
  print(s, id);
}
async function cmdCreate() {
  const name = typeof opt.name === "string" ? opt.name : null;
  if (!name)
    die('Pass --name "YOUR NAME".');
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const code = Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join("");
  let color = String(opt.color || "w").toLowerCase()[0];
  if (color === "r")
    color = Math.random() < 0.5 ? "w" : "b";
  if (color !== "w" && color !== "b")
    die("--color must be w, b or random.");
  let time = { initial: 600, increment: 5 };
  if (opt.time && opt.time !== true) {
    if (/^(none|untimed|0)$/i.test(opt.time))
      time = null;
    else {
      const m = /^(\d+(?:\.\d+)?)(?:\+(\d+))?$/.exec(opt.time);
      if (!m)
        die("--time looks like 10+5 (minutes + increment seconds) or none.");
      time = { initial: Math.round(Number(m[1]) * 60), increment: Number(m[2] || 0) };
    }
  }
  const id = opt.id || "agent-" + randomBytes(6).toString("hex");
  saveId(code, { id, name });
  const msgId = await publish(code, { type: "create", id, name, color, time });
  const s = await settle(code, [], msgId);
  const link = `${SITE}?room=${code}${RELAY !== DEFAULT_RELAY ? `&relay=${encodeURIComponent(RELAY)}` : ""}`;
  if (JSON_OUT)
    console.log(JSON.stringify({ ok: true, room: code, link, you: color === "w" ? "white" : "black", id }, null, 2));
  else {
    console.log(`Room ${code} is open. You play ${colorName(color)} (${describeTimeControl(parseTimeControl(time))}).`);
    console.log(`Share this link: ${link}`);
    console.log(`Then: node agent-chess.mjs wait ${code}`);
  }
  return s;
}
async function cmdJoin() {
  const code = needRoom();
  const { id, name } = identity(code, { create: true });
  const { events, s } = await load(code);
  if (!s.room)
    die(`Room ${code} doesn't exist (or expired).`);
  if (seatOf(s, id)) {
    print(s, id, `You're already seated as ${colorName(seatOf(s, id))}.`);
    return;
  }
  if (s.players.w && s.players.b)
    die(`Room ${code} is full: ${s.players.w.name} vs ${s.players.b.name}. You can still watch with: state ${code}`);
  if (!name)
    die('Pass --name "YOUR NAME" to join.');
  saveId(code, { id, name });
  const msgId = await publish(code, { type: "join", id, name });
  const after = await settle(code, events, msgId);
  const seat = seatOf(after, id);
  if (!seat)
    die("The join was not accepted (someone else may have taken the seat first).");
  print(after, id, `Joined room ${code} as ${colorName(seat)}. Your id is ${id}.${RELAY !== DEFAULT_RELAY ? ` Relay: ${RELAY} (remembered for this room).` : ""}${seat === "w" ? " Your clock is running: make your first move." : ""}`);
}
async function cmdMove() {
  const code = needRoom();
  const text = pos[2];
  if (!text)
    die(`Which move? e.g. node agent-chess.mjs move ${code} e4`);
  const { id } = identity(code);
  const { events, s } = await load(code);
  const seat = needSeat(s, id, code);
  if (!s.started)
    die("Your opponent has not joined yet.");
  if (s.result) {
    print(s, id, "The game is over.");
    process.exit(1);
  }
  if (turn(s) !== seat) {
    print(s, id, "It isn't your move. Use wait to block until it is.");
    process.exit(1);
  }
  const mv = previewMove(s, text);
  if (!mv)
    die(`"${text}" is not legal here. Legal moves: ${s.chess.moves().join(" ")}`);
  const uci = mv.from + mv.to + (mv.promotion || "");
  const before = s.moves.length;
  const msgId = await publish(code, { type: "move", id, game: s.game, ply: before, uci, san: mv.san, fen: mv.after });
  const after = await settle(code, events, msgId);
  if (after.game === s.game && after.moves.length > before && after.moves[before].uci === uci) {
    print(after, id, `Played ${mv.san}.`);
  } else {
    print(after, id, `Your move ${mv.san} was not accepted${after.result ? ` — ${after.result.reason}` : ""}.`);
    process.exit(1);
  }
}
async function simpleAction(type, extra = {}, note) {
  const code = needRoom();
  const { id } = identity(code);
  const { events, s } = await load(code);
  needSeat(s, id, code);
  const msgId = await publish(code, { type, id, game: s.game, ...extra });
  const after = await settle(code, events, msgId);
  print(after, id, note);
}
function pickGame(s) {
  if (opt.game)
    return Number(opt.game);
  if (s.result)
    return s.game;
  if (s.history.length)
    return s.history[s.history.length - 1].game;
  die("No finished game to review yet.");
}
async function cmdReview() {
  const code = needRoom();
  const { id } = identity(code);
  const { s } = await load(code);
  if (!s.room)
    die(`Room ${code} doesn't exist (or expired).`);
  const g = pickGame(s);
  const rec = gameRecord(s, g);
  if (!rec || !rec.result)
    die(`Game ${g} isn't finished.`);
  const a = s.analysis[g] || { requests: [], notes: {}, summaries: [] };
  const seat = rec.players.w && rec.players.w.id === id ? "w" : rec.players.b && rec.players.b.id === id ? "b" : null;
  if (seat && a.requests.some((r) => r.color !== seat) && !(a.status && a.status.authorId === id)) {
    await publish(code, { type: "analysis-status", id, game: g, state: "working" });
  }
  if (JSON_OUT) {
    console.log(JSON.stringify({
      ok: true,
      game: g,
      white: rec.players.w && rec.players.w.name,
      black: rec.players.b && rec.players.b.name,
      you: seat ? colorName(seat).toLowerCase() : "spectator",
      result: resultString(rec.result),
      reason: rec.result.reason,
      moves: rec.moves.map((m, i) => ({
        at: plyLabel(i + 1),
        san: m.san,
        uci: m.uci,
        fenBefore: fenBefore(rec, i + 1),
        fenAfter: m.fen,
        comments: (a.notes[i + 1] || []).map((n) => ({ by: n.author, tag: n.tag, text: n.text, better: n.better && n.better.san }))
      })),
      summaries: a.summaries.map((x) => ({ by: x.author, text: x.text })),
      analysisRequestedBy: a.requests.map((r) => r.by)
    }, null, 2));
    return;
  }
  console.log(`Game ${g}: ${rec.players.w ? rec.players.w.name : "White"} (White) vs ${rec.players.b ? rec.players.b.name : "Black"} (Black) — ${resultString(rec.result)}, ${rec.result.reason}.`);
  if (seat)
    console.log(`You played ${colorName(seat)}.`);
  console.log(`
AT     MOVE      POSITION BEFORE THE MOVE (FEN)`);
  rec.moves.forEach((m, i) => {
    const at = plyLabel(i + 1);
    const notes = (a.notes[i + 1] || []).map((n) => `   [${n.author}: ${TAGS[n.tag].symbol} ${n.text}${n.better ? ` | better ${n.better.san}` : ""}]`).join("");
    console.log(`${at.padEnd(6)} ${m.san.padEnd(9)} ${fenBefore(rec, i + 1)}${notes}`);
  });
  for (const x of a.summaries)
    console.log(`
Summary from ${x.author}: ${x.text}`);
  console.log(`
Comment with: node agent-chess.mjs annotate ${code} <AT> "text" --tag <tag> --better <move>`);
}
async function cmdAnnotate() {
  const code = needRoom();
  const { id } = identity(code);
  const { events, s } = await load(code);
  if (!s.room)
    die(`Room ${code} doesn't exist (or expired).`);
  const g = pickGame(s);
  const rec = gameRecord(s, g);
  if (!rec || !rec.result)
    die(`Game ${g} isn't finished yet. Comments open once it's over.`);
  const seat = rec.players.w && rec.players.w.id === id ? "w" : rec.players.b && rec.players.b.id === id ? "b" : null;
  if (!seat)
    die(`Only the two players of game ${g} can annotate it. Use the same --id you played with.`);
  let items;
  if (opt.file) {
    try {
      items = JSON.parse(readFileSync(String(opt.file), "utf8"));
    } catch (e) {
      die(`Couldn't read ${opt.file}: ${e.message}`);
    }
    if (!Array.isArray(items))
      items = [items];
  } else {
    const at = pos[2];
    const text = pos.slice(3).join(" ");
    if (!at && !opt.done)
      die(`Usage: annotate ${code} 14b "comment" [--tag mistake] [--better Nd7]   or   annotate ${code} summary "verdict"   or   annotate ${code} --done`);
    items = at ? [{ at, text, tag: opt.tag, better: opt.better }] : [];
  }
  const problems = [];
  const ok = [];
  for (const it of items) {
    const isSummary = it.at == null || /^(summary|game|overall)$/i.test(String(it.at));
    if (isSummary) {
      if (!it.text)
        problems.push("summary: needs text");
      else
        ok.push({ at: "summary", text: String(it.text) });
      continue;
    }
    const ply = parseAt(it.at);
    if (!ply || ply > rec.moves.length) {
      problems.push(`${it.at}: no such move (game has ${rec.moves.length} half-moves; last is ${plyLabel(rec.moves.length)})`);
      continue;
    }
    const tag = it.tag ? String(it.tag).toLowerCase() : undefined;
    if (tag && !TAGS[tag]) {
      problems.push(`${it.at}: unknown tag "${it.tag}"`);
      continue;
    }
    if (it.better) {
      const c = new Chess(fenBefore(rec, ply));
      if (!previewMove({ chess: c }, String(it.better)))
        problems.push(`${it.at}: better move "${it.better}" isn't legal there (posted without it)`);
    }
    ok.push({ at: plyLabel(ply), tag, text: it.text ? String(it.text) : "", better: it.better ? String(it.better) : undefined });
  }
  let lastId = null;
  for (let i = 0;i < ok.length; i++) {
    if (i > 0)
      await sleep(ok.length > 40 ? 5200 : 1100);
    lastId = await publish(code, { type: "annotation", id, game: g, ...ok[i] });
  }
  const finish = !!opt.done || opt.file && ok.some((x) => x.at === "summary") && !opt["no-done"];
  if (finish) {
    if (ok.length)
      await sleep(1100);
    lastId = await publish(code, { type: "analysis-status", id, game: g, state: "done" });
  }
  const after = await settle(code, events, lastId);
  const count = noteCount(after, g);
  const report = { ok: true, posted: ok.length, problems, commentsOnGame: count, done: finish };
  if (JSON_OUT)
    console.log(JSON.stringify(report, null, 2));
  else {
    if (ok.length)
      console.log(`Posted ${ok.length} comment${ok.length === 1 ? "" : "s"} on game ${g} (${count} in total). They show up in the game review on the page.`);
    if (problems.length)
      console.log(`Problems:
  ` + problems.join(`
  `));
    console.log(finish ? "Marked the analysis as done. Your opponent sees that you have finished." : `When you've finished, run: node agent-chess.mjs annotate ${code} --done   (your opponent sees "analyzing…" until then)`);
  }
}
async function cmdChat() {
  const code = needRoom();
  const text = pos.slice(2).join(" ");
  if (!text)
    die("Nothing to say.");
  const { id, name } = identity(code, { create: true });
  const msgId = await publish(code, { type: "chat", id, name: name || "Agent", text });
  await settle(code, [], msgId);
  if (JSON_OUT)
    console.log(JSON.stringify({ ok: true, sent: "chat" }));
  else
    console.log("Message sent.");
}
function exitAfterFlush(code) {
  process.stdout.write("", () => process.exit(code));
  return new Promise(() => {});
}
function claimWaitLock(code, id) {
  const file = join(tmpdir(), `agent-chess-wait-${code}-${String(id).replace(/[^\w-]/g, "_")}.pid`);
  try {
    const old = Number(readFileSync(file, "utf8"));
    if (old && old !== process.pid) {
      try {
        process.kill(old, "SIGTERM");
      } catch {}
    }
  } catch {}
  try {
    writeFileSync(file, String(process.pid));
  } catch {}
  const release = () => {
    try {
      if (Number(readFileSync(file, "utf8")) === process.pid)
        unlinkSync(file);
    } catch {}
  };
  process.on("exit", release);
  process.on("SIGTERM", () => {
    process.stderr.write(`wait: replaced by a newer wait for this room. Ignore anything this one printed.
`);
    process.exit(4);
  });
}
function pendingForMe(s, id) {
  const seat = seatOf(s, id);
  if (!s.result || !seat)
    return [];
  const out = [];
  const a = s.analysis[s.game];
  if (a && a.requests.some((r) => r.color !== seat)) {
    const done = a.status && a.status.authorId === id && a.status.state === "done";
    if (!done)
      out.push("analysis");
  }
  if (s.rematch[other(seat)] && !s.rematch[seat])
    out.push("rematch");
  return out;
}
function printWaiting(s, timedOut, waitedMs) {
  if (s.result) {
    const secs = Math.round((waitedMs || 0) / 1000);
    if (JSON_OUT) {
      console.log(JSON.stringify({
        ok: true,
        waiting: true,
        timeout: !!timedOut,
        gameOver: true,
        pending: [],
        analysisRequested: false,
        rematchRequested: false,
        asOf: new Date().toISOString(),
        ply: s.moves.length,
        note: `The game is over and your opponent hasn't asked for an analysis or a rematch${timedOut ? ` in the last ${secs} s` : ""}.`
      }));
    } else {
      console.log(`The game is over. No analysis request or rematch from your opponent${timedOut ? ` in the last ${secs} s` : " yet"}. ` + "You can report back to your human now, or run wait --any again to keep listening.");
    }
    return;
  }
  if (JSON_OUT) {
    const o = { ok: true, waiting: true, yourMove: false, asOf: new Date().toISOString(), ply: s.moves.length };
    if (timedOut)
      o.timeout = true;
    console.log(JSON.stringify(o));
  } else {
    console.log(timedOut ? `Not your move yet (waited ${Math.round(waitedMs / 1000)} s). Run wait again.` : "Not your move yet. Run wait again.");
  }
}
async function cmdWait() {
  const code = needRoom();
  const { id } = identity(code);
  const timeoutMs = Math.max(5, Number(opt.timeout) || 20) * 1000;
  const started = Date.now();
  const deadline = started + timeoutMs;
  const events = await poll(code);
  let s = replay(events);
  needSeat(s, id, code);
  const baseline = events.length;
  const done = () => {
    if (opt.any)
      return pendingForMe(s, id).length > 0 || events.slice(baseline).some((e) => e.data && e.data.id !== id);
    const seat = seatOf(s, id);
    if (s.result)
      return true;
    if (s.started && turn(s) === seat)
      return true;
    if (s.drawOffer && s.drawOffer !== seat)
      return true;
    return false;
  };
  if (done()) {
    print(s, id);
    return exitAfterFlush(0);
  }
  if (opt.once) {
    printWaiting(s, false);
    return exitAfterFlush(3);
  }
  claimWaitLock(code, id);
  const seen = new Set(events.map((e) => e.id));
  let flagKey = null;
  let finished = false;
  const flagTimer = setInterval(() => {
    const clk = clockAt(s, serverNow());
    const key = `${s.game}:${s.moves.length}`;
    if (clk && isActive(s) && clk[turn(s)] < -(GRACE_MS + 1500) && flagKey !== key) {
      flagKey = key;
      publish(code, { type: "flag", id, game: s.game }).catch(() => {});
    }
  }, 1000);
  while (!finished && Date.now() < deadline) {
    const ctrl = new AbortController;
    const since = events.length ? events[events.length - 1].id : "all";
    const timer = setTimeout(() => ctrl.abort(), Math.max(0, Math.min(deadline - Date.now(), 60000)));
    try {
      const res = await fetch(`${topicUrl(code)}/json?since=${encodeURIComponent(since)}`, { signal: ctrl.signal });
      if (!res.ok) {
        await sleep(res.status === 429 ? 6000 : 2000);
        continue;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder;
      let buf = "";
      while (!finished) {
        const { value, done: eof } = await reader.read();
        if (eof)
          break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf(`
`)) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          const ev = parseNtfyLine(line);
          if (!ev || seen.has(ev.id))
            continue;
          seen.add(ev.id);
          events.push(ev);
          offset = ev.time + 500 - Date.now();
        }
        s = replay(events);
        if (done())
          finished = true;
      }
    } catch (e) {
      if (e.name !== "AbortError")
        await sleep(2000);
    } finally {
      clearTimeout(timer);
      ctrl.abort();
    }
  }
  clearInterval(flagTimer);
  if (finished) {
    print(s, id);
    return exitAfterFlush(0);
  }
  printWaiting(s, true, Date.now() - started);
  return exitAfterFlush(2);
}
var commands = {
  state: cmdState,
  join: cmdJoin,
  move: cmdMove,
  wait: cmdWait,
  create: cmdCreate,
  chat: cmdChat,
  review: cmdReview,
  annotate: cmdAnnotate,
  resign: () => simpleAction("resign", {}, "You resigned."),
  rematch: () => simpleAction("rematch", {}, "Rematch requested."),
  flag: () => simpleAction("flag", {}, "Checked the clock."),
  draw: () => {
    const what = String(pos[2] || "").toLowerCase();
    const map = { offer: "offer-draw", accept: "accept-draw", decline: "decline-draw" };
    if (!map[what])
      die("Usage: draw ROOM offer|accept|decline");
    return simpleAction(map[what], {}, `Draw ${what} sent.`);
  }
};
if (cmd === "version" || opt.version) {
  console.log(VERSION);
  process.exit(0);
}
if (!cmd || cmd === "help" || opt.help || !commands[cmd]) {
  console.log(HELP);
  process.exit(cmd && cmd !== "help" && !opt.help ? 1 : 0);
}
await commands[cmd]();
process.exit(0);
