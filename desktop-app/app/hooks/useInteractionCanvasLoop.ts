import { RefObject, useEffect, useRef } from "react";
import {
  drawChartLines,
  drawSkillActivationDots,
  resizeCanvasToDisplaySize,
} from "../lib/chartLineRenderer";
import type {
  CartesianRect,
  ChartViewState,
  GraphDisplayState,
  GraphPoint,
  SkillMarker,
} from "../lib/raceGraphBuilder";
import { visibleWindowFromViewState } from "../lib/raceGraphBuilder";

export interface UseInteractionCanvasLoopOptions {
  enabled: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  canvasVisible: boolean;
  isMapInteracting: boolean;
  liveViewRef: RefObject<ChartViewState>;
  committedViewState: ChartViewState;
  interactionCartesianRef: RefObject<CartesianRect | null>;
  idleCartesian: CartesianRect;
  raceEnd: number;
  points: GraphPoint[];
  skillMarkers: SkillMarker[];
  displayState: GraphDisplayState;
  showBaseline: boolean;
  cssWidth: number;
  cssHeight: number;
  colors: { speed: string; stamina: string; lane: string; baselineOpacity: number };
}

/** Canvas 連続 rAF — liveViewRef 更新は re-render しないため入力ごとではなく連続ループ */
export function useInteractionCanvasLoop(options: UseInteractionCanvasLoopOptions): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const shouldRun = options.enabled && options.canvasVisible;

    const drawFrame = () => {
      rafIdRef.current = requestAnimationFrame(drawFrame);

      const {
        canvasRef,
        isMapInteracting,
        liveViewRef,
        committedViewState,
        interactionCartesianRef,
        idleCartesian,
        raceEnd,
        points,
        skillMarkers,
        displayState,
        showBaseline,
        cssWidth,
        cssHeight,
        colors,
      } = optionsRef.current;

      const canvas = canvasRef.current;
      if (!canvas || raceEnd <= 0 || cssWidth <= 0 || cssHeight <= 0) return;

      const cartesian = isMapInteracting
        ? interactionCartesianRef.current
        : idleCartesian;
      if (!cartesian || cartesian.width <= 0) return;

      const view = isMapInteracting ? liveViewRef.current : committedViewState;
      const window = visibleWindowFromViewState(view, raceEnd);

      resizeCanvasToDisplaySize(canvas, cssWidth, cssHeight);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const renderCtx = { ctx, cartesian, window };

      drawChartLines(renderCtx, points, { displayState, showBaseline, colors });

      if (displayState.showSkills || displayState.showDebuffs) {
        drawSkillActivationDots(renderCtx, points, { displayState, markers: skillMarkers });
      }
    };

    if (shouldRun) {
      rafIdRef.current = requestAnimationFrame(drawFrame);
    }

    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [options.enabled, options.canvasVisible]);
}
