import { v4 as uuid } from 'uuid';
export default class Player {
    static List = new Map();
    Id;
    Nickname = null;
    Socket;
    Points = 0;
    GameId;
    Language;
    constructor(socket, nick) {
        this.Id = uuid().split("-")[0];
        socket['Player'] = this.Id;
        this.Socket = socket;
        this.Nickname = nick || null;
        Player.List.set(this.Id, this);
    }
    get Data() {
        return {
            Id: this.Id,
            Nickname: this.Nickname,
            Points: this.Points,
            Language: this.Language
        };
    }
}
//# sourceMappingURL=player.js.map