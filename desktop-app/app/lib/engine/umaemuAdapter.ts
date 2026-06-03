import { UmaStatusData } from "../types";

let cachedEngine: any = null;
let engineLoadPromise: Promise<any> | null = null;
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
  if (typeof window === 'undefined') {
    throw new Error("WASM engine can only be loaded in the browser");
  }
  
  if (cachedEngine) return cachedEngine;
  if (engineLoadPromise) return engineLoadPromise;

  engineLoadPromise = new Promise((resolve, reject) => {
    if ((window as any).race) {
      Promise.resolve((window as any).race).then((engine) => {
        cachedEngine = engine;
        resolve(engine);
      }).catch(reject);
      return;
    }

    const script = document.createElement('script');
    script.src = '/umaemu/race.js';
    script.onload = () => {
      Promise.resolve((window as any).race).then((engine) => {
        cachedEngine = engine;
        resolve(engine);
      }).catch((err) => {
        engineLoadPromise = null;
        reject(err);
      });
    };
    script.onerror = () => {
      engineLoadPromise = null;
      reject(new Error("Failed to load race.js script"));
    };
    document.body.appendChild(script);
  });

  return engineLoadPromise;
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
