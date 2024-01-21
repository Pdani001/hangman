let _LANG = (navigator.language || navigator.userLanguage).split("-")[0];
let _LN = null;
let _LN_DEF = null;
$.getJSON("ln_en.json").done(function(data){
    _LN_DEF = data;
}).fail(function(jqxhr, textStatus, error){
    var err = textStatus + ", " + error;
    console.log( "Default Request Failed: " + err );
    _LN_DEF = {};
}).always(function(){
    $.getJSON("ln_"+_LANG+".json").done(function(data){
        _LN = data;
        if(_LN_DEF == null)
            return;
        for (const key in _LN_DEF) {
            if (!Object.hasOwnProperty.call(_LN, key)) {
                _LN = _LN_DEF[key];
            }
        }
    }).fail(function(jqxhr, textStatus, error){
        var err = textStatus + ", " + error;
        console.log( "Language Request Failed: " + err );
        if(_LN_DEF == null)
            return;
        _LN = _LN_DEF;
    }).always(function(){
        if(_LN != null && _LN_DEF != null){
            $("[data-ln]").each((i,em) => {
                let obj = $(em);
                let type = obj.data("ln-type");
                switch(type){
                    case "value":
                        obj.val(_LN[obj.data("ln")]);
                        break;
                    case "placeholder":
                        obj.prop("placeholder",_LN[obj.data("ln")]);
                        break;
                    case "text":
                    default:
                        obj.text(_LN[obj.data("ln")]);
                        break;
                }
            });
            $(document).trigger("launch_game");
        }
    });
});