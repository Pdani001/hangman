let PlayerData = null;
let GameData = null;
let AudioData = {
    click: new Audio(location.origin+"/sfx/click.wav"),
    blip: new Audio(location.origin+"/sfx/blip.wav"),
    playerJoin: new Audio(location.origin+"/sfx/playerJoin.wav"),
    playerLeave: new Audio(location.origin+"/sfx/playerLeave.wav"),
    letterMiss: new Audio(location.origin+"/sfx/letterMiss.wav"),
    letterFound: new Audio(location.origin+"/sfx/letterFound.wav"),
    gameOver: new Audio(location.origin+"/sfx/gameOver.wav"),
    gameStart: new Audio(location.origin+"/sfx/gameStart.wav"),
    wordFound: new Audio(location.origin+"/sfx/wordFound.wav"),
};

function createGameSocket(){
    const socket = io();
    socket.on("connect", () => {
        $("#gameCode").val($("#gameCode").data("hover"));
        socket.emit("set-nick", PlayerData?.Nickname);
    });
    socket.on("disconnect", (reason) => {
        if(reason != "ping timeout"){
            socket.disconnect();
            socket.removeAllListeners();
            $("#join-container").show();
            $("#game-container").hide();
            $("#join-container").find("input, button").prop("disabled",false);
            Socket = null;
            PlayerData = null;
            GameData = null;
        }
    });
    socket.on("self:info", (...args) => {
        let create = PlayerData?.Create;
        PlayerData = args[0];
        if(GameData != null)
            return;
        if(create){
            socket.emit("create-game");
            return;
        }
        const code = location.search.slice(1);
        if(code.length == 8){
            socket.emit("join-game", code);
        } else {
            socket.emit("join-game");
        }
    });
    socket.on("game:info", (...args) => {
        GameData = args[0];
        $("#join-container").hide();
        $("#game-container").show();
        $("#settings-field").find(".game-control").prop("disabled",GameData.Owner.Id != PlayerData.Id);

        $("#waitBetweenPlayers").prop("checked",GameData.DelayNextPlayer);
        updateCheckbox("#waitBetweenPlayers");
        $("#customWordsOnly").prop("checked",GameData.CustomOnly);
        updateCheckbox("#customWordsOnly");
        $("#customWords").val(GameData.CustomWords.join("\n"));
        $("#guessTime").val(GameData.GuessTime);
        $("#rounds").val(GameData.MaxRounds);

        $("#player-list").html("");
        for(let player of GameData.Players){
            let isYou = player.Id == PlayerData.Id ? " (te)" : "";
            $("#player-list").append($.parseHTML(`<div class="p-2 mb-2 bg-warning player-container" id="player-${player.Id}">
            <p class="mb-0 border-bottom border-2 border-danger">${player.Nickname}${isYou}</p>
            <span class="text-danger">${player.Points} pont</span>
        </div>`));
        }

        AudioData.playerJoin.currentTime = 0;
        AudioData.playerJoin.volume = Volume/100;
        AudioData.playerJoin.play();

        if(GameData.IsPlaying){
            $("#roundDisplay").text(`Kör ${GameData.CurrentRound}/${GameData.MaxRounds}`);
            $("#playing-field").show();
            $("#settings-field").hide();
            for(let prog = 0; prog <= GameData.Miss.length; prog++){
                progressGame(prog);
            }
            drawLetters();
            drawMisses();
            if(GameData.CurrentPlayer != null)
                $("#player-"+GameData.CurrentPlayer.Id).addClass("active");
        } else {
            $("#playing-field").hide();
            $("#settings-field").show();
        }
    });
    socket.on("game:change", (...args) => {
        GameData = args[0];

        if(GameData.Owner.Id == PlayerData.Id)
            return;

        $("#waitBetweenPlayers").prop("checked",GameData.DelayNextPlayer);
        updateCheckbox("#waitBetweenPlayers");
        $("#customWordsOnly").prop("checked",GameData.CustomOnly);
        updateCheckbox("#customWordsOnly");
        $("#customWords").val(GameData.CustomWords.join("\n"));
        $("#guessTime").val(GameData.GuessTime);
        $("#rounds").val(GameData.MaxRounds);
    });
    socket.on("game:start", (...args) => {
        GameData = args[0];

        $("#roundDisplay").text(`Kör ${GameData.CurrentRound}/${GameData.MaxRounds}`);

        $("#playing-field").show();
        $("#settings-field").hide();
        progressGame(0);
        drawLetters();
        drawMisses();

        AudioData.gameStart.currentTime = 0;
        AudioData.gameStart.volume = Volume/100;
        AudioData.gameStart.play();
    });
    socket.on("game:countdown", (...args) => {
        $("#timer").text(args[0]);
        if(GameData.CurrentPlayer?.Id == PlayerData.Id && Number(args[0]) <= 5){
            AudioData.blip.currentTime = 0;
            AudioData.blip.volume = Volume/100;
            AudioData.blip.play();
        }
    });
    socket.on("game:currentPlayer", (...args) => {
        $(".player-container").removeClass("active");
        $("#chat").removeClass("border-danger-subtle border-2").prop("placeholder","");
        GameData.CurrentPlayer = args[0];
        $("#player-"+GameData.CurrentPlayer.Id).addClass("active");
        if(GameData.CurrentPlayer?.Id == PlayerData.Id){
            $("#chat").addClass("border-danger-subtle border-2").prop("placeholder","Írj be egy betűt!");
            $("#chat").focus();
        }
    });
    socket.on("game:endRound", (...args) => {
        GameData.CurrentPlayer = null;
        $(".player-container").removeClass("active");
        $("#chat").removeClass("border-danger-subtle border-2").prop("placeholder","");
    });
    socket.on("game:error", (...args) => {
        let error = args[0];
        switch(error){
            case "too-few-players":
                addChat("Nincs elegendő játékos az indításhoz!", "border border-1 border-danger");
                break;
            case "too-few-custom":
                addChat("Kevesebb, mint 5 egyedi szó van!", "border border-1 border-danger");
                break;
            case "found-has":
            case "miss-has":
                addChat("Ez a betű már szerepel a táblán!", "border border-1 border-secondary");
                break;
            case "chat-limit-exceeded":
                break;
            default:
                addChat(`Ismeretlen játékhiba (${error})`, "border border-1 border-danger");
                break;
        }
    });
    socket.on("game:reset", (...args) => {
        GameData = args[0];
        if(GameData.Owner.Id == PlayerData.Id){
            $("#settings-field").find(".game-control").prop("disabled",false);
        }
        $("#playing-field").hide();
        $("#settings-field").show();
        $("#timer").text("0");
        $("#roundDisplay").text(`Kör 0/0`);
        $(".player-container").removeClass("active");
        $("#chat").removeClass("border-danger-subtle border-2").prop("placeholder","");
    });
    socket.on("game:newOwner", (...args) => {
        GameData.Owner = args[0];
        if(GameData.Owner.Id == PlayerData.Id){
            $("#settings-field").find(".game-control").prop("disabled",false);
            addChat(`Te vagy az új játékvezető!`, "border border-1 border-primary");
        }
    });
    socket.on("game:letterMiss", (...args) => {
        let obj = args[0];
        GameData.Miss = obj.misses;
        progressGame(GameData.Miss.length);
        drawMisses();
        AudioData.letterMiss.currentTime = 0;
        AudioData.letterMiss.volume = Volume/100;
        AudioData.letterMiss.play();
    });
    socket.on("game:wordMissed", (...args) => {
        let obj = args[0];
        GameData.Letters = obj.letters;
        GameData.StyledLetters = obj.styled;
        GameData.Miss = obj.misses;
        progressGame(GameData.Miss.length);
        drawMisses();
        drawLetters();
        AudioData.gameOver.currentTime = 0;
        AudioData.gameOver.volume = Volume/100;
        AudioData.gameOver.play();
    });
    socket.on("game:letterFound", (...args) => {
        let obj = args[0];
        GameData.Letters = obj.letters;
        GameData.StyledLetters = obj.styled;
        $("#player-"+obj.player.Id).find("span").text(obj.player.Points+" pont");
        drawLetters();
        AudioData.letterFound.currentTime = 0;
        AudioData.letterFound.volume = Volume/100;
        AudioData.letterFound.play();
    });
    socket.on("game:wordFound", (...args) => {
        let obj = args[0];
        GameData.Letters = obj.letters;
        GameData.StyledLetters = obj.styled;
        $("#player-"+obj.player.Id).find("span").text(obj.player.Points+" pont");
        drawLetters();
        AudioData.wordFound.currentTime = 0;
        AudioData.wordFound.volume = Volume/100;
        AudioData.wordFound.play();
    });

    socket.on("self:error", (...args) => {
        let error = args[0];
        switch(error){
            case "not-owner":
                addChat("Ezt csak a játékvezető teheti meg!", "border border-1 border-danger");
                break;
            default:
                addChat(`Ismeretlen hiba (${error})`, "border border-1 border-danger");
                break;
        }
    });

    socket.on("player:join", (...args) => {
        let player = args[0];
        $("#player-list").append($.parseHTML(`<div class="p-2 mb-2 bg-warning player-container" id="player-${player.Id}">
            <p class="mb-0 border-bottom border-2 border-danger">${player.Nickname}</p>
            <span class="text-danger">${player.Points} pont</span>
        </div>`));
        addChat(`${player.Nickname} csatlakozott.`, "border border-1 border-info");
        AudioData.playerJoin.currentTime = 0;
        AudioData.playerJoin.volume = Volume/100;
        AudioData.playerJoin.play();
    });
    socket.on("player:leave", (...args) => {
        let player = args[0];
        $("#player-"+player.Id).remove();
        addChat(`${player.Nickname} kilépett.`, "border border-1 border-info");
        AudioData.playerLeave.currentTime = 0;
        AudioData.playerLeave.volume = Volume/100;
        AudioData.playerLeave.play();
    });
    socket.on("player:update", (...args) => {
        let player = args[0];
        let isYou = player.Id == PlayerData.Id ? " (te)" : "";
        $("#player-"+player.Id).find("p").text(player.Nickname+isYou);
    });
    socket.on("message", (...args) => {
        let obj = args[0];
        addChat(`<strong>${obj.player.Nickname}:</strong> ${obj.message}`);
        if(obj.player.Id != PlayerData.Id){
            AudioData.click.currentTime = 0;
            AudioData.click.volume = Volume/100;
            AudioData.click.play();
        }
    });
    return socket;
}

function addChat(message, _class = ""){
    $("#chat-field").append(`<p class="${_class}">${message}</p>`);
    $("#chat-field").scrollTop($(this).height()); 
}

function drawLetters(){
    $("#word-display").html("");
    let array = [];
    let styled = [];
    GameData.Letters.forEach(obj => {
        const letter = obj[0];
        const positions = obj[1];
        for(const pos of positions){
            array[pos] = letter;
        }
    });
    GameData.StyledLetters.forEach(obj => {
        const letter = obj[0];
        const positions = obj[1];
        for(const pos of positions){
            styled[pos] = letter;
        }
    });
    let first = 0;
    for (let pos = 0; pos < array.length; pos++) {
        const letter = array[pos];
        if(letter == " "){
            $("#word-display").append(` `);
            continue;
        }
        const next = array[pos+1] || "";
        const styledLetter = styled[pos] == letter ? letter.toUpperCase() : letter;
        $("#word-display").append(`<span>${styledLetter}</span>`);
        if(next == " "){
            first = pos+1;
            $("#word-display").append(`<sub class="fs-6 me-3 user-select-none">${first}</sub>`);
        }
    }
    $("#word-display").append(`<sub class="fs-6 user-select-none">${array.length-first}</sub>`);
}

function drawMisses(){
    $("#missed-letters").text(GameData.Miss.filter((w)=>w.length==1).join(", "));
}

function progressGame(code){
    switch(code){
        default:
        case 0:
            //0
            $('canvas').drawRect({
                fillStyle: '#FFF',
                x: 0, y: 0,
                width: 1000,
                height: 1000
            });
            $('canvas').drawLine({
                strokeStyle: '#000',
                strokeWidth: 6,
                x1: 10, y1: 280,
                x2: 290, y2: 280
            });
            break;
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
        case 8:
        case 9:
        case 10:
            $('canvas').drawImage({
                source: 'img/'+code+'.png',
                x: 150, y: 145
            });
            if(code == 10){
                $('canvas').drawText({
                    strokeStyle: '#b02a37',
                    fillStyle: '#dc3545',
                    strokeWidth: 2,
                    x: 150, y: 250,
                    fontSize: 48,
                    fontFamily: 'Verdana, sans-serif',
                    text: 'Game Over'
                });
            }
            break;
    }
}