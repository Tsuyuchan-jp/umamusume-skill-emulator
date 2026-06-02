const fs = require("fs");
const dumps = JSON.parse(fs.readFileSync("dump.json", "utf8"));
const frames = dumps.find(d => d.name === "Kyoto 3200m Oikomi").frames;
for(let i=265; i<=272; i++) {
  console.log("f" + i + ": spd=" + frames[i].speed + ", pos=" + frames[i].startPosition);
}
