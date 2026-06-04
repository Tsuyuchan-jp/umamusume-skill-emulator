/* eslint-disable @typescript-eslint/no-explicit-any, no-useless-assignment, no-case-declarations */
// ウマ娘 物理シミュレーターコア
// uma-clock-emu (JS) の MixinRaceCore.vue / MixinConstants.vue をベースにTSへ移植

import { SkillManager } from './SkillManager';

export interface UmaStatus {
  speed: number;
  stamina: number;
  power: number;
  guts: number;
  wisdom: number;
  condition: number; // 0: 絶好調, 1: 好調, 2: 普通, 3: 不調, 4: 絶不調
  style: number; // 1: 逃げ, 2: 先行, 3: 差し, 4: 追込, 5: 大逃げ (STYLE.OONIGE)
  distanceFit: string; // S, A, B, C, D, E, F, G
  surfaceFit: string;
  styleFit: string;
}

export interface TrackDetail {
  distance: number;
  surface: number; // 1: 芝, 2: ダート
  surfaceCondition: number; // 0: 良, 1: 稍重, 2: 重, 3: 不良
  courseSetStatus: number[]; // 特定ステータスによる補正(緑スキル等ではないコース自体の仕様)
  corners: { start: number, length: number }[];
  straights: { start: number, end: number }[];
  slopes: { start: number, length: number, slope: number }[];
}

// 物理定数群
export const CONSTANTS = {
  frameLength: 1.0 / 15.0,
  startSpeed: 3.0,
  condCoef: {
    0: 1.04,
    1: 1.02,
    2: 1.0,
    3: 0.98,
    4: 0.96,
  } as Record<number, number>,
  styleFitCoef: { S: 1.1, A: 1, B: 0.85, C: 0.75, D: 0.6, E: 0.4, F: 0.2, G: 0.1 } as Record<string, number>,
  distanceFitSpeedCoef: { S: 1.05, A: 1, B: 0.9, C: 0.8, D: 0.6, E: 0.4, F: 0.2, G: 0.1 } as Record<string, number>,
  distanceFitAccelerateCoef: { S: 1, A: 1, B: 1, C: 1, D: 1, E: 0.6, F: 0.5, G: 0.4 } as Record<string, number>,
  surfaceFitAccelerateCoef: { S: 1.05, A: 1, B: 0.9, C: 0.8, D: 0.7, E: 0.5, F: 0.3, G: 0.1 } as Record<string, number>,
  styleSpCoef: {
    1: 0.95,
    2: 0.89,
    3: 1,
    4: 0.995,
    5: 0.86,
  } as Record<number, number>,
  styleSpeedCoef: {
    1: { 0: 1, 1: 0.98, 2: 0.962 },
    2: { 0: 0.978, 1: 0.991, 2: 0.975 },
    3: { 0: 0.938, 1: 0.998, 2: 0.994 },
    4: { 0: 0.931, 1: 1, 2: 1 },
    5: { 0: 1.063, 1: 0.962, 2: 0.95 },
  } as Record<number, Record<number, number>>,
  styleAccelerateCoef: {
    1: { 0: 1, 1: 1, 2: 0.996, 3: 0.996 },
    2: { 0: 0.985, 1: 1, 2: 0.996, 3: 0.996 },
    3: { 0: 0.975, 1: 1, 2: 1, 3: 1 },
    4: { 0: 0.945, 1: 1, 2: 0.997, 3: 0.997 },
    5: { 0: 1.17, 1: 0.94, 2: 0.956, 3: 0.956 },
  } as Record<number, Record<number, number>>,
  surfaceSpeedModify: {
    1: { 0: 0, 1: 0, 2: 0, 3: 0, 4: -50 },
    2: { 0: 0, 1: 0, 2: 0, 3: 0, 4: -50 },
  } as Record<number, Record<number, number>>,
  surfacePowerModify: {
    1: { 0: 0, 1: 0, 2: -50, 3: -50, 4: -50 },
    2: { 0: -100, 1: -100, 2: -50, 3: -100, 4: -100 },
  } as Record<number, Record<number, number>>,
  spConsumptionCoef: {
    1: { 1: 1, 2: 1, 3: 1.02, 4: 1.02 },
    2: { 1: 1, 2: 1, 3: 1.01, 4: 1.02 },
  } as Record<number, Record<number, number>>,
};

export interface SpurtParameter {
  distance: number;
  speed: number;
  spDiff: number;
  maxSpurt: boolean;
}

export interface RaceFrame {
  speed: number;
  sp: number;
  startPosition: number;
  movement: number;
  consume: number;
  skills?: any[];
  spurting?: boolean;
}

export class RaceSimulator {
  public umaStatus: UmaStatus;
  public trackDetail: TrackDetail;
  
  public baseSpeed: number;
  public modifiedSpeed: number;
  public modifiedStamina: number;
  public modifiedPower: number;
  public modifiedGuts: number;
  public modifiedWisdom: number;
  
  public spMax: number;

  // --- 走行状態 ---
  public frameElapsed: number = 0;
  public position: number = 0;
  public downSlopeModeStart: number | null = null;
  public sp: number = 0;
  public currentSpeed: number = 0;
  public isStartDash: boolean = false;
  public delayTime: number = 0;
  public spurtParameters: SpurtParameter | null = null;
  public maxSpurt: boolean = false;
  public frames: RaceFrame[] = [];
  public skillManager: SkillManager;
  public skillActivateAdjustment: string = 'expected';
  public oonige: boolean = false;
  public fixRandom: boolean = false;
  public useExpectedValue: boolean = false;

  public sectionTargetSpeedRandoms: Record<number, number> = {};

  constructor(umaStatus: UmaStatus, trackDetail: TrackDetail) {
    this.umaStatus = umaStatus;
    this.trackDetail = trackDetail;
    
    this.baseSpeed = this.calcBaseSpeed();
    
    // 補正済みステータスの計算
    this.modifiedSpeed = this.calcModifiedSpeed();
    this.modifiedStamina = this.calcModifiedStamina();
    this.modifiedPower = this.calcModifiedPower();
    this.modifiedGuts = this.calcModifiedGuts();
    this.modifiedWisdom = this.calcModifiedWisdom();
    
    this.spMax = this.calcSpMax();
    this.skillManager = new SkillManager(this);
  }

  public calcExceedStatus(status: number): number {
    return status > 1200 ? 1200 + (status - 1200) / 2 : status;
  }

  public calcBaseSpeed(): number {
    return 20.0 - (this.trackDetail.distance - 2000.0) / 1000.0;
  }
  
  private getCondCoef(): number {
    return CONSTANTS.condCoef[this.umaStatus.condition] ?? 1.0;
  }

  public calcModifiedSpeed(): number {
    // TODO: CourseSetStatus (コースによるステータス補正) は省略あるいは後日実装
    const bonus = 0; // passiveBonus.speed
    const mod = CONSTANTS.surfaceSpeedModify[this.trackDetail.surface]?.[this.trackDetail.surfaceCondition] || 0;
    const ret = this.calcExceedStatus(this.umaStatus.speed) * this.getCondCoef() + mod + bonus;
    return ret > 0 ? ret : 1;
  }

  public calcModifiedStamina(): number {
    const bonus = 0; // passiveBonus.stamina
    return this.calcExceedStatus(this.umaStatus.stamina) * this.getCondCoef() + bonus;
  }

  public calcModifiedPower(): number {
    const bonus = 0; // passiveBonus.power
    const mod = CONSTANTS.surfacePowerModify[this.trackDetail.surface]?.[this.trackDetail.surfaceCondition] || 0;
    const ret = this.calcExceedStatus(this.umaStatus.power) * this.getCondCoef() + mod + bonus;
    return ret > 0 ? ret : 1;
  }

  public calcModifiedGuts(): number {
    const bonus = 0; // passiveBonus.guts
    return this.calcExceedStatus(this.umaStatus.guts) * this.getCondCoef() + bonus;
  }

  public calcModifiedWisdom(): number {
    const bonus = 0; // passiveBonus.wisdom
    const styleFit = CONSTANTS.styleFitCoef[this.umaStatus.styleFit] || 1;
    return this.calcExceedStatus(this.umaStatus.wisdom) * this.getCondCoef() * styleFit + bonus;
  }

  public calcSpMax(): number {
    const styleCoef = CONSTANTS.styleSpCoef[this.umaStatus.style] || 1;
    return this.trackDetail.distance + 0.8 * this.modifiedStamina * styleCoef;
  }

  // --- 目標速度群 ---
  
  public get v0(): number {
    return 0.85 * this.baseSpeed;
  }

  public get v1(): number {
    return this.baseSpeed * CONSTANTS.styleSpeedCoef[this.umaStatus.style][0];
  }

  public get v2(): number {
    return this.baseSpeed * CONSTANTS.styleSpeedCoef[this.umaStatus.style][1];
  }

  public get v3(): number {
    const distanceFit = CONSTANTS.distanceFitSpeedCoef[this.umaStatus.distanceFit] || 1;
    return this.baseSpeed * CONSTANTS.styleSpeedCoef[this.umaStatus.style][2] 
           + Math.sqrt(this.modifiedSpeed / 500) * distanceFit;
  }

  public get vMin(): number {
    if (this.isStartDash) return CONSTANTS.startSpeed;
    return this.baseSpeed * 0.85 + Math.sqrt(this.modifiedGuts * 200.0) * 0.001;
  }

  // --- 加速度群 ---
  private calcBaseAccel(): number {
    const surfaceFit = CONSTANTS.surfaceFitAccelerateCoef[this.umaStatus.surfaceFit] || 1;
    const distanceFit = CONSTANTS.distanceFitAccelerateCoef[this.umaStatus.distanceFit] || 1;
    return 0.0006 * Math.sqrt(500 * this.modifiedPower) * surfaceFit * distanceFit;
  }

  public get a0(): number {
    return 24 + this.calcBaseAccel() * CONSTANTS.styleAccelerateCoef[this.umaStatus.style][0];
  }

  public get a1(): number {
    return this.calcBaseAccel() * CONSTANTS.styleAccelerateCoef[this.umaStatus.style][0];
  }

  public get a2(): number {
    if (this.v2 < this.v1) {
      return -0.8;
    }
    return this.calcBaseAccel() * CONSTANTS.styleAccelerateCoef[this.umaStatus.style][1];
  }

  public get a3(): number {
    return this.calcBaseAccel() * CONSTANTS.styleAccelerateCoef[this.umaStatus.style][2];
  }

  // --- ヘルパー群 ---
  
  public get currentPhase(): number {
    return this.getPhase(this.position);
  }

  public get currentSection(): number {
    return Math.floor(this.position / (this.trackDetail.distance / 24));
  }

  public initSectionTargetSpeedRandoms(): Record<number, number> {
    const ret: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      const max = (this.modifiedWisdom / 5500.0) * Math.log10(this.modifiedWisdom * 0.1) * 0.01;
      if (this.fixRandom || this.useExpectedValue) {
        ret[i] = max - 0.00325;
      } else {
        ret[i] = max + Math.random() * -0.0065;
      }
    }
    return ret;
  }

  public get deceleration(): number {
    if (this.sp <= 0) return -1.2;
    switch (this.currentPhase) {
      case 0: return -1.2;
      case 1: return -0.8;
      case 2:
      case 3:
      default: return -1.0;
    }
  }

  public get expectedDownSlopeCoef(): number {
    return 4.0 / (4.0 + 1.0 / (this.modifiedWisdom * 0.0004));
  }

  // ------------------------------------------------------------------------
  // コース形状判定ヘルパー
  // ------------------------------------------------------------------------
  public cornerEnd(corner: { start: number, length: number }): number {
    return corner.start + corner.length;
  }

  public toPosition(remain: number): number {
    return this.trackDetail.distance - remain;
  }

  public isInCorner(position?: number, cornerNumber?: number, interval?: {start: number, end: number}): boolean {
    if (position === undefined) position = this.position;
    for (let i = 0; i < this.trackDetail.corners.length; i++) {
      const corner = this.trackDetail.corners[i];
      const start = interval ? corner.start + interval.start * corner.length : corner.start;
      const end = interval ? corner.start + interval.end * corner.length : this.cornerEnd(corner);
      if (position >= start && position <= end) {
        if (cornerNumber) {
          // cornerNumber: 1(第1), 2(第2), 3(第3), 4(第4)
          // 4つのコーナーがある場合、後ろから数えて合致するか（元の実装に準拠）
          // i == length + cornerNumber - 5
          return i === this.trackDetail.corners.length + cornerNumber - 5;
        }
        return true;
      }
    }
    return false;
  }

  public getStraightFrontType(position?: number): number {
    if (position === undefined) position = this.position;
    for (let i = 0; i < this.trackDetail.straights.length; i++) {
      const straight = this.trackDetail.straights[i];
      if (position >= straight.start && position <= straight.end) {
        const rIndex = this.trackDetail.straights.length - i;
        return rIndex % 2 === 1 ? 1 : 2;
      }
    }
    return 0;
  }

  public isInStraight(position?: number): boolean {
    if (position === undefined) position = this.position;
    for (const straight of this.trackDetail.straights) {
      if (position >= straight.start && position <= straight.end) {
        return true;
      }
    }
    return false;
  }

  public isInFinalCorner(position?: number, interval?: {start: number, end: number}): boolean {
    if (position === undefined) position = this.position;
    const corners = this.trackDetail.corners;
    if (corners.length === 0) return false;
    const fc = corners[corners.length - 1];
    const startRate = interval ? interval.start : 0;
    const endRate = interval ? interval.end : 1;
    const start = fc.start + startRate * fc.length;
    const end = fc.start + endRate * fc.length;
    return position >= start && position <= end;
  }

  public isInFinalStraight(position?: number): boolean {
    if (position === undefined) position = this.position;
    const straights = this.trackDetail.straights;
    if (straights.length === 0) return false;
    const lastStraight = straights[straights.length - 1];
    return position >= lastStraight.start;
  }

  public isContainsRemainingDistance(remain: number, startPosition: number): boolean {
    return startPosition <= this.toPosition(remain) && this.position >= this.toPosition(remain);
  }

  public isInDistanceRate(startRate: number, endRate: number): boolean {
    return this.position >= this.trackDetail.distance * startRate && this.position <= this.trackDetail.distance * endRate;
  }

  public isInLaterHalf(): boolean {
    return this.position > this.trackDetail.distance / 2;
  }

  public isInInterval(start: number, end: number): boolean {
    return this.position >= this.trackDetail.distance * start && this.position <= this.trackDetail.distance * end;
  }

  public getSlopes(): {start: number, length: number, slope: number}[] {
    return this.trackDetail.slopes || [];
  }

  public getStraights(): {start: number, end: number}[] {
    return this.trackDetail.straights || [];
  }

  public isInSlope(dir: string): boolean {
    const slopes = this.getSlopes();
    for (const s of slopes) {
      if (this.position >= s.start && this.position <= s.start + s.length) {
        if (dir === 'up' && s.slope > 0) return true;
        if (dir === 'down' && s.slope < 0) return true;
        if (dir === '') return true;
      }
    }
    return false;
  }

  public getSlope(position: number): number {
    for (const slope of this.trackDetail.slopes) {
      if (position >= slope.start && position < slope.start + slope.length) {
        return slope.slope / 10000.0;
      }
    }
    return 0;
  }

  public isRunningStyle(styleId: number): boolean {
    return this.umaStatus.style === styleId;
  }

  // ------------------------------------------------------------------------
  
  public getPhase(position: number): number {
    if (position < this.trackDetail.distance / 6.0) return 0;
    else if (position < (this.trackDetail.distance * 2.0) / 3.0) return 1;
    else if (position < (this.trackDetail.distance * 5.0) / 6.0) return 2;
    else return 3;
  }
  
  public getSection(position: number): number {
    return Math.floor((position * 24.0) / this.trackDetail.distance);
  }

  public calcMaxSpurtSpeed(): number {
    const styleSpeed = CONSTANTS.styleSpeedCoef[this.umaStatus.style][2] + 0.01;
    const distanceFit = CONSTANTS.distanceFitSpeedCoef[this.umaStatus.distanceFit] || 1;
    
    return (
      (this.baseSpeed * styleSpeed + Math.sqrt(this.modifiedSpeed / 500) * distanceFit) * 1.05 +
      Math.sqrt(500 * this.modifiedSpeed) * distanceFit * 0.002 +
      Math.pow(450 * this.modifiedGuts, 0.597) * 0.0001
    );
  }

  public get spurtSpCoef(): number {
    return 1.0 + 200.0 / Math.sqrt(600.0 * this.modifiedGuts);
  }

  public consumePerSecond(baseSpeed: number, v: number, phase: number): number {
    const condKey = this.trackDetail.surfaceCondition + 1; 

    let ret = 
      (20.0 * CONSTANTS.spConsumptionCoef[this.trackDetail.surface]?.[condKey] * Math.pow(v - baseSpeed + 12.0, 2)) / 144.0;
    
    if (phase >= 2) {
      ret *= this.spurtSpCoef;
    }
    return ret;
  }

  public calcRequiredSp(v: number, position: number): number {
    const condKey = this.trackDetail.surfaceCondition + 1;
    const spCoef = CONSTANTS.spConsumptionCoef[this.trackDetail.surface]?.[condKey] || 1;
    const remainingDistance = this.trackDetail.distance - position - 60.0;
    
    const term1 = (remainingDistance * 20.0 * spCoef * this.spurtSpCoef * Math.pow(this.v3 - this.baseSpeed + 12.0, 2)) / 144.0 / this.v3;
    const term2 = remainingDistance * (20.0 * spCoef * this.spurtSpCoef * (
      Math.pow(v - this.baseSpeed + 12.0, 2) / 144.0 / v - Math.pow(this.v3 - this.baseSpeed + 12.0, 2) / 144.0 / this.v3
    ));
    return term1 + term2;
  }

  public calcSpurtDistance(v: number, position: number, sp: number): number {
    const condKey = this.trackDetail.surfaceCondition + 1;
    const spCoef = CONSTANTS.spConsumptionCoef[this.trackDetail.surface]?.[condKey] || 1;
    const remainingDistance = this.trackDetail.distance - position - 60.0;

    const numerator = sp - (remainingDistance * 20.0 * spCoef * this.spurtSpCoef * Math.pow(this.v3 - this.baseSpeed + 12.0, 2)) / 144.0 / this.v3;
    const denominator = 20.0 * spCoef * this.spurtSpCoef * (
      Math.pow(v - this.baseSpeed + 12.0, 2) / 144.0 / v - Math.pow(this.v3 - this.baseSpeed + 12.0, 2) / 144.0 / this.v3
    );
    return (numerator / denominator) + 60.0;
  }

  public calcSpurtParameter(isReCalc: boolean, position: number, sp: number, currentSpurtParams: any = null): any {
    const maxDistance = this.trackDetail.distance - position;
    const maxSpurtSpeed = this.calcMaxSpurtSpeed();
    const spurtDistance = this.calcSpurtDistance(maxSpurtSpeed, position, sp);
    const totalConsume = this.calcRequiredSp(maxSpurtSpeed, position);
    
    let maxSpurt = false;
    
    if (spurtDistance >= maxDistance) {
      if (position <= (this.trackDetail.distance * 2.0) / 3.0 + 5.0) {
        if (!isReCalc) {
          maxSpurt = true;
        }
      }
      return {
        distance: maxDistance,
        speed: maxSpurtSpeed,
        spDiff: isReCalc ? (currentSpurtParams ? currentSpurtParams.spDiff : 0) : (sp - totalConsume),
        maxSpurt
      };
    }
    
    const candidates = [];
    const totalConsumeV3 = this.calcRequiredSp(this.v3, position);
    const excessSp = sp - totalConsumeV3;
    if (excessSp < 0) {
      return {
        distance: 0,
        speed: this.v3,
        spDiff: isReCalc ? (currentSpurtParams ? currentSpurtParams.spDiff : 0) : (sp - totalConsume), 
        maxSpurt: false
      };
    }
    
    for (let v = maxSpurtSpeed - 0.1; v >= this.v3; v -= 0.1) {
      let distanceV = this.calcSpurtDistance(v, position, sp);
      if (distanceV >= maxDistance) {
        distanceV = maxDistance;
      }
      candidates.push({
        distance: distanceV,
        speed: v,
        time: distanceV / v + (maxDistance - distanceV) / this.v3,
        spDiff: isReCalc ? (currentSpurtParams ? currentSpurtParams.spDiff : 0) : (sp - totalConsume)
      });
    }
    
    candidates.sort((a, b) => a.time - b.time);
    
    if (candidates.length > 0) {
      return { ...candidates[0], maxSpurt: false };
    }
    
    return {
      distance: 0,
      speed: this.v3,
      spDiff: sp - totalConsume,
      maxSpurt: false
    };
  }

  // --- シミュレーションループ ---

  public progressEpoch(): void {
    // 坂下りモード判定
    const enterDownSlopeModeProbability = this.modifiedWisdom * 0.0004;
    const timeElapsed = this.frameElapsed * (1.0 / 15.0);
    const frameContainsRoundSecond =
      Math.floor(timeElapsed * 15) !== Math.floor((timeElapsed + 1/15) * 15);

    if (this.fixRandom || !this.isInSlope("down")) {
      this.downSlopeModeStart = null;
    } else if (this.useExpectedValue) {
      if (this.downSlopeModeStart == null) {
        this.downSlopeModeStart = timeElapsed;
      }
    } else if (!this.useExpectedValue && frameContainsRoundSecond) {
      if (this.downSlopeModeStart == null) {
        if (Math.random() < enterDownSlopeModeProbability) {
          this.downSlopeModeStart = timeElapsed;
        }
      } else {
        if (Math.random() < 0.2) {
          this.downSlopeModeStart = null;
        }
      }
    }
  }

  public calcPhaseTargetSpeed(phase: number): number {
    let baseTargetSpeed = 0;
    if (this.spurtParameters && this.position + this.spurtParameters.distance >= this.trackDetail.distance) {
      return this.spurtParameters.speed;
    } else {
      switch (phase) {
        case 0:
        case 1:
          baseTargetSpeed = this.baseSpeed * CONSTANTS.styleSpeedCoef[this.umaStatus.style][phase];
          break;
        case 2:
        case 3:
        default:
          const distanceFit = CONSTANTS.distanceFitSpeedCoef[this.umaStatus.distanceFit] || 1;
          baseTargetSpeed = this.baseSpeed * CONSTANTS.styleSpeedCoef[this.umaStatus.style][2] + Math.sqrt(this.modifiedSpeed / 500.0) * distanceFit;
          baseTargetSpeed += Math.pow(this.modifiedGuts * 450, 0.597) * 0.0001;
          break;
      }
      baseTargetSpeed += this.baseSpeed * (this.sectionTargetSpeedRandoms[this.currentSection] || 0);
      return baseTargetSpeed;
    }
  }

  public get targetSpeed(): number {
    if (this.sp <= 0) {
      return this.vMin;
    }
    if (this.currentSpeed < this.v0) {
      return this.v0;
    }

    let ret = this.calcPhaseTargetSpeed(this.currentPhase);

    // 坂の補正
    if (this.isInSlope('up')) {
      ret -= (Math.abs(this.getSlope(this.position)) * 200.0) / this.modifiedPower;
    } else if (this.isInSlope('down')) {
      if (this.downSlopeModeStart !== null) {
        if (this.useExpectedValue) {
          ret += (Math.abs(this.getSlope(this.position)) / 10.0 + 0.3) * this.expectedDownSlopeCoef;
        } else {
          ret += Math.abs(this.getSlope(this.position)) / 10.0 + 0.3;
        }
      }
    }

    // 持続中スキル
    for (const skill of this.skillManager.operatingSkills) {
      if (skill.data.targetSpeed) {
        ret += skill.data.targetSpeed;
      }
      if (skill.data.speedWithDecel) {
        ret += skill.data.speedWithDecel;
      }
      if (skill.data.speed) {
        ret += skill.data.speed;
      }
    }
    return ret;
  }

  public get acceleration(): number {
    const c = this.isInSlope('up') ? 0.0004 : 0.0006;
    let ret = c * Math.sqrt(500 * this.modifiedPower) * CONSTANTS.styleAccelerateCoef[this.umaStatus.style][this.currentPhase] * (CONSTANTS.surfaceFitAccelerateCoef[this.umaStatus.surfaceFit] || 1) * (CONSTANTS.distanceFitAccelerateCoef[this.umaStatus.distanceFit] || 1);
    
    if (this.isStartDash) {
      ret += 24.0;
    }
    for (const skill of this.skillManager.operatingSkills) {
      if (skill.data.acceleration) {
        ret += skill.data.acceleration;
      }
    }
    return ret;
  }

  public updateSelfSpeed(elapsedTime: number): void {
    let newSpeed = 0;
    const tgt = this.targetSpeed;
    if (this.currentSpeed < tgt) {
      newSpeed = Math.min(this.currentSpeed + elapsedTime * this.acceleration, tgt);
    } else {
      newSpeed = Math.max(this.currentSpeed + elapsedTime * this.deceleration, tgt);
    }
    
    if (this.isStartDash && newSpeed > this.v0) {
      newSpeed = this.v0;
    }
    const maxSpeed = 30.0;
    newSpeed = Math.max(Math.min(newSpeed, maxSpeed), this.vMin);
    this.currentSpeed = newSpeed;
  }

  public move(elapsedTime: number): void {
    if (this.delayTime > 0) {
      this.delayTime -= elapsedTime;
    }
    if (this.delayTime <= 0) {
      let timeAfterDelay = elapsedTime;
      if (this.delayTime < 0) {
        timeAfterDelay = Math.abs(this.delayTime);
        this.delayTime = 0;
      }

      this.updateSelfSpeed(elapsedTime);
      const actualSpeed = this.currentSpeed;
      
      this.position += actualSpeed * timeAfterDelay;
      
      const bSpeed = this.isStartDash ? this.currentSpeed : this.baseSpeed;
      const consume = this.consumePerSecond(bSpeed, this.currentSpeed, this.currentPhase) * elapsedTime;
      
      this.sp -= consume;
      
      if (this.isStartDash && this.currentSpeed >= this.v0) {
        this.isStartDash = false;
      }
    }
  }

  public simulateRace(): void {
    this.frameElapsed = 0;
    this.sp = this.spMax;
    this.position = 0;
    this.currentSpeed = CONSTANTS.startSpeed;
    this.frames = [];
    this.spurtParameters = null;
    this.downSlopeModeStart = null;
    this.sectionTargetSpeedRandoms = {};
    
    this.delayTime = 0.0; 
    this.isStartDash = true;
    
    // レース開始前のスキル判定
    this.skillManager.invokeSkills(this.skillActivateAdjustment);
    this.skillManager.triggerStartSkills();
    this.skillManager.initSystematicSkills();

    this.sectionTargetSpeedRandoms = this.initSectionTargetSpeedRandoms();

    while (this.position < this.trackDetail.distance) {
      if (this.frameElapsed > 5000) break;
      
      this.progressEpoch();
      
      const startPosition = this.position;
      const startSp = this.sp;
      const startPhase = this.currentPhase;
      const spurting = this.spurtParameters !== null && this.position + this.spurtParameters.distance >= this.trackDetail.distance;
      
      const skillTriggered: any[] = [];
      skillTriggered.push(...this.skillManager.checkSkillTrigger(this.position));
      
      const frame: RaceFrame = {
        skills: skillTriggered,
        spurting: spurting,
        speed: this.currentSpeed,
        sp: this.sp,
        startPosition: startPosition,
        movement: 0,
        consume: 0
      };
      
      for (let i = 0; i < this.skillManager.operatingSkills.length; i++) {
        const operatingSkill = this.skillManager.operatingSkills[i];
        const duration = operatingSkill.data.durationOverwrite ?? operatingSkill.data.duration;
        if ((this.frameElapsed - operatingSkill.startFrame) * (1 / 15.0) > duration * this.trackDetail.distance / 1000.0) {
          this.skillManager.operatingSkills.splice(i, 1);
          i--;
          break;
        }
      }
      
      this.move(CONSTANTS.frameLength);
      
      frame.movement = this.position - startPosition;
      frame.consume = startSp - this.sp;
      this.frames.push(frame);
      
      this.frameElapsed++;
      
      const newPhase = this.getPhase(this.position);
      if (startPhase === 1 && newPhase === 2) {
        this.spurtParameters = this.calcSpurtParameter(false, this.position, this.sp);
      }
    }
  }
}

