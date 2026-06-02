// ウマ娘 物理シミュレーターコア
// uma-clock-emu (JS) の MixinRaceCore.vue をベースにTSへ移植

export interface UmaStatus {
  speed: number;
  stamina: number;
  power: number;
  guts: number;
  wisdom: number;
  condition: number; // 0: 絶不調, 1: 不調, 2: 普通, 3: 好調, 4: 絶好調
  style: number; // 1: 逃げ, 2: 先行, 3: 差し, 4: 追込
  distanceFit: string; // S, A, B, C, D, E, F, G
  surfaceFit: string;
  styleFit: string;
}

export interface TrackDetail {
  distance: number;
  surface: number; // 1: 芝, 2: ダート
  courseSetStatus: number[];
}

export class RaceSimulator {
  public umaStatus: UmaStatus;
  public trackDetail: TrackDetail;
  public frameLength = 1 / 15; // 15 fps => 1フレーム 約0.0667秒
  public baseSpeed: number;

  constructor(umaStatus: UmaStatus, trackDetail: TrackDetail) {
    this.umaStatus = umaStatus;
    this.trackDetail = trackDetail;
    this.baseSpeed = this.calcBaseSpeed();
  }

  /**
   * ステータス上限補正 (1200を超える場合の補正)
   */
  public calcExceedStatus(status: number): number {
    return status > 1200 ? 1200 + (status - 1200) / 2 : status;
  }

  /**
   * 基準速度計算
   * 20 - (コース距離 - 2000) / 1000
   */
  public calcBaseSpeed(): number {
    return 20.0 - (this.trackDetail.distance - 2000.0) / 1000.0;
  }

  // TODO: フェーズごとの速度係数、各種ステータス補正値（condCoef等）の実装
}
