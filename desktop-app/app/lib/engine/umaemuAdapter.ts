import { UmaStatusData, RawSkillData } from "../types";
import type { RaceCondition } from "../../components/RaceConditionSelector";
import { getCourseById, getSurfaceKey, getDistanceKey, getStyleKey } from "../aptitudeHelper";

let cachedEngine: any = null;
let engineLoadPromise: Promise<any> | null = null;
let cachedSkillsJson: string | null = null;
let isEngineInitialized = false;

export async function fetchSkillData(): Promise<RawSkillData[]> {
  if (cachedSkillsJson) return JSON.parse(cachedSkillsJson) as RawSkillData[];
  
  try {
    const res = await fetch("https://raw.githubusercontent.com/mee1080/umasim/refs/heads/main/data/skill_data.txt");
    if (!res.ok) throw new Error("Failed to fetch skill data");
    const text = await res.text();
    cachedSkillsJson = text;
    return JSON.parse(text) as RawSkillData[];
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

export async function runUmaSimulation(data: UmaStatusData, raceCondition: RaceCondition): Promise<any> {
  if (!isEngineInitialized) {
    await initializeUmasimEngine();
  }
  const engine = cachedEngine;
  const payload = createPayload(data, raceCondition);
  const jsonInput = JSON.stringify(payload);
  const jsonOutput = engine.runSimulation(jsonInput);
  
  const result = JSON.parse(jsonOutput);
  if (result.error) {
    throw new Error(result.error);
  }
  return result;
}

function createPayload(data: UmaStatusData, raceCondition: RaceCondition) {
  const course = getCourseById(raceCondition.locationId, raceCondition.courseId);
  const distanceKey = getDistanceKey(course);
  const surfaceKey = getSurfaceKey(course);
  const styleKey = getStyleKey(data.strategy);

  return {
    umaStatus: {
      speed: data.speed,
      stamina: data.stamina,
      power: data.power,
      guts: data.guts,
      wisdom: data.wisdom,
      condition: data.condition || "BEST",
      style: data.strategy || "NIGE",
      popularity: data.popularity || 1,
      gateNumber: data.gateNumber || 0,
      distanceFit: data.aptitudes[distanceKey] || "A",
      surfaceFit: data.aptitudes[surfaceKey] || "A",
      styleFit: data.aptitudes[styleKey] || "A",
      skillNames: data.skills || []
    },
    track: {
      location: Number(raceCondition.locationId),
      course: Number(raceCondition.courseId),
      condition: ["", "GOOD", "YAYAOMO", "OMO", "BAD"][raceCondition.surfaceCond] || "GOOD",
      gateCount: raceCondition.playerNum
    },
    season: 0,
    weather: 0,
    badStart: false
  };
}


export async function runMultipleSimulations(data: UmaStatusData, raceCondition: RaceCondition, iterations: number = 100): Promise<any> {
  if (!isEngineInitialized) {
    await initializeUmasimEngine();
  }
  const engine = cachedEngine;
  
  const payload = createPayload(data, raceCondition);
  const jsonInput = JSON.stringify(payload);

  const results = [];
  console.time(`Simulating ${iterations} times`);
  
  // Note: Running 100 times synchronously. If iterations > 1000, we should yield to the event loop.
  for (let i = 0; i < iterations; i++) {
    const jsonOutput = engine.runSimulation(jsonInput);
    const parsed = JSON.parse(jsonOutput);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    results.push(parsed);
  }
  
  console.timeEnd(`Simulating ${iterations} times`);

  // Basic aggregation for debug view
  // Extract times
  const times = results.map(r => r.time || 0);
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  // Remaining Stamina
  const remainingStaminas = results.map(r => r.spMin || 0); // Need to check actual fields in WASM result
  const avgStamina = remainingStaminas.reduce((a, b) => a + b, 0) / remainingStaminas.length;

  return {
    iterations,
    summary: {
      avgTime,
      minTime,
      maxTime,
      avgStamina
    },
    rawSample: results[0] // Return one sample to inspect fields
  };
}
