import Game from "../../game.js";
import Player from "../../player.js";
export const name = 'game:start';
export function execute(io, socket, args) {
    const player = Player.List.get(socket['Player']);
    if (player == undefined) {
        socket.emit("self:error", "empty-nick");
        return;
    }
    const game = Game.List.get(player.GameId);
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
//# sourceMappingURL=game-start.js.map