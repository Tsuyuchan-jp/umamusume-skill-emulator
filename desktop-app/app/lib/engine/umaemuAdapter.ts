import { UmaStatusData, RawSkillData, RaceCondition, RaceDetailDump } from "../types";
import { getCourseById, getSurfaceKey, getDistanceKey, getStyleKey } from "../aptitudeHelper";
import {
  readSkillDataCache,
  writeSkillDataCache,
  removeSkillDataCache,
} from "../skillDataStorage";
import { SkillDataFetchError, SimulationWorkerError, toSimulationError } from "./simulationErrors";

const REMOTE_SKILL_DATA_URL =
  "https://raw.githubusercontent.com/mee1080/umasim/refs/heads/main/data/skill_data.txt";
const BUNDLED_SKILL_DATA_PATH = "/skill_data.txt";
const MIN_SKILL_DATA_LENGTH = 100;

export type SkillDataSource = "remote" | "cache" | "bundled";

export interface SkillDataMeta {
  source: SkillDataSource;
  usedFallback: boolean;
}

let cachedSkillsJson: string | null = null;
let lastSkillDataMeta: SkillDataMeta | null = null;

export function getLastSkillDataMeta(): SkillDataMeta | null {
  return lastSkillDataMeta;
}

function validateSkillDataText(text: string): RawSkillData[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error("Invalid skill data JSON", { cause: error });
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Skill data is not an array");
  }
  if (parsed.length < MIN_SKILL_DATA_LENGTH) {
    throw new Error(`Skill data array too short (${parsed.length})`);
  }

  const first = parsed[0];
  if (
    first == null ||
    typeof first !== "object" ||
    !("id" in first) ||
    !("name" in first)
  ) {
    throw new Error("Skill data missing id/name in first element");
  }

  return parsed as RawSkillData[];
}

function applySkillDataSource(text: string, source: SkillDataSource): RawSkillData[] {
  cachedSkillsJson = text;
  lastSkillDataMeta = {
    source,
    usedFallback: source !== "remote",
  };
  return validateSkillDataText(text);
}

async function fetchRemoteSkillData(): Promise<RawSkillData[]> {
  const res = await fetch(REMOTE_SKILL_DATA_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch skill data: HTTP ${res.status}`);
  }
  const text = await res.text();
  const data = applySkillDataSource(text, "remote");
  await writeSkillDataCache(text);
  return data;
}

async function loadCachedSkillData(): Promise<RawSkillData[] | null> {
  const text = await readSkillDataCache();
  if (text == null) return null;

  try {
    return applySkillDataSource(text, "cache");
  } catch (error) {
    console.warn("Corrupted AppData skill data cache, removing:", error);
    await removeSkillDataCache();
    return null;
  }
}

async function loadBundledSkillData(): Promise<RawSkillData[]> {
  const res = await fetch(BUNDLED_SKILL_DATA_PATH);
  if (!res.ok) {
    throw new Error(`Failed to load bundled skill data: HTTP ${res.status}`);
  }
  const text = await res.text();
  return applySkillDataSource(text, "bundled");
}

/** WASM sim / SIMULATE_DETAIL 専用。パレットは umasimSkillDataList を正本とする。 */
export async function fetchSkillData(): Promise<RawSkillData[]> {
  if (cachedSkillsJson) {
    return validateSkillDataText(cachedSkillsJson);
  }

  try {
    return await fetchRemoteSkillData();
  } catch (remoteError) {
    console.warn("GitHub skill data fetch failed, trying AppData cache:", remoteError);
  }

  try {
    const cached = await loadCachedSkillData();
    if (cached) return cached;
  } catch (cacheError) {
    console.warn("AppData skill data cache failed:", cacheError);
  }

  try {
    return await loadBundledSkillData();
  } catch (bundledError) {
    console.error("All skill data sources failed:", bundledError);
    throw new SkillDataFetchError();
  }
}

let worker: Worker | null = null;
let currentMessageId = 0;
const pendingRequests = new Map<number, { resolve: (val: any) => void, reject: (err: any) => void, onProgress?: (current: number, total: number) => void }>();

/** 超長距離（中山3600m 等）で Worker を走ごとに作り直す距離閾値（m） */
const ULTRA_LONG_DISTANCE_M = 3000;

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
      // Crash or error in worker — 実エラーを toSimulationError 経由で伝播
      worker?.terminate();
      worker = null;
      console.error("Worker simulation error:", error);
      req.reject(toSimulationError(error));
    }
  };
  worker.onerror = (err) => {
    // If worker crashes fundamentally (e.g., OOM)
    console.error("Worker crashed:", err);
    const simError = toSimulationError(err?.message || err);
    pendingRequests.forEach(req => req.reject(simError));
    pendingRequests.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

/** 意図的な再生成用。未完了リクエストは reject しない（バッチ間で pending は空のはず） */
function disposeWorkerSilent() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  pendingRequests.clear();
}

/** N 走完了後に同一 payload で詳細1走を取得 */
async function fetchRaceDetail(jsonInput: string): Promise<RaceDetailDump> {
  const w = getWorker();
  const id = ++currentMessageId;

  const detailPromise = new Promise<RaceDetailDump>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
  });

  w.postMessage({
    id,
    type: 'SIMULATE_DETAIL',
    payload: jsonInput,
    skillData: cachedSkillsJson
  });

  return detailPromise;
}

export function terminateWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  pendingRequests.forEach(req => req.reject(new SimulationWorkerError()));
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
      skillIds: data.skillIds || []
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

/** Worker に SIMULATE を1回投げ、結果配列を返す */
async function postSimulateBatch(
  jsonInput: string,
  iterations: number,
  onProgress?: (current: number, total: number) => void
): Promise<any[]> {
  const w = getWorker();
  const id = ++currentMessageId;

  const resultsPromise = new Promise<any[]>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject, onProgress });
  });

  w.postMessage({
    id,
    type: 'SIMULATE',
    payload: jsonInput,
    iterations,
    skillData: cachedSkillsJson
  });

  return resultsPromise;
}

/**
 * 連続実行。超長距離は Step 2b（走ごとに Worker 再生成）、
 * それ以外は単一 Worker + worker 内 Step 2a（毎走 initializeEngine）。
 */
async function collectSimulationResults(
  jsonInput: string,
  iterations: number,
  courseDist: number,
  onProgress?: (current: number, total: number) => void
): Promise<any[]> {
  const isUltraLong = courseDist >= ULTRA_LONG_DISTANCE_M;

  if (!isUltraLong) {
    return postSimulateBatch(jsonInput, iterations, onProgress);
  }

  // Step 2b: WASM モジュールごと捨てて作り直す（状態汚染の本命対策）
  const results: any[] = [];
  for (let i = 0; i < iterations; i++) {
    disposeWorkerSilent();
    const batch = await postSimulateBatch(jsonInput, 1);
    results.push(...batch);
    if (onProgress) onProgress(i + 1, iterations);
  }
  disposeWorkerSilent();
  return results;
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
  
  const course = getCourseById(raceCondition.locationId, raceCondition.courseId);
  const courseDist = course?.dist ?? 0;
  const payload = createPayload(data, raceCondition);
  const jsonInput = JSON.stringify(payload);

  const timerLabel = `Simulating ${iterations} times via Worker`;
  console.time(timerLabel);

  let results: any[];
  try {
    results = await collectSimulationResults(jsonInput, iterations, courseDist, onProgress);
  } catch (error) {
    console.error("Simulation crashed, worker was terminated.", error);
    // Rethrow to let the UI handle the error and display a toast
    throw error;
  } finally {
    // 失敗時も timer を閉じる（連続失敗時の "Timer already exists" 対策）
    console.timeEnd(timerLabel);
  }

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

  // 詳細1走を自動取得（グラフ表示用）
  let raceDetail: RaceDetailDump | null = null;
  let raceDetailFetchFailed = false;
  try {
    console.time('Fetching race detail via Worker');
    raceDetail = await fetchRaceDetail(jsonInput);
  } catch (error) {
    console.warn("Race detail fetch failed (graph will be unavailable):", error);
    raceDetailFetchFailed = true;
  } finally {
    console.timeEnd('Fetching race detail via Worker');
  }

  return {
    iterations,
    summary: {
      all,
      maxSpurt: aggregateGroup(maxSpurtResults),
      nonMaxSpurt: aggregateGroup(nonMaxSpurtResults)
    },
    rawSample: results[0],
    raceDetail,
    raceDetailFetchFailed,
  };
}

export async function runUmaSimulation(data: UmaStatusData, raceCondition: RaceCondition): Promise<any> {
  const summary = await runMultipleSimulations(data, raceCondition, 1);
  return summary.rawSample;
}
