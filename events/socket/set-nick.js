const Player = require("../../player");

module.exports = {
    name: 'set-nick',
    execute: (io, socket, args) => {
        const nick = args.length > 0 && String(args[0]).trim().length > 0 ? String(args[0]).trim() : "Player";
        const player = Player.List.get(socket['Player']) || new Player(socket);
        player.Nickname = nick;
        socket.emit("self:info",player.Data);
        if(player.GameId != undefined){
            io.to(`game:${player.GameId}`).emit("player:update",player.Data);
        }
    }
}