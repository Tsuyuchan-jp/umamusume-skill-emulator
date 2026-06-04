export interface RaceCondition {
  locationId: string;
  courseId: string;
  surfaceCond: number;
  playerNum: number;
}

export interface ResultSummary {
  count: number;
  rate: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  avgStamina: number;
  maxStamina: number;
  minStamina: number;
  avgPosAdjust: number;
  staminaKeepRate: number;
  avgStaminaKeepDist: number;
  competeFightRate: number;
  avgCompeteFightTime: number;
}

export interface SimResultDump {
  iterations: number;
  summary: {
    all: ResultSummary;
    maxSpurt: ResultSummary;
    nonMaxSpurt: ResultSummary | null;
  };
  rawSample: any;
}

export interface UmaStatusData {
  name?: string;
  speed: number;
  stamina: number;
  power: number;
  guts: number;
  wisdom: number;
  strategy?: string;
  condition?: string;
  popularity?: number;
  gateNumber?: number;
  aptitudes: {
    turf: string;
    dirt: string;
    short: string;
    mile: string;
    medium: string;
    long: string;
    nige: string;
    senkou: string;
    sashi: string;
    oikomi: string;
  };
  skills: string[];
}

export interface RawSkillData {
  name: string;
  [key: string]: any;
}

export interface SimTab {
  id: string;
  title: string;
  umaData: UmaStatusData;
  raceCondition: RaceCondition;
  simResultDump: SimResultDump | null;
  baselineResult: SimResultDump | null;
  disabledSkills: string[];
  addedSkills?: string[];
  thumbnailUrl: string | null;
  isDuplicate?: boolean;
}
