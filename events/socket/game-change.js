import Game from "../../game.js";
import Player from "../../player.js";
export const name = 'game:change';
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
    switch (args[0]) {
        case "waitBetweenPlayers":
            game.DelayNextPlayer = args[1];
            break;
        case "customWordsOnly":
            game.CustomOnly = args[1];
            break;
        case "customWords":
            game.CustomWords = args[1].trim().split('\n').map((s) => {
                return s.trim();
            });
            break;
        case "guessTime":
            game.GuessTime = !Number.isSafeInteger(Number(args[1])) ? 15 : Number(args[1]);
            break;
        case "rounds":
            game.MaxRounds = !Number.isSafeInteger(Number(args[1])) ? 1 : Number(args[1]);
            break;
        case "language":
            game.WordLanguage = args[1].trim();
            if (!Game.GlobalWords.has(game.WordLanguage))
                game.WordLanguage = "en";
            break;
        default:
            return;
    }
    io.to(`game:${game.Id}`).emit("game:change", game.Info);
}
//# sourceMappingURL=game-change.js.map