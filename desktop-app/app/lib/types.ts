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

/** WASM runSimulationDetail の1フレーム */
export interface RaceFrameDump {
  speed: number;
  sp: number;
  startPosition: number;
  currentLane: number;
}

/** コース区間（直線・コーナー・坂）— WASM trackDetail 出力 */
export interface TrackSectionDump {
  start: number;
  end: number;
}

export interface TrackSlopeDump extends TrackSectionDump {
  slope: number;
}

export interface TrackDetailDump {
  straights: TrackSectionDump[];
  corners: TrackSectionDump[];
  slopes: TrackSlopeDump[];
}

/** 直近1走の詳細データ（グラフ用） */
export interface RaceDetailDump {
  summary: {
    raceTime: number;
    raceTimeDelta: number;
    raceTimeWithoutRunUp: number;
    maxSpurt: boolean;
    spDiff: number;
    positionCompetitionCount: number;
    staminaKeepDistance: number;
    competeFightFinished: boolean;
    competeFightTime: number;
  };
  frames: RaceFrameDump[];
  courseLength: number;
  phase1Start: number;
  phase2Start: number;
  gateCount: number;
  initialLaneAdjuster: number;
  trackDetail?: TrackDetailDump;
}

export interface SimResultDump {
  iterations: number;
  summary: {
    all: ResultSummary;
    maxSpurt: ResultSummary;
    nonMaxSpurt: ResultSummary | null;
  };
  rawSample: any;
  raceDetail?: RaceDetailDump | null;
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
  skillIds: string[];
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
  disabledSkillIds: string[];
  addedSkillIds?: string[];
  appliedDisabledSkillIds?: string[];
  appliedAddedSkillIds?: string[];
  thumbnailUrl: string | null;
  isDuplicate?: boolean;
}
