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

  // Phase 16.5: 正しいキーによる集計ロジック
  const aggregateGroup = (groupResults: any[]) => {
    if (groupResults.length === 0) return null;

    const times = groupResults.map(r => r.raceTime || 0);
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    const staminas = groupResults.map(r => r.spDiff || 0);
    const avgStamina = staminas.reduce((a, b) => a + b, 0) / staminas.length;
    const maxStamina = Math.max(...staminas);
    const minStamina = Math.min(...staminas);

    const posAdjusts = groupResults.map(r => r.positionCompetitionCount || 0);
    const avgPosAdjust = posAdjusts.reduce((a, b) => a + b, 0) / posAdjusts.length;

    const staminaKeeps = groupResults.map(r => r.staminaKeepDistance || 0);
    const staminaKeepCount = staminaKeeps.filter(d => d > 0).length;
    const staminaKeepRate = staminaKeepCount / staminaKeeps.length;
    const avgStaminaKeepDist = staminaKeepCount > 0 ? staminaKeeps.filter(d => d > 0).reduce((a, b) => a + b, 0) / staminaKeepCount : 0;

    const competeFights: number[] = groupResults.map(r => r.competeFightFinished ? 1 : 0);
    const competeFightRate = competeFights.reduce((a, b) => a + b, 0) / competeFights.length;
    
    const competeFightTimes = groupResults.map(r => r.competeFightTime || 0);
    const competeFightTimesValid = competeFightTimes.filter(t => t > 0);
    const avgCompeteFightTime = competeFightTimesValid.length > 0 ? competeFightTimesValid.reduce((a, b) => a + b, 0) / competeFightTimesValid.length : 0;

    return {
      count: groupResults.length,
      rate: groupResults.length / iterations,
      avgTime,
      minTime,
      maxTime,
      avgStamina,
      maxStamina,
      minStamina,
      avgPosAdjust,
      staminaKeepRate,
      avgStaminaKeepDist,
      competeFightRate,
      avgCompeteFightTime
    };
  };

  const all = aggregateGroup(results);
  const maxSpurtResults = results.filter(r => r.maxSpurt);
  const nonMaxSpurtResults = results.filter(r => !r.maxSpurt);

  return {
    iterations,
    summary: {
      all,
      maxSpurt: aggregateGroup(maxSpurtResults),
      nonMaxSpurt: aggregateGroup(nonMaxSpurtResults)
    },
    rawSample: results[0]
  };
}
