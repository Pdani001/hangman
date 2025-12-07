"use strict";
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { join, dirname } from 'node:path';
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import express, { static as serveStatic } from "express";
import body_parser from 'body-parser';
const {json} = body_parser;
import cookieParser from "cookie-parser";
const web = express();

import Game from "./game.js";
import Player from './player.js';


console.log("Loading global words...");
let gWords = 0;
const wordsPath = join(__dirname, 'words');
const wordsFiles = readdirSync(wordsPath).filter(file => file.endsWith('.txt') && !file.startsWith('!'));
for (const file of wordsFiles) {
  const filePath = join(wordsPath, file);
  const lang = file.replace(".txt","");
  const words = new Set();
  readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((w)=>{
    if(w.trim().length == 0 || w.startsWith("#")){
      return;
    }
    if(w.includes("_")){
      console.log(`[WARNING] ${w} in ${lang} is not a valid word`);
      return;
    }
    words.add(w);
  });
  gWords += words.size;
  Game.GlobalWords.set(lang,words);
}
console.log(`Loaded and registered ${Game.GlobalWords.size} languages with ${gWords} global words`);

console.log("Loading random nicks...");
let gNicks = 0;
const nicksPath = join(__dirname, 'nicks');
const nicksFiles = readdirSync(nicksPath).filter(file => file.endsWith('.txt') && !file.startsWith('!'));
for (const file of nicksFiles) {
  const filePath = join(nicksPath, file);
  const lang = file.replace(".txt","");
  const nicks = new Set();
  readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((n)=>{
    if(n.trim().length == 0 || n.startsWith("#")){
      return;
    }
    nicks.add(n);
  });
  gNicks += nicks.size;
  Game.GlobalNicks.set(lang,nicks);
}
console.log(`Loaded and registered ${Game.GlobalNicks.size} languages with ${gNicks} random nicks`);

const postEventsPath = join(__dirname, 'events', 'post');
const postEventFiles = readdirSync(postEventsPath).filter(file => file.endsWith('.js') && !file.startsWith('!'));

const postEvents = new Map();
for (const file of postEventFiles) {
  const filePath = join(postEventsPath, file);
  const event = await import(pathToFileURL(filePath));
  if ('name' in event && 'execute' in event){
    postEvents.set(event.name, event);
  } else {
    console.log(`[WARNING] The Post Event at ${filePath} is missing a required "name" or "execute" property.`);
  }
}

web.use(json());
web.use(cookieParser());
web.post("/api/*path", function (req, res, next) {
  if ('POST' != req.method){
      return next();
  }
  res.setHeader("Content-Type","application/json");
  res.setHeader("charset","UTF-8");
  if(req.headers['content-type'] != 'application/json'){
    res.status(400);
    return res.send({error:"`Content-Type` must be `application/json`"});
  }
  const eventName = req.path.slice(1).split("/")[1];
  console.log(`Event: ${eventName}`);
  console.log(`Body: ${JSON.stringify(req.body)}`);
  console.log(`Cookies: ${req.cookies}`);

  const event = postEvents.get(eventName);
  if(!event){
    res.status(404);
    return res.send({
      error: `Invalid event '${eventName}'`
    });
  }

  return event.execute(req.body,res);
});
web.use(serveStatic(join(__dirname, 'public_html')));
const http = web.listen(process.env.PORT);
if(http.listening){
  console.log("HTTP/Socket server is listening on port "+http.address().port);
}
const io = new Server(http, { /* options */ });

const wsEventsPath = join(__dirname, 'events', 'socket');
const wsEventFiles = readdirSync(wsEventsPath).filter(file => file.endsWith('.js') && !file.startsWith('!'));

const wsEvents = new Map();
for (const file of wsEventFiles) {
  const filePath = join(wsEventsPath, file);
  const event = await import(pathToFileURL(filePath));
  if ('name' in event && 'execute' in event){
    wsEvents.set(event.name, event);
  } else {
    console.log(`[WARNING] The Socket Event at ${filePath} is missing a required "name" or "execute" property.`);
  }
}


io.on("connection", (socket) => {
  socket.onAny((eventName, ...args) => {
    const event = wsEvents.get(eventName);
    if(!event){
      socket.emit("invalid event", eventName);
      return;
    }
    event.execute(io,socket,args);
  });
  socket.on("disconnect", (reason) => {
    socket.offAny();
    if(socket['Player'] == undefined){
      return;
    }
    const player = Player.List.get(socket['Player']);
    Player.List.delete(socket['Player']);
    if(player.GameId == undefined)
      return;
    const game = Game.List.get(player.GameId);
    io.to(`game:${game.Id}`).emit("player:leave",player.Data);
    if(game.CurrentPlayer?.Id == player.Id || game.NextPlayer?.Id == player.Id){
      game.clearTimer();
      game.nextPlayer(io);
    }
    game.Players.delete(player);
    if(game.Players.size == 0){
      game.reset(io,0,true);
      Game.List.delete(game.Id);
      return;
    }
    if(game.Players.size == 1 && game.IsPlaying){
      game.reset(io,0,true);
    }
    if(game.Owner.Id == player.Id){
      game.Owner = [...game.Players][0];
      io.to(`game:${game.Id}`).emit("game:newOwner",game.Owner.Data);
    }
  });
});


process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', function (text) {
  const full = text.trim();
  const command = full.split(' ')[0].toLowerCase();
  const args = full.split(' ').slice(1);
  switch(command){
    case "quit":
      quit();
      break;
    case "active":
      console.log(`There are ${Game.List.size} active games with ${Player.List.size} active players`);
      break;
    default:
      console.log("Unknown command: "+command);
      break;
  }
});

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:false}));

function exitHandler(options, exitCode) {
  //if (options.cleanup) console.log('clean');
  if (exitCode || exitCode === 0) console.log(exitCode);
  if (options.exit) quit();
}

async function quit() {
  io.close();
  http.close();
  console.log("Shutting down...");
  process.exit();
}