const fs = require("fs");
const dumps = JSON.parse(fs.readFileSync("dump.json", "utf8"));
const frames = dumps[0].frames;
for(let i=560; i<=566; i++) {
  console.log("f" + i + ": spd=" + frames[i].speed + ", pos=" + frames[i].startPosition);
}
