function updateCheckbox(element){
    if(!(this instanceof Window))
        element = this;
    $(element).next("label").text($(element).is(":checked") ? _LN['switch_true'] : _LN['switch_false'])
    .addClass(!$(element).is(":checked")?"btn-danger":"btn-success")
    .removeClass($(element).is(":checked")?"btn-danger":"btn-success");
}
let Socket = null;
let Volume = 100;
$(document).on("launch_game",function(){
    $("#nickname").val(Cookies.get("nickname") || "");
    $("#gameCode").data("hover",_LN[$("#gameCode").data("ln")])
    $(document).on('keypress',function(e) {
        if(e.which == 13 && $("#chat").is(":focus")) {
            if($("#chat").val().trim().length == 0 || $("#chat").val().trim().length > 100)
                return;
            Socket.send($("#chat").val());
            $("#chat").val("");
        }
    });
    $("input[type='checkbox']").change(updateCheckbox);
    $("#gameCode").on( "mouseenter", function(){
        $(this).val(location.origin+location.pathname+"?"+GameData.Id);
        $(this).select();
    } ).on( "mouseleave", function(){
        $(this).val($(this).data("hover"));
    } );
    $("#waitBetweenPlayers").change(function(){
        if(GameData.Owner.Id == PlayerData.Id)
            Socket.emit("game:change","waitBetweenPlayers",$(this).is(":checked"));
    });
    $("#customWordsOnly").change(function(){
        if(GameData.Owner.Id == PlayerData.Id)
            Socket.emit("game:change","customWordsOnly",$(this).is(":checked"));
    });
    $("#guessTime").change(function(){
        if(GameData.Owner.Id == PlayerData.Id)
            Socket.emit("game:change","guessTime",$(this).val());
    });
    $("#rounds").change(function(){
        if(GameData.Owner.Id == PlayerData.Id)
            Socket.emit("game:change","rounds",$(this).val());
    });
    $("#language").change(function(){
        if(GameData.Owner.Id == PlayerData.Id)
            Socket.emit("game:change","language",$(this).val());
    });
    
    $("#startGame").click(function(){
        if(GameData.Owner.Id == PlayerData.Id)
            Socket.emit("game:start");
    });

    let timer = null;
    $("#customWords").on('keyup', function(e) {
        clearTimeout(timer);
        let value = $(this).val();
        timer = setTimeout(function(){
            Socket.emit("game:change","customWords",value);
        }, 600);
    });

    $("#customWords").on('keydown', function(e) {
        clearTimeout(timer);
    });


    $("#joinGame").click(function(){
        PlayerData = {
            Nickname: $("#nickname").val().trim()
        };
        Cookies.set('nickname', $("#nickname").val().trim(), { expires: 7 });
        $("#join-container").find("input, button").prop("disabled",true);
        Socket = createGameSocket();
        $("#loading-container").show().addClass("d-flex");
    });
    $("#createGame").click(function(){
        PlayerData = {
            Nickname: $("#nickname").val().trim(),
            Create: true
        };
        Cookies.set('nickname', $("#nickname").val().trim(), { expires: 7 });
        $("#join-container").find("input, button").prop("disabled",true);
        Socket = createGameSocket();
        $("#loading-container").show().addClass("d-flex");
    });
    $("#settings").click(function(){
        $("#settingsModal").modal("show");
    });
    $("#volumeRange").on('input',function(){
        Volume = $(this).val();
        $(this).prev("label").text(_LN['label_volume'].format(Volume));
        AudioData.click.currentTime = 0;
        AudioData.click.volume = Volume/100;
        AudioData.click.play();
    });
    $("#volumeRange").prev("label").text(_LN['label_volume'].format(100));
    $("#loading-container").hide().removeClass("d-flex");
});

let PlayerData = null;
let GameData = null;
let AudioData = {
    click: new Audio(location.origin+location.pathname+"sfx/click.wav"),
    blip: new Audio(location.origin+location.pathname+"/sfx/blip.wav"),
    playerJoin: new Audio(location.origin+location.pathname+"/sfx/playerJoin.wav"),
    playerLeave: new Audio(location.origin+location.pathname+"/sfx/playerLeave.wav"),
    letterMiss: new Audio(location.origin+location.pathname+"/sfx/letterMiss.wav"),
    letterFound: new Audio(location.origin+location.pathname+"/sfx/letterFound.wav"),
    gameOver: new Audio(location.origin+location.pathname+"/sfx/gameOver.wav"),
    gameStart: new Audio(location.origin+location.pathname+"/sfx/gameStart.wav"),
    wordFound: new Audio(location.origin+location.pathname+"/sfx/wordFound.wav"),
    nextPlayer: new Audio(location.origin+location.pathname+"/sfx/nextPlayer.wav"),
};

function createGameSocket(){
    const socket = io({query: {lang:_LANG}, path: location.pathname+"socket.io"});
    socket.on("connect", () => {
        $("#gameCode").val($("#gameCode").data("hover"));
        socket.emit("set-nick", PlayerData?.Nickname);
    });
    socket.on("disconnect", (reason) => {
        if(reason != "ping timeout"){
            socket.disconnect();
            socket.removeAllListeners();
            $("#loading-container").show().addClass("d-flex");
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
        $("#loading-container").hide().removeClass("d-flex");
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

        $("#language").val(GameData.WordLanguage);

        $("#waitBetweenPlayers").prop("checked",GameData.DelayNextPlayer);
        updateCheckbox("#waitBetweenPlayers");
        $("#customWordsOnly").prop("checked",GameData.CustomOnly);
        updateCheckbox("#customWordsOnly");
        $("#customWords").val(GameData.CustomWords.join("\n"));
        $("#guessTime").val(GameData.GuessTime);
        $("#rounds").val(GameData.MaxRounds);

        $("#player-list").html("");
        for(let player of GameData.Players){
            let isYou = player.Id == PlayerData.Id;
            $("#player-list").append($.parseHTML(`<div class="p-2 mb-2 bg-warning player-container ${isYou ? "self" : ""}" id="player-${player.Id}">
            <p class="mb-0 border-bottom border-2 border-danger">${player.Nickname}${isYou ? ` (${_LN['player_self']})` : ""}</p>
            <span class="text-danger">${_LN['player_points'].format(player.Points)}</span>
        </div>`));
        }

        AudioData.playerJoin.currentTime = 0;
        AudioData.playerJoin.volume = Volume/100;
        AudioData.playerJoin.play();

        $("#roundDisplay").text(`${GameData.CurrentRound}/${GameData.MaxRounds}`);
        if(GameData.IsPlaying){
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

        $("#roundDisplay").text(`${GameData.CurrentRound}/${GameData.MaxRounds}`);
        $("#language").val(GameData.WordLanguage);

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

        $("#roundDisplay").text(`${GameData.CurrentRound}/${GameData.MaxRounds}`);

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
            AudioData.nextPlayer.currentTime = 0;
            AudioData.nextPlayer.play();
            $("#chat").addClass("border-danger-subtle border-2").prop("placeholder",_LN['placeholder_current_player_help']);
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
            case "too-few-custom":
                addChat(_LN["game_error_"+error], "border border-1 border-danger");
                break;
            case "found-has":
            case "miss-has":
                addChat(_LN["game_error_"+error], "border border-1 border-secondary");
                break;
            case "chat-limit-exceeded":
                break;
            default:
                addChat(_LN['game_error_unknown'].format(error), "border border-1 border-danger");
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
        $("#roundDisplay").text(`${GameData.CurrentRound}/${GameData.MaxRounds}`);
        $(".player-container").removeClass("active");
        $("#chat").removeClass("border-danger-subtle border-2").prop("placeholder","");
    });
    socket.on("game:newOwner", (...args) => {
        GameData.Owner = args[0];
        if(GameData.Owner.Id == PlayerData.Id){
            $("#settings-field").find(".game-control").prop("disabled",false);
            addChat(_LN['chat_new_host'], "border border-1 border-primary");
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
        $("#player-"+obj.player.Id).find("span").text(_LN['player_points'].format(obj.player.Points));
        drawLetters();
        AudioData.letterFound.currentTime = 0;
        AudioData.letterFound.volume = Volume/100;
        AudioData.letterFound.play();
    });
    socket.on("game:wordFound", (...args) => {
        let obj = args[0];
        GameData.Letters = obj.letters;
        GameData.StyledLetters = obj.styled;
        $("#player-"+obj.player.Id).find("span").text(_LN['player_points'].format(obj.player.Points));
        drawLetters();
        AudioData.wordFound.currentTime = 0;
        AudioData.wordFound.volume = Volume/100;
        AudioData.wordFound.play();
    });

    socket.on("self:error", (...args) => {
        let error = args[0];
        switch(error){
            case "not-owner":
                addChat(_LN["self_error_"+error], "border border-1 border-danger");
                break;
            default:
                addChat(_LN["self_error_unknown"].format(error), "border border-1 border-danger");
                break;
        }
    });

    socket.on("player:join", (...args) => {
        let player = args[0];
        $("#player-list").append($.parseHTML(`<div class="p-2 mb-2 bg-warning player-container" id="player-${player.Id}">
            <p class="mb-0 border-bottom border-2 border-danger">${player.Nickname}</p>
            <span class="text-danger">${_LN['player_points'].format(player.Points)}</span>
        </div>`));
        addChat(_LN['chat_player_join'].format(player.Nickname), "border border-1 border-info");
        AudioData.playerJoin.currentTime = 0;
        AudioData.playerJoin.volume = Volume/100;
        AudioData.playerJoin.play();
    });
    socket.on("player:leave", (...args) => {
        let player = args[0];
        $("#player-"+player.Id).remove();
        addChat(_LN['chat_player_leave'].format(player.Nickname), "border border-1 border-info");
        AudioData.playerLeave.currentTime = 0;
        AudioData.playerLeave.volume = Volume/100;
        AudioData.playerLeave.play();
    });
    socket.on("player:update", (...args) => {
        let player = args[0];
        let isYou = player.Id == PlayerData.Id ? ` (${_LN['player_self']})` : "";
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
    $("#chat-field").scrollTop($("#chat-field").prop('scrollHeight')); 
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
    let length = 0;
    for (let pos = 0; pos < array.length; pos++) {
        const letter = array[pos];
        if(letter == " "){
            $("#word-display").append(` `);
            continue;
        }
        length++;
        const next = array[pos+1] || "";
        const styledLetter = styled[pos] == letter ? letter.toUpperCase() : letter;
        $("#word-display").append(`<span>${styledLetter}</span>`);
        if(next == " "){
            $("#word-display").append(`<sub class="fs-6 me-3 user-select-none">${length}</sub>`);
            length = 0;
        }
    }
    $("#word-display").append(`<sub class="fs-6 user-select-none">${length}</sub>`);
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
        case 10:
            $('canvas').drawText({
                strokeStyle: '#b02a37',
                fillStyle: '#dc3545',
                strokeWidth: 2,
                x: 150, y: 250,
                fontSize: 48,
                fontFamily: 'Verdana, sans-serif',
                text: 'Game Over'
            });
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
        case 8:
        case 9:
            $('canvas').drawImage({
                source: 'img/'+code+'.png',
                x: 150, y: 145
            });
            break;
    }
}