const fs = require('fs');
let code = fs.readFileSync('SkillManager_raw.js', 'utf8');

// remove imports
code = code.replace(/import.*?\n/g, '');
code = code.replace(/const SkillData = require.*?\n/g, '');

// Extract outside methods
let outsideMatch = code.match(/const effects.*?(?:function rewriteInheritValues[\s\S]*?\n\})/s);
let outsideCode = outsideMatch ? outsideMatch[0] : '';

// Extract methods block
let methodsIdx = code.indexOf('methods: {');
let methodsCode = code.substring(methodsIdx + 'methods: {'.length, code.lastIndexOf('}'));
// Remove the last `}` of the export default
methodsCode = methodsCode.substring(0, methodsCode.lastIndexOf('}'));

// Convert Vue methods to TypeScript class methods
// Only match lines starting with exactly 4 spaces, followed by word(args) {
methodsCode = methodsCode.replace(/^ {4}([\w]+)\((.*?)\)\s*\{/gm, '  public \$1(\$2): any {');

// Remove trailing commas after method blocks
methodsCode = methodsCode.replace(/\},\s*$/gm, '}');

const simVars = [
  'courseLength', 'position', 'sp', 'currentSpeed', 'spMax', 'frameElapsed',
  'timeCoef', 'currentPhase', 'spurtParameters', 'basicRunningStyle',
  'trackDetail', 'track', 'distanceType', 'passiveBonus',
  'skillActivateAdjustment', 'randomPosition', 'emulations', 'executeBlock',
  'vMin', 'umaStatus', 'startDelay', 'temptationSection', 'phase'
];

for (const v of simVars) {
  const regex = new RegExp(`this\\.${v}\\b`, 'g');
  methodsCode = methodsCode.replace(regex, `this.sim.${v}`);
}

const simMethods = [
  'calcSpurtParameter', 'cornerEnd', 'isInCorner', 'getStraightFrontType',
  'isInStraight', 'isInFinalCorner', 'isInFinalStraight', 'isContainsRemainingDistance',
  'isInDistanceRate', 'isInLaterHalf', 'isInInterval', 'getSlopes', 'getStraights', 'isInSlope', 'toPosition', 'accTimePassed', 'isRunningStyle', 'isDistanceType', 'isGroundType', 'isRotation', 'isTrackId', 'isBasisDistance', 'isGroundCondition'
];
for (const v of simMethods) {
  const regex = new RegExp(`this\\.${v}\\(`, 'g');
  methodsCode = methodsCode.replace(regex, `this.sim.${v}(`);
}

methodsCode = methodsCode.replace(/const thiz = this;/g, 'const thiz = this.sim;');

let tsClass = `
import type { RaceSimulator } from './RaceSimulator';
import { normalSkillData, uniqueSkillData } from './data/skillData';
import * as RCP from './data/release_conserve_power_constants';

${outsideCode}

export class SkillManager {
  public sim: RaceSimulator;
  public normalSkillData: any[];
  public uniqueSkillData: any[];
  public skills: any[] = [];
  public effects: string[] = [
    "heal", "targetSpeed", "acceleration", "speed", "speedWithDecel", 
    "fatigue", "passiveSpeed", "passiveStamina", "passivePower", 
    "passiveGuts", "passiveWisdom", "temptationRate", "startDelay"
  ];
  public hasSkills: any = {};
  public hasEvoSkills: any[] = [];
  public operatingSkills: any[] = [];
  public coolDownMap: any = {};
  public healTriggerCount: number = 0;
  public types: string[] = ['passive', 'heal', 'speed', 'acceleration', 'composite', 'gate', 'decel', 'fatigue'];
  public raritySections: string[] = ['rare', 'normal', 'inherit', 'all'];
  public skillTriggerCount: any = {};
  public passiveTriggered: number = 0;
  public invokedSkills: any[] = [];
  public oonige: boolean = false;
  public production: boolean = true;
  public selectedUnique: string = '';
  public uniqueSkillFilterQuery: string = '';
  public uniqueLevel: number = 4;
  public emulatorType: string = '';
  
  // mock for translations
  public $t(key: string) { return key; }
  public $te(key: string) { return false; }
  
  constructor(sim: RaceSimulator) {
    this.sim = sim;
    this.normalSkillData = normalSkillData(sim);
    this.uniqueSkillData = uniqueSkillData(sim);
    this.buildSkillData();
  }

  ${methodsCode}
}
`;

fs.writeFileSync('webapp/src/engine/SkillManager.ts', tsClass);
