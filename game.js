"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const uuid_1 = require("uuid");
const grapheme_splitter_1 = __importDefault(require("grapheme-splitter"));
const node_crypto_1 = require("node:crypto");
class Game {
    static splitter = new grapheme_splitter_1.default();
    static List = new Map();
    static GlobalWords = new Set();
    static GlobalNicks = new Set();
    Id;
    IsPlaying = false;
    CustomWords = [];
    CustomOnly = false;
    GuessTime = 15;
    MaxRounds = 1;
    DelayNextPlayer = true;
    _Word = null;
    get Word() {
        return this._Word;
    }
    set Word(v) {
        if (this.IsPlaying)
            return;
        this._Word = v;
        this.Letters.clear();
        this.StyledLetters.clear();
        this.Found.clear();
        this.Found.add(" ").add("-").add(".").add("?").add("!").add(",").add(";");
        this.Miss.clear();
        let pos = 0;
        for (const c of Game.splitter.splitGraphemes(v)) {
            let positions = this.Letters.get(c.toLowerCase()) || [];
            positions.push(pos++);
            this.Letters.set(c.toLowerCase(), positions);
            if (c != c.toLowerCase()) {
                positions = this.StyledLetters.get(c.toLowerCase()) || [];
                positions.push(pos - 1);
                this.StyledLetters.set(c.toLowerCase(), positions);
            }
        }
    }
    StyledLetters = new Map();
    Letters = new Map();
    Found = new Set();
    Miss = new Set();
    OldWords = new Set();
    CurrentRound = 0;
    Countdown = 0;
    Timer = null;
    CurrentPlayer = null;
    NextPlayer = null;
    Players = new Set();
    Owner;
    constructor(owner, id) {
        this.Id = id || (0, uuid_1.v4)().split("-")[0];
        this.Owner = owner;
        this.Players.add(this.Owner);
        Game.List.set(this.Id, this);
    }
    get Info() {
        let _letters = new Map();
        let _styled = new Map();
        this.Letters.forEach((positions, letter) => {
            if (this.Found.has(letter)) {
                _letters.set(letter, positions);
                if (this.StyledLetters.has(letter)) {
                    _styled.set(letter, this.StyledLetters.get(letter));
                }
            }
            else {
                let newPositions = _letters.get("_") || [];
                newPositions.push(...positions);
                newPositions.sort();
                _letters.set("_", newPositions);
            }
        });
        let _players = new Set;
        this.Players.forEach((player) => {
            _players.add(player.Data);
        });
        return {
            Id: this.Id,
            IsPlaying: this.IsPlaying,
            CustomWords: this.CustomWords,
            CustomOnly: this.CustomOnly,
            GuessTime: this.GuessTime,
            MaxRounds: this.MaxRounds,
            DelayNextPlayer: this.DelayNextPlayer,
            Letters: [..._letters],
            StyledLetters: [..._styled],
            Miss: [...this.Miss],
            Countdown: this.Countdown,
            Players: [..._players],
            CurrentRound: this.CurrentRound,
            CurrentPlayer: this.CurrentPlayer?.Data,
            Owner: this.Owner.Data
        };
    }
    reset(io, delay = 2000, force = false) {
        this.clearTimer();
        setTimeout(() => {
            this.IsPlaying = false;
            this.CurrentPlayer = null;
            this.NextPlayer = null;
            this.Countdown = 0;
            this.Letters.clear();
            this.StyledLetters.clear();
            this.Found.clear();
            this.Miss.clear();
            if (this.CurrentRound == this.MaxRounds || force) {
                this.CurrentRound = 0;
                io.to(`game:${this.Id}`).emit("game:reset", this.Info);
            }
            else {
                this.startGame(io);
            }
        }, delay);
    }
    nextPlayer(io) {
        this.IsPlaying = true;
        let oldPlayer = this.CurrentPlayer;
        this.CurrentPlayer = null;
        let next = false;
        if (oldPlayer != null) {
            for (let p of this.Players) {
                if (next) {
                    this.NextPlayer = p;
                    break;
                }
                if (p.Id == oldPlayer.Id) {
                    next = true;
                }
            }
        }
        if (this.NextPlayer == null) {
            this.NextPlayer = [...this.Players][next ? 0 : (0, node_crypto_1.randomInt)(this.Players.size)];
        }
        if (this.DelayNextPlayer) {
            let _countdown = 3;
            io.to(`game:${this.Id}`).emit("game:countdown", _countdown);
            this.Timer = setInterval(() => {
                _countdown--;
                if (_countdown == 0) {
                    this.CurrentPlayer = this.NextPlayer;
                    this.NextPlayer = null;
                    io.to(`game:${this.Id}`).emit("game:currentPlayer", this.CurrentPlayer.Data);
                    this.clearTimer();
                    this.startCountdown(io);
                    return;
                }
                io.to(`game:${this.Id}`).emit("game:countdown", _countdown);
            }, 1000);
            return;
        }
        this.CurrentPlayer = this.NextPlayer;
        this.NextPlayer = null;
        io.to(`game:${this.Id}`).emit("game:currentPlayer", this.CurrentPlayer.Data);
        this.startCountdown(io);
    }
    startCountdown(io) {
        this.Countdown = this.GuessTime;
        io.to(`game:${this.Id}`).emit("game:countdown", this.Countdown);
        this.Timer = setInterval(() => {
            this.Countdown--;
            if (this.Countdown == 0) {
                io.to(`game:${this.Id}`).emit("game:endRound");
                this.clearTimer();
                setTimeout(() => {
                    this.nextPlayer(io);
                }, this.DelayNextPlayer ? 1000 : 0);
                return;
            }
            io.to(`game:${this.Id}`).emit("game:countdown", this.Countdown);
        }, 1000);
    }
    clearTimer() {
        if (this.Timer == null)
            return;
        this.Countdown = 0;
        clearInterval(this.Timer);
        this.Timer = null;
    }
    startGame(io) {
        if (this.CurrentRound == 0) {
            this.OldWords.clear();
        }
        else {
            this.OldWords.add(this.Word);
        }
        let _words = [];
        if (!this.CustomOnly) {
            _words = Array.from(Game.GlobalWords);
        }
        _words.push(...this.CustomWords);
        while (this.OldWords.has(this.Word)) {
            this.Word = _words[(0, node_crypto_1.randomInt)(_words.length)];
        }
        this.CurrentRound++;
        this.nextPlayer(io);
        io.to(`game:${this.Id}`).emit("game:start", this.Info);
    }
}
module.exports = Game;
//# sourceMappingURL=game.js.map