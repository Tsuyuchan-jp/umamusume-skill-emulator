export interface BasicFactor {
  name: string;
  star_reasoning?: string;
  stars: number;
}

export interface WhiteFactor {
  name: string;
  star_reasoning?: string;
  stars: number;
}

export interface CharacterFactors {
  name: string;
  blue_factor: BasicFactor | null;
  red_factor: BasicFactor | null;
  green_factor: BasicFactor | null;
  white_factors: WhiteFactor[];
}

export interface FactorData {
  favorite_icon_id?: number;
  representative: CharacterFactors;
  parent1: CharacterFactors | null;
  parent2: CharacterFactors | null;
}

export interface UmaStatusData {
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
    // UI selections for the current race
    distanceFit?: string;
    surfaceFit?: string;
    styleFit?: string;
  };
  skills: string[];
}

export interface RawSkillData {
  name: string;
  [key: string]: any;
}
