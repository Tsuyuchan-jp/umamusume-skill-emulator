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

export type StitchTab = "Skill" | "Inheritance" | "TrainingInfo";

export type TabRowMethod = "green-l2" | "green-l3" | "fallback";

export interface TabRowInfo {
  tabCount: number;
  tabY: number;
  found: boolean;
  method?: TabRowMethod;
}

export interface LayoutDetection {
  layout: StitchLayout;
  tabRow: TabRowInfo;
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
  tab: StitchTab;
}
