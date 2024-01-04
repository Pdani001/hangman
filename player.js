"use strict";
const uuid_1 = require("uuid");
class Player {
    static List = new Map();
    Id;
    Nickname = null;
    Socket;
    Points = 0;
    GameId;
    constructor(socket, nick) {
        this.Id = (0, uuid_1.v4)().split("-")[0];
        socket['Player'] = this.Id;
        this.Socket = socket;
        this.Nickname = nick || null;
        Player.List.set(this.Id, this);
    }
    get Data() {
        return {
            Id: this.Id,
            Nickname: this.Nickname,
            Points: this.Points
        };
    }
}
module.exports = Player;
//# sourceMappingURL=player.js.map