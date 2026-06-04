
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
  raceCondition: any; // RaceCondition from components
  simResultDump: any;
  baselineResult: any;
  disabledSkills: string[];
  thumbnailUrl: string | null;
  isDuplicate?: boolean;
}
