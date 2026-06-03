export const APTITUDE_GRADES = ["S", "A", "B", "C", "D", "E", "F", "G"];

export const APTITUDE_LABELS: Record<string, string> = {
  turf: "芝", dirt: "ダート",
  short: "短距離", mile: "マイル", medium: "中距離", long: "長距離",
  nige: "逃げ", senkou: "先行", sashi: "差し", oikomi: "追込"
};

export const STRATEGIES = [
  { value: "NIGE", label: "逃げ" },
  { value: "SEN", label: "先行" },
  { value: "SASI", label: "差し" },
  { value: "OI", label: "追込" },
];

export const CONDITIONS = [
  { value: "BEST", label: "絶好調" },
  { value: "GOOD", label: "好調" },
  { value: "NORMAL", label: "普通" },
  { value: "BAD", label: "不調" },
  { value: "WORST", label: "絶不調" },
];
