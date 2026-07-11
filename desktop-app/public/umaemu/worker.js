// Web Worker for umasim engine

// Mock document for Emscripten race.js which assumes it runs in a browser window
self.document = { baseURI: self.location.href };

// `race.js` will export a factory function `self.race`
importScripts('/umaemu/race.js');

let engineInstance = null;

async function initEngine(skillData) {
  if (!engineInstance) {
    if (self.race) {
      engineInstance = await Promise.resolve(self.race);
      // Initialize it with the skill data
      engineInstance.initializeEngine(skillData);
    } else {
      throw new Error('Engine (self.race) not found in race.js');
    }
  }
  return engineInstance;
}

/** 連続 runSimulation 時の WASM 状態汚染対策: 毎走前にスキルデータを再投入 */
function reinitializeEngine(skillData) {
  if (!engineInstance) return;
  engineInstance.initializeEngine(skillData);
}

function formatWorkerError(error) {
  if (error == null) return "null";
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

self.onmessage = async (event) => {
  const { id, type, payload, iterations, skillData } = event.data;

  try {
    if (type === 'SIMULATE') {
      const engine = await initEngine(skillData);
      
      const results = [];
      for (let i = 0; i < iterations; i++) {
        // Step 2a: 毎走前にエンジン再初期化（超長距離×連続実行の状態汚染対策）
        reinitializeEngine(skillData);
        const jsonOutput = engine.runSimulation(payload);
        results.push(JSON.parse(jsonOutput));
        
        if (i > 0 && i % 100 === 0) {
          self.postMessage({ id, type: 'PROGRESS', current: i, total: iterations });
        }
      }
      
      self.postMessage({ id, type: 'SUCCESS', results });
    } else if (type === 'SIMULATE_DETAIL') {
      const engine = await initEngine(skillData);
      reinitializeEngine(skillData);
      const jsonOutput = engine.runSimulationDetail(payload);
      const detail = JSON.parse(jsonOutput);
      self.postMessage({ id, type: 'SUCCESS', results: detail });
    }
  } catch (error) {
    self.postMessage({ id, type: 'ERROR', error: formatWorkerError(error) });
  }
};
