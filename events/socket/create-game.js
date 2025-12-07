import Game from "../../game.js";
import Player from "../../player.js";

export const name = 'create-game';
export function execute(io, socket, args) {
    const player = Player.List.get(socket['Player']);
    if (player == undefined) {
        socket.emit("self:error", "empty-nick");
        return;
    }
    if (player.GameId != undefined) {
        socket.emit("self:error", "in-game-already");
        return;
    }
    const game = new Game(player);
    game.WordLanguage = Game.GlobalWords.has(player.Language) ? player.Language : "en";
    player.GameId = game.Id;
    game.Players.add(player);
    socket.emit("game:info", game.Info);
    socket.join(`game:${game.Id}`);
}