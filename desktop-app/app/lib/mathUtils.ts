import { UmaStatusData, RaceCondition } from "./types";
import { getCourseById } from "./aptitudeHelper";

/**
 * タイム差分をバ身差に変換する
 * @param timeDiff タイム差分 (秒)
 * @param spurtTargetSpeed スパート目標速度 (m/s)
 * @returns バ身差
 */
export function calculateHorseLength(timeDiff: number, spurtTargetSpeed: number): number {
  // バ身差 = (タイム差) * スパート目標速度 / 2.5
  return (timeDiff * spurtTargetSpeed) / 2.5;
}

/**
 * ステータスとレース条件から、スパート目標速度(m/s)を推定する
 * ※シミュレータエンジンの仕様に基づいた近似値・または正確な計算式
 */
export function estimateSpurtTargetSpeed(umaData: UmaStatusData, raceCondition: RaceCondition): number {
  const course = getCourseById(raceCondition.locationId, raceCondition.courseId);
  const distance = course?.dist || 2000;
  
  // 基準速度 = 20.0 - (距離 - 2000) / 1000
  const baseSpeed = 20.0 - (distance - 2000) / 1000;
  
  // 補正スピード値（ここでは簡易的に調子絶好調・適性Aとして概算）
  // ※より正確な計算には、適性係数（距離適性）ややる気係数を掛ける必要があります。
  const speedStat = umaData.speed;
  const speedCoeff = Math.sqrt(500 * speedStat) * 0.002;
  
  // スパート目標速度 = 基準速度 * 1.05 + スピード補正
  // （※終盤のペースアップ等を考慮した簡易式）
  const spurtTargetSpeed = (baseSpeed * 1.05) + speedCoeff;
  
  return spurtTargetSpeed;
}
