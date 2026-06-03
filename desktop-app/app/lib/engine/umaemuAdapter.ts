import { UmaStatusData } from "../types";

let cachedEngine: any = null;
let cachedSkillsJson: string | null = null;
let isEngineInitialized = false;

export async function fetchSkillData() {
  if (cachedSkillsJson) return JSON.parse(cachedSkillsJson);
  
  try {
    const res = await fetch("https://raw.githubusercontent.com/mee1080/umasim/refs/heads/main/data/skill_data.txt");
    if (!res.ok) throw new Error("Failed to fetch skill data");
    const text = await res.text();
    cachedSkillsJson = text;
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to fetch skill data from GitHub:", error);
    throw error;
  }
}

export async function loadUmasimEngine() {
  if (cachedEngine) return cachedEngine;
  try {
    const wasmModule = await import('./umaemu/race.js');
    cachedEngine = wasmModule;
    return wasmModule;
  } catch (error) {
    console.error("Failed to load umasim engine:", error);
    throw error;
  }
}

export async function initializeUmasimEngine() {
  if (isEngineInitialized) return;
  
  const [engine, _] = await Promise.all([
    loadUmasimEngine(),
    fetchSkillData()
  ]);
  
  if (cachedSkillsJson) {
    engine.initializeEngine(cachedSkillsJson);
    isEngineInitialized = true;
    console.log("WASM Engine initialized with skill data.");
  }
}

export async function runUmaSimulation(data: UmaStatusData) {
  if (!isEngineInitialized) {
    await initializeUmasimEngine();
  }
  const engine = cachedEngine;

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
