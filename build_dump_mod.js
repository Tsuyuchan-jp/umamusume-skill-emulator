const fs = require("fs");
const path = require("path");

function extractVueObject(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const scriptMatch = content.match(/<script.*?>([\s\S]*?)<\/script>/);
  if (!scriptMatch) return null;
  
  let scriptContent = scriptMatch[1];
  
  scriptContent = scriptContent.replace(/export\s+default\s+\{/, "return {");
  scriptContent = scriptContent.replace(/import\s+\*\s+as\s+(.*?)\s+from\s+['"](.*?)['"]/g, "var $1 = require(\"$2\")");
  scriptContent = scriptContent.replace(/import\s+(.*?)\s+from\s+['"](.*?)['"]/g, "var $1 = require(\"$2\")");
  
  const fileDir = path.dirname(filePath);
  
  const prelude = `
    var console = { log: () => {}, warn: () => {}, error: () => {} };
    var FRAME_PER_SECOND = 15;
    var STYLE = { NIGE: 1, SENKOU: 2, SASHI: 3, OIKOMI: 4, OONIGE: 5 };
    var RCP = {};
    var TrackData = ${fs.readFileSync(path.join(__dirname, "uma-clock-emu-source/src/components/data/course_data.json"), "utf8")};
    var RaceGraph = {};
  `;
  try {
    const fn = new Function("require", `${prelude}\n${scriptContent}`);
    return fn(function(modulePath) {
      try {
        if (modulePath.startsWith("@")) return {};
        if (modulePath.startsWith(".")) {
          return require(path.join(fileDir, modulePath));
        }
        return require(modulePath);
      } catch (e) {
        return {};
      }
    });
  } catch (e) {
    console.error(`Error parsing ${filePath}:`, e);
    scriptContent = scriptContent.replace(/mixins:\s*\[.*?\],/s, "");
    scriptContent = scriptContent.replace(/components:\s*\{.*?\},/s, "");
    const fn = new Function("require", `${prelude}\n${scriptContent}`);
    return fn(function(modulePath) {
      try {
        if (modulePath.startsWith("@")) return {};
        if (modulePath.startsWith(".")) {
          return require(path.join(fileDir, modulePath));
        }
        return require(modulePath);
      } catch (e) {
        return {};
      }
    });
  }
}

function mergeVueObjects(...objects) {
  const result = { data: {}, computed: {}, methods: {} };
  
  for (const obj of objects) {
    if (!obj) continue;
    if (obj.data) {
      const mockThis = { $t: (k) => k, $te: (k) => false };
      const dataObj = typeof obj.data === "function" ? obj.data.call(mockThis) : obj.data;
      Object.assign(result.data, dataObj);
    }
    if (obj.computed) Object.assign(result.computed, obj.computed);
    if (obj.methods) Object.assign(result.methods, obj.methods);
  }
  return result;
}

const corePath = path.join(__dirname, "uma-clock-emu-source/src/components/MixinRaceCore.vue");
const constsPath = path.join(__dirname, "uma-clock-emu-source/src/components/data/MixinConstants.vue");
const coursePath = path.join(__dirname, "uma-clock-emu-source/src/components/data/MixinCourseData.vue");
const posPath = path.join(__dirname, "uma-clock-emu-source/src/components/MixinPositionKeeping.vue");
const skillsPath = path.join(__dirname, "uma-clock-emu-source/src/components/data/MixinSkills.vue");

const coreObj = extractVueObject(corePath);
const constsObj = extractVueObject(constsPath);
const courseObj = extractVueObject(coursePath);
const posObj = extractVueObject(posPath);
const skillsObj = extractVueObject(skillsPath);

const merged = mergeVueObjects(constsObj, courseObj, posObj, skillsObj, coreObj);

merged.methods.$t = (k) => k;
merged.methods.$te = (k) => false;
const instance = { ...merged.data, ...merged.methods };

for (const [key, fn] of Object.entries(merged.computed)) {
  Object.defineProperty(instance, key, {
    get: fn.bind(instance),
    configurable: true,
  });
}

for (const [key, fn] of Object.entries(merged.methods)) {
  instance[key] = fn.bind(instance);
}

const TEST_CASES = [
  {
    name: "Tokyo 2000m Nige",
    status: { speed: 1200, stamina: 1000, power: 1000, guts: 1000, wisdom: 1000, condition: 2, style: 1, distanceFit: "A", surfaceFit: "A", styleFit: "A" },
    skills: [{id: "10011", level: 5}], // Some unique skill
    track: { location: "10006", course: "10604", surfaceCondition: "1" },
  },
  {
    name: "Nakayama 1200m Senkou",
    status: { speed: 1500, stamina: 600, power: 1200, guts: 800, wisdom: 900, condition: 4, style: 2, distanceFit: "S", surfaceFit: "A", styleFit: "A" },
    track: { location: "10005", course: "10501", surfaceCondition: "1" },
  },
  {
    name: "Kyoto 3200m Oikomi",
    status: { speed: 1000, stamina: 1500, power: 900, guts: 1200, wisdom: 1000, condition: 0, style: 4, distanceFit: "A", surfaceFit: "A", styleFit: "S" },
    track: { location: "10008", course: "10811", surfaceCondition: "1" },
  }
];

instance.passiveBonus = { speed: 0, stamina: 0, power: 0, guts: 0, wisdom: 0, temptationRate: 0 };
instance.skillActivateAdjustment = "expected";
instance.$refs = { executeBlock: { skillActivateAdjustment: "expected", epoch: 0 } };
instance.types = [];
instance.passiveBonusKeys = ["speed", "stamina", "power", "guts", "wisdom", "temptationRate"];
instance.operatingSkills = [];
instance.condCoef = { 0: 1.04, 1: 1.02, 2: 1, 3: 0.98, 4: 0.96 };
instance.fixRandom = false;
instance.useExpectedValue = true;
instance.oonige = false;
instance.emulations = [];
instance.updateChart = () => {};
instance.updateSelfSpeedChart = () => {};
instance.updateSpChart = () => {};

const allDumps = [];

console.log("Starting multiple simulation dumps...");
for (const tc of TEST_CASES) {
  try {
    instance.umaStatus = tc.status;
    instance.track = tc.track;
    if (tc.skills) {
      instance.selectedSkills = tc.skills;
    } else {
      instance.selectedSkills = [];
    }
    
    instance.resetRace();
    instance.modifiedCondition = tc.status.condition;
    instance.temptationSection = -1;
    instance.sp = instance.spMax;
    instance.isStartDash = true;
    instance.delayTime = 0.0;
    instance.sectionTargetSpeedRandoms = instance.initSectionTargetSpeedRandoms();
    
    
  if (tc.name === "Kyoto 3200m Oikomi") {
    const origProgress = instance.progressRace;
    instance.progressRace = function() {
      const maxEpoch = Math.ceil(this.courseLength * 15 * 1.5);
      for(let i=0; i<maxEpoch; i++) {
        if (this.position >= this.courseLength) break;
        this.progressEpoch();
        if (i >= 265 && i <= 275) {
           console.log('Frame ' + i + ': targetSpeed = ' + this.targetSpeed + ', section = ' + this.currentSection + ', pos = ' + this.position);
        }
        this.progressSelfSpeed();
        this.progressPosition();
        let consume = this.consumePerSecond(this.isStartDash ? this.currentSpeed : this.baseSpeed, this.currentSpeed, this.currentPhase) / 15.0;
        this.sp -= consume;
        this.frameElapsed++;
        if (this.currentPhase == 1 && this.getPhase() == 2) {
          this.spurtParameters = this.calcSpurtParameter(false);
        }
      }
    };
  }
  instance.progressRace();

    
    allDumps.push({
      name: tc.name,
      status: tc.status,
      track: {
        ...instance.trackDetail,
        surfaceCondition: Number(tc.track.surfaceCondition) - 1
      },
      params: {
        baseSpeed: instance.baseSpeed,
        spMax: instance.spMax,
        modifiedSpeed: instance.modifiedSpeed,
        modifiedStamina: instance.modifiedStamina,
        modifiedPower: instance.modifiedPower,
        modifiedGuts: instance.modifiedGuts,
        modifiedWisdom: instance.modifiedWisdom,
        v0: instance.v0,
        v1: instance.v1,
        v2: instance.v2,
        v3: instance.v3,
        vMin: instance.vMin,
        a0: instance.a0,
        a1: instance.a1,
        a2: instance.a2,
        a3: instance.a3,
        spurtSpCoef: instance.spurtSpCoef,
      },
      frames: instance.frames,
    });
    console.log(`Dump successful for ${tc.name}: ${instance.frames.length} frames.`);
  } catch (e) {
    console.error(`Simulation failed for ${tc.name}:`, e);
  }
}

fs.writeFileSync("dump.json", JSON.stringify(allDumps, null, 2));
console.log("All dumps saved to dump.json");
