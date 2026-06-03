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

self.onmessage = async (event) => {
  const { id, type, payload, iterations, skillData } = event.data;

  try {
    if (type === 'SIMULATE') {
      const engine = await initEngine(skillData);
      
      const results = [];
      for (let i = 0; i < iterations; i++) {
        const jsonOutput = engine.runSimulation(payload);
        results.push(JSON.parse(jsonOutput));
        
        if (i > 0 && i % 100 === 0) {
          self.postMessage({ id, type: 'PROGRESS', current: i, total: iterations });
        }
      }
      
      self.postMessage({ id, type: 'SUCCESS', results });
    }
  } catch (error) {
    self.postMessage({ id, type: 'ERROR', error: error.message || String(error) });
  }
};
