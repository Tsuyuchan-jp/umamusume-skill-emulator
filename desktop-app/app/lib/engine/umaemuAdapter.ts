import { UmaStatusData, RawSkillData, SimResultDump, RaceCondition } from "../types";
import { getCourseById, getSurfaceKey, getDistanceKey, getStyleKey } from "../aptitudeHelper";

let cachedSkillsJson: string | null = null;

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

let worker: Worker | null = null;
let currentMessageId = 0;
const pendingRequests = new Map<number, { resolve: (val: any) => void, reject: (err: any) => void, onProgress?: (current: number, total: number) => void }>();

function getWorker(): Worker {
  if (typeof window === 'undefined') {
    throw new Error("WASM engine can only be loaded in the browser");
  }

  if (worker) return worker;
  
  worker = new Worker('/umaemu/worker.js');
  worker.onmessage = (event) => {
    const { id, type, results, error } = event.data;
    const req = pendingRequests.get(id);
    if (!req) return;
    
    if (type === 'PROGRESS') {
      if (req.onProgress) req.onProgress(event.data.current, event.data.total);
      return; // Do not delete from pendingRequests yet
    }
    
    pendingRequests.delete(id);
    if (type === 'SUCCESS') {
      req.resolve(results);
    } else {
      // Crash or error in worker
      worker?.terminate();
      worker = null;
      req.reject(new Error(error));
    }
  };
  worker.onerror = (err) => {
    // If worker crashes fundamentally (e.g., OOM)
    pendingRequests.forEach(req => req.reject(new Error(err.message || String(err))));
    pendingRequests.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

export function terminateWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  pendingRequests.forEach(req => req.reject(new Error("Worker terminated")));
  pendingRequests.clear();
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

export async function runMultipleSimulations(
  data: UmaStatusData, 
  raceCondition: RaceCondition, 
  iterations: number = 100,
  onProgress?: (current: number, total: number) => void
): Promise<any> {
  if (!cachedSkillsJson) {
    await fetchSkillData();
  }
  
  const payload = createPayload(data, raceCondition);
  const jsonInput = JSON.stringify(payload);

  const w = getWorker();
  const id = ++currentMessageId;
  
  const resultsPromise = new Promise<any[]>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject, onProgress });
  });

  console.time(`Simulating ${iterations} times via Worker`);
  w.postMessage({
    id,
    type: 'SIMULATE',
    payload: jsonInput,
    iterations,
    skillData: cachedSkillsJson
  });

  let results: any[];
  try {
    results = await resultsPromise;
  } catch (error) {
    console.error("Simulation crashed, worker was terminated.", error);
    // Rethrow to let the UI handle the error and display a toast
    throw error;
  }
  
  console.timeEnd(`Simulating ${iterations} times via Worker`);

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

export async function runUmaSimulation(data: UmaStatusData, raceCondition: RaceCondition): Promise<any> {
  const summary = await runMultipleSimulations(data, raceCondition, 1);
  return summary.rawSample;
}
