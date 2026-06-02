const { RaceSimulator } = require("./webapp/dist/engine/RaceSimulator");
const fs = require("fs");
const dumps = JSON.parse(fs.readFileSync("dump.json", "utf8"));
const dumpData = dumps[0];
const sim = new RaceSimulator(dumpData.status, dumpData.track);
sim.useExpectedValue = true;
sim.simulateRace();
for(let i=560; i<=566; i++) {
  console.log("f" + i + ": spd=" + sim.frames[i].speed + ", pos=" + sim.frames[i].startPosition);
}
