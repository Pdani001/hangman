import Player from "../../player.js";
import { randomInt } from 'node:crypto';
import Game from '../../game.js';

export const name = 'set-nick';
export function execute(io, socket, args) {
    const lang = socket.handshake.query.lang || "en";
    const gNicks = Game.GlobalNicks.get(lang);
    const nick = args.length > 0 && String(args[0]).trim().length > 0 ? String(args[0]).trim().slice(0, 24) : Array.from(gNicks)[randomInt(gNicks.size)];
    const player = Player.List.get(socket['Player']) || new Player(socket);
    player.Nickname = nick;
    player.Language = lang;
    socket.emit("self:info", player.Data);
    if (player.GameId != undefined) {
        io.to(`game:${player.GameId}`).emit("player:update", player.Data);
    }
}