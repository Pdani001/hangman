"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const game_1 = __importDefault(require("../../game"));
const player_1 = __importDefault(require("../../player"));
module.exports = {
    name: 'game:start',
    execute: (io, socket, args) => {
        const player = player_1.default.List.get(socket['Player']);
        if (player == undefined) {
            socket.emit("self:error", "empty-nick");
            return;
        }
        const game = game_1.default.List.get(player.GameId);
        if (game == undefined) {
            socket.emit("self:error", "no-game");
            return;
        }
        if (game.Owner.Id != player.Id) {
            socket.emit("self:error", "not-owner");
            return;
        }
        if (game.Players.size < 2) {
            socket.emit("game:error", "too-few-players");
            return;
        }
        if (game.CustomOnly && game.CustomWords.length < 5) {
            socket.emit("game:error", "too-few-custom");
            return;
        }
        game.startGame(io);
    }
};
//# sourceMappingURL=game-start.js.map