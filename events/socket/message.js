import Game from "../../game.js";
import Player from "../../player.js";
import GraphemeSplitter from "grapheme-splitter";

export const name = 'message';
export function execute(io, socket, args) {
    const message = String(args[0]);
    if (message.length > 100) {
        socket.emit("game:error", "chat-limit-exceeded");
        return;
    }
    const player = Player.List.get(socket['Player']);
    const game = Game.List.get(player.GameId);
    if (game.CurrentPlayer?.Id != player.Id || game.Countdown == 0) {
        io.to(`game:${game.Id}`).emit("message", { message: message, player: player.Data });
        return;
    }
    const splitter = new GraphemeSplitter();
    const splitMsg = splitter.splitGraphemes(message);
    if (splitMsg.length == 1) {
        if (game.Found.has(message.toLowerCase())) {
            socket.emit("game:error", "found-has");
            return;
        }
        if (game.Miss.has(message.toLowerCase())) {
            socket.emit("game:error", "miss-has");
            return;
        }
        io.to(`game:${game.Id}`).emit("game:endRound");
        game.clearTimer();
        if (!game.Letters.has(message.toLowerCase())) {
            game.Miss.add(message.toLowerCase());
            if (game.Miss.size == 10) {
                game.reset(io, 4000);
                io.to(`game:${game.Id}`).emit("game:wordMissed", { misses: game.Info.Miss, word: game.Word, letters: [...game.Letters], styled: [...game.StyledLetters], player: player.Data });
                return;
            }
            game.nextPlayer(io);
            io.to(`game:${game.Id}`).emit("game:letterMiss", { misses: game.Info.Miss, player: player.Data });
            return;
        }
        player.Points += game.Letters.get(message.toLowerCase()).length;
        game.Found.add(message.toLowerCase());
        if (game.Info.Letters.filter((obj) => {
            return obj[0] == "_";
        }).length == 0) {
            player.Points += Math.floor(game.Word.length / 2);
            io.to(`game:${game.Id}`).emit("game:wordFound", { word: game.Word, letters: [...game.Letters], styled: [...game.StyledLetters], player: player.Data });
            game.reset(io);
            return;
        }
        game.nextPlayer(io);
        io.to(`game:${game.Id}`).emit("game:letterFound", { letters: game.Info.Letters, styled: game.Info.StyledLetters, player: player.Data });
        return;
    }
    game.clearTimer();
    if (game.Word.toLowerCase() != message.toLowerCase()) {
        game.Miss.add(message + Date.now());
        if (game.Miss.size == 10) {
            game.reset(io, 4000);
            io.to(`game:${game.Id}`).emit("game:wordMissed", { misses: game.Info.Miss, word: game.Word, letters: [...game.Letters], styled: [...game.StyledLetters], player: player.Data });
            return;
        }
        io.to(`game:${game.Id}`).emit("game:endRound");
        game.nextPlayer(io);
        io.to(`game:${game.Id}`).emit("game:letterMiss", { misses: game.Info.Miss, player: player.Data });
        return;
    }
    let award = game.Info.Letters.filter((obj) => {
        return obj[0] == "_";
    })[0][1].length;
    player.Points += award + Math.floor(game.Word.length / 2);
    io.to(`game:${game.Id}`).emit("game:wordFound", { word: game.Word, letters: [...game.Letters], styled: [...game.StyledLetters], player: player.Data });
    game.reset(io);
}