const fs = require('node:fs');
const { randomInt } = require('node:crypto');
const lang = ";";
let words = [];
fs.readFileSync(`words/${lang}.txt`, 'utf8').split(/\r?\n/).forEach((w)=>{
    if(w.trim().length == 0 || w.startsWith("#") || w.length < 5 || w.includes("_")){
      return;
    }
    words.push(w);
});
while(words.length > 300){
    words.splice(randomInt(words.length),1);
}
fs.writeFileSync(`words/${lang}.txt`,words.join("\r\n"),{encoding:"utf8"});