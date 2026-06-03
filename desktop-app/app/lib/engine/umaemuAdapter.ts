import { UmaStatusData } from "../types";

export async function loadUmasimEngine() {
  try {
    const wasmModule = await import('./umaemu/race.js');
    return wasmModule;
  } catch (error) {
    console.error("Failed to load umasim engine:", error);
    throw error;
  }
}

export async function runUmaSimulation(data: UmaStatusData) {
  const engine = await loadUmasimEngine();

  // マッピング処理
  const payload = {
    umaStatus: {
      speed: data.speed,
      stamina: data.stamina,
      power: data.power,
      guts: data.guts,
      wisdom: data.wisdom,
      condition: "BEST",
      style: "NIGE",
      // とりあえずマイル・芝・逃げの評価を採用（必要に応じて変更可能）
      distanceFit: data.aptitudes.mile || "A",
      surfaceFit: data.aptitudes.turf || "A",
      styleFit: data.aptitudes.nige || "A",
      skillNames: data.skills || []
    },
    track: {
      location: 10001, // 札幌
      course: 10102, // 芝1500m
      condition: "GOOD",
      gateCount: 9
    },
    season: 0,
    weather: 0,
    badStart: false
  };

  console.log("Sending payload to WASM engine:", payload);
  const jsonInput = JSON.stringify(payload);
  
  const jsonOutput = engine.runSimulation(jsonInput);
  
  const result = JSON.parse(jsonOutput);
  if (result.error) {
    throw new Error(result.error);
  }
  
  return result;
}
