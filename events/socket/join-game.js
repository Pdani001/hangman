const Game = require("../../game");
const Player = require("../../player");

module.exports = {
    name: 'join-game',
    execute: (io, socket, args) => {
        const code = args[0] || false;
        const player = Player.List.get(socket['Player']);
        if(player == undefined){
            socket.emit("self:error","empty-nick");
            return;
        }
        if(player.GameId != undefined){
            socket.emit("self:error","in-game-already");
            return;
        }
        if(code == false || !Game.List.has(code)){
            const games = [...Game.List].sort(() => Math.random() - 0.5);
            const game = games.length > 0 ? games[0][1] : new Game(player);
            player.GameId = game.Id;
            game.Players.add(player);
            socket.emit("game:info",game.Info);
            io.to(`game:${game.Id}`).emit("player:join",player.Data);
            socket.join(`game:${game.Id}`);
            return;
        }
        const game = Game.List.get(code);
        player.GameId = game.Id;
        game.Players.add(player);
        socket.emit("game:info",game.Info);
        io.to(`game:${game.Id}`).emit("player:join",player.Data);
        socket.join(`game:${game.Id}`);
    }
}