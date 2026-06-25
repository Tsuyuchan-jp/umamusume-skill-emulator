import type { StitchLayout } from "./constants";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ScrollStartMethod = "absdiff" | "green-tab" | "layout-ratio";

export interface ScrollStartResult {
  scrollStartY: number;
  ratio: number;
  method: ScrollStartMethod;
  confidence: "high" | "low";
}

export interface StitchReport {
  crop: CropRect;
  regions: {
    scrollStartY: number;
    ratio: number;
    method: ScrollStartMethod;
    confidence: "high" | "low";
  };
  layout: StitchLayout;
  tab: "Skill" | "Inheritance" | "TrainingInfo";
}
