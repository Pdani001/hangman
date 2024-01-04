import {v4 as uuid} from 'uuid';
import Player from './player';
import GraphemeSplitter from 'grapheme-splitter';
import { Server } from 'socket.io';
import { randomInt } from 'node:crypto';
class Game {
    private static readonly splitter = new GraphemeSplitter()
    static readonly List: Map<string,Game> = new Map();
    static readonly GlobalWords: Set<string> = new Set();
    static readonly GlobalNicks: Set<string> = new Set();
    readonly Id: string;
    IsPlaying: boolean = false;
    CustomWords: string[] = [];
    CustomOnly: boolean = false;
    GuessTime: number = 15;
    MaxRounds: number = 1;
    DelayNextPlayer: boolean = true;

    private _Word : string = null;
    public get Word() : string {
        return this._Word;
    }
    public set Word(v : string) {
        if(this.IsPlaying)
            return;
        this._Word = v;
        this.Letters.clear();
        this.StyledLetters.clear();
        this.Found.clear();
        this.Found.add(" ").add("-").add(".").add("?").add("!").add(",").add(";");
        this.Miss.clear();
        let pos = 0;
        for(const c of Game.splitter.splitGraphemes(v)){
            let positions = this.Letters.get(c.toLowerCase()) || [];
            positions.push(pos++);
            this.Letters.set(c.toLowerCase(),positions);

            if(c != c.toLowerCase()){
                positions = this.StyledLetters.get(c.toLowerCase()) || [];
                positions.push(pos-1);
                this.StyledLetters.set(c.toLowerCase(),positions);
            }
        }
    }
    
    readonly StyledLetters: Map<string,number[]> = new Map();
    readonly Letters: Map<string,number[]> = new Map();
    readonly Found: Set<string> = new Set();
    readonly Miss: Set<string> = new Set();
    readonly OldWords: Set<string> = new Set();
    CurrentRound: number = 0;
    Countdown: number = 0;
    Timer: NodeJS.Timeout = null;
    CurrentPlayer: Player = null;
    NextPlayer: Player = null;
    readonly Players: Set<Player> = new Set();
    Owner: Player;
    constructor(owner: Player, id?: string) {
        this.Id = id || uuid().split("-")[0];
        this.Owner = owner;
        this.Players.add(this.Owner);
        Game.List.set(this.Id,this);
    }

    public get Info(){
        let _letters = new Map<string,number[]>();
        let _styled = new Map<string,number[]>();
        this.Letters.forEach((positions,letter)=>{
            if(this.Found.has(letter)){
                _letters.set(letter,positions);
                if(this.StyledLetters.has(letter)){
                    _styled.set(letter,this.StyledLetters.get(letter));
                }
            } else {
                let newPositions = _letters.get("_") || [];
                newPositions.push(...positions);
                newPositions.sort();
                _letters.set("_",newPositions);
            }
        });
        let _players = new Set<{
            Id: string;
            Nickname: string;
            Points: number;
        }>;
        this.Players.forEach((player)=>{
            _players.add(player.Data);
        })
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

    reset(io: Server, delay: number = 2000, force: boolean = false) {
        this.clearTimer();
        setTimeout(()=>{
            this.IsPlaying = false;
            this.CurrentPlayer = null;
            this.NextPlayer = null;
            this.Countdown = 0;
            this.Letters.clear();
            this.StyledLetters.clear();
            this.Found.clear();
            this.Miss.clear();
            if(this.CurrentRound == this.MaxRounds || force){
                this.CurrentRound = 0;
                io.to(`game:${this.Id}`).emit("game:reset",this.Info);
            } else {
                this.startGame(io);
            }
        },delay);
    }

    nextPlayer(io: Server) {
        this.IsPlaying = true;
        let oldPlayer = this.CurrentPlayer;
        this.CurrentPlayer = null;
        let next = false;
        if(oldPlayer != null){
            for(let p of this.Players){
                if(next){
                    this.NextPlayer = p;
                    break;
                }
                if(p.Id == oldPlayer.Id){
                    next = true;
                }
            }
        }
        if(this.NextPlayer == null){
            this.NextPlayer = [...this.Players][next ? 0 : randomInt(this.Players.size)];
        }
        if(this.DelayNextPlayer){
            let _countdown = 3;
            io.to(`game:${this.Id}`).emit("game:countdown",_countdown);
            this.Timer = setInterval(()=>{
                _countdown--;
                if(_countdown == 0){
                    this.CurrentPlayer = this.NextPlayer;
                    this.NextPlayer = null;
                    io.to(`game:${this.Id}`).emit("game:currentPlayer",this.CurrentPlayer.Data);
                    this.clearTimer();
                    this.startCountdown(io);
                    return;
                }
                io.to(`game:${this.Id}`).emit("game:countdown",_countdown);
            },1000);
            return;
        }
        this.CurrentPlayer = this.NextPlayer;
        this.NextPlayer = null;
        io.to(`game:${this.Id}`).emit("game:currentPlayer",this.CurrentPlayer.Data);
        this.startCountdown(io);
    }
    
    startCountdown(io: Server) {
        this.Countdown = this.GuessTime;
        io.to(`game:${this.Id}`).emit("game:countdown",this.Countdown);
        this.Timer = setInterval(()=>{
            this.Countdown--;
            if(this.Countdown == 0){
                io.to(`game:${this.Id}`).emit("game:endRound");
                this.clearTimer();
                setTimeout(()=>{
                    this.nextPlayer(io);
                },this.DelayNextPlayer?1000:0);
                return;
            }
            io.to(`game:${this.Id}`).emit("game:countdown",this.Countdown);
        },1000);
    }

    clearTimer(){
        if(this.Timer == null)
            return;
        this.Countdown = 0;
        clearInterval(this.Timer);
        this.Timer = null;
    }

    startGame(io: Server){
        if(this.CurrentRound == 0){
            this.OldWords.clear();
        } else {
            this.OldWords.add(this.Word);
        }

        let _words: string[] = [];
        if(!this.CustomOnly){
            _words = Array.from(Game.GlobalWords);
        }
        _words.push(...this.CustomWords);
        
        while(this.OldWords.has(this.Word)){
            this.Word = _words[randomInt( _words.length)];
        }

        this.CurrentRound++;

        this.nextPlayer(io);
        io.to(`game:${this.Id}`).emit("game:start",this.Info);
    }
}
export = Game;