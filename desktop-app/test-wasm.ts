import { runUmaSimulation, initializeUmasimEngine } from './app/lib/engine/umaemuAdapter';
import { UmaStatusData } from './app/lib/types';

async function test() {
  const data: UmaStatusData = {
    speed: 1000,
    stamina: 1000,
    power: 1000,
    guts: 1000,
    wisdom: 1000,
    aptitudes: {
      turf: "A",
      dirt: "A",
      short: "A",
      mile: "A",
      medium: "A",
      long: "A",
      nige: "A",
      senkou: "A",
      sashi: "A",
      oikomi: "A"
    },
    skills: ["集中力", "直線巧者"]
  };
  try {
    await initializeUmasimEngine();
    const result = await runUmaSimulation(data, {
      locationId: "10001",
      courseId: "10102",
      surfaceCond: 1,
      playerNum: 9
    });
    console.log("Result raceTime:", result.raceTime);
  } catch (e) {
    console.error("Failed:", e);
  }
}

test();
