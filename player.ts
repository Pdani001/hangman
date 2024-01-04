import {v4 as uuid} from 'uuid';
import { Socket } from 'socket.io';
class Player {
    static readonly List: Map<string,Player> = new Map();
    readonly Id: string;
    Nickname?: string = null;
    Socket: Socket;
    Points: number = 0;
    GameId?: string;
    constructor(socket: Socket, nick?: string) {
        this.Id = uuid().split("-")[0];
        socket['Player'] = this.Id;
        this.Socket = socket;
        this.Nickname = nick || null;
        Player.List.set(this.Id,this);
    }

    public get Data() {
        return {
            Id: this.Id,
            Nickname: this.Nickname,
            Points: this.Points
        }
    }
}

export = Player;