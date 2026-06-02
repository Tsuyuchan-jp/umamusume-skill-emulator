// ウマ娘 物理シミュレーターコア
// uma-clock-emu (JS) の MixinRaceCore.vue / MixinConstants.vue をベースにTSへ移植

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
    let bonus = 0; // passiveBonus.speed
    const mod = CONSTANTS.surfaceSpeedModify[this.trackDetail.surface]?.[this.trackDetail.surfaceCondition] || 0;
    const ret = this.calcExceedStatus(this.umaStatus.speed) * this.getCondCoef() + mod + bonus;
    return ret > 0 ? ret : 1;
  }

  public calcModifiedStamina(): number {
    let bonus = 0; // passiveBonus.stamina
    return this.calcExceedStatus(this.umaStatus.stamina) * this.getCondCoef() + bonus;
  }

  public calcModifiedPower(): number {
    let bonus = 0; // passiveBonus.power
    const mod = CONSTANTS.surfacePowerModify[this.trackDetail.surface]?.[this.trackDetail.surfaceCondition] || 0;
    const ret = this.calcExceedStatus(this.umaStatus.power) * this.getCondCoef() + mod + bonus;
    return ret > 0 ? ret : 1;
  }

  public calcModifiedGuts(): number {
    let bonus = 0; // passiveBonus.guts
    return this.calcExceedStatus(this.umaStatus.guts) * this.getCondCoef() + bonus;
  }

  public calcModifiedWisdom(): number {
    let bonus = 0; // passiveBonus.wisdom
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
    return 0.85 * this.baseSpeed + 0.001 * Math.sqrt(this.modifiedGuts * 200);
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
  
  public get deceleration(): number {
    // 実際には sp <= 0 で -1.2 になるが、ここでは基本の減速度を返す (currentPhase に依存)
    return -1.0; 
  }
  
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
    const surfaceCond = this.trackDetail.surfaceCondition === 0 ? 1 : this.trackDetail.surfaceCondition; // JSのキーが1~4になっているため簡易フォールバック
    // 実際のJS版の surfaceCondition は 1: 良, 2: 稍重, 3: 重, 4: 不良 だと思われるので、呼び出し元で調整が必要。
    // 今回のTrackDetailでは 0: 良 と定義したが、spConsumptionCoef に合わせて補正
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
    
    // SPが足りない場合の処理
    const candidates = [];
    const totalConsumeV3 = this.calcRequiredSp(this.v3, position);
    const excessSp = sp - totalConsumeV3;
    if (excessSp < 0) {
      return {
        distance: 0,
        speed: this.v3,
        spDiff: isReCalc ? (currentSpurtParams ? currentSpurtParams.spDiff : 0) : (sp - totalConsume), // 元JSの実装に準拠
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
    
    // Excel比較用のため決定論的（期待値モード）にベストな候補を返す
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
}

