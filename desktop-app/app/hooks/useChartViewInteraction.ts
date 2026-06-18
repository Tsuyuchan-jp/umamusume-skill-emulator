import { Dispatch, RefObject, SetStateAction, useCallback, useEffect, useRef } from "react";
import {
  applyPanDrag,
  applyWheelZoom,
  ChartPlotMetrics,
  ChartViewState,
  createInitialChartViewState,
  clampChartViewState,
  svgToSpeed,
  svgToTime,
} from "../lib/raceGraphBuilder";

interface UseChartViewInteractionOptions {
  enabled: boolean;
  raceEnd: number;
  chartAreaRef: RefObject<HTMLDivElement | null>;
  plotMetrics: ChartPlotMetrics;
  plotMetricsReady: boolean;
  viewState: ChartViewState;
  setViewState: Dispatch<SetStateAction<ChartViewState>>;
}

/** chartAreaRef へホイールズーム・2D パン・ダブルクリックリセットを付与 */
export function useChartViewInteraction({
  enabled,
  raceEnd,
  chartAreaRef,
  plotMetrics,
  plotMetricsReady,
  viewState,
  setViewState,
}: UseChartViewInteractionOptions): void {
  const viewStateRef = useRef(viewState);
  const plotMetricsRef = useRef(plotMetrics);
  const dragRef = useRef<{ startX: number; startY: number; view: ChartViewState } | null>(null);

  useEffect(() => {
    viewStateRef.current = viewState;
  }, [viewState]);

  useEffect(() => {
    plotMetricsRef.current = plotMetrics;
  }, [plotMetrics]);

  const resetView = useCallback(() => {
    if (raceEnd <= 0) return;
    setViewState(createInitialChartViewState(raceEnd));
  }, [raceEnd, setViewState]);

  useEffect(() => {
    const el = chartAreaRef.current;
    if (!el || !enabled || raceEnd <= 0) return;

    const handleWheel = (event: WheelEvent) => {
      if (!plotMetricsRef.current.scales) return;
      event.preventDefault();

      const rect = el.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const metrics = plotMetricsRef.current;
      const cursorTime = svgToTime(x, metrics);
      const cursorSpeed = svgToSpeed(y, metrics);
      const zoomIn = event.deltaY < 0;

      setViewState((prev) =>
        applyWheelZoom(prev, raceEnd, cursorTime, cursorSpeed, zoomIn),
      );
    };

    const handleDoubleClick = (event: MouseEvent) => {
      event.preventDefault();
      resetView();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (!plotMetricsRef.current.scales) return;
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        view: viewStateRef.current,
      };
      el.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const { cartesian } = plotMetricsRef.current;

      setViewState(
        applyPanDrag(
          drag.view,
          raceEnd,
          dx,
          dy,
          cartesian.width,
          cartesian.height,
        ),
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      if (el.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("dblclick", handleDoubleClick);
    el.addEventListener("pointerdown", handlePointerDown);
    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerup", handlePointerUp);
    el.addEventListener("pointercancel", handlePointerUp);

    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("dblclick", handleDoubleClick);
      el.removeEventListener("pointerdown", handlePointerDown);
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerup", handlePointerUp);
      el.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [chartAreaRef, enabled, plotMetricsReady, raceEnd, resetView, setViewState]);
}

/** リサイズ時に center / scale を維持したまま clamp を再実行 */
export function useClampChartViewOnResize(
  enabled: boolean,
  raceEnd: number,
  setViewState: Dispatch<SetStateAction<ChartViewState>>,
  deps: unknown[],
): void {
  useEffect(() => {
    if (!enabled || raceEnd <= 0) return;
    setViewState((prev) => clampChartViewState(prev, raceEnd));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps は呼び出し元で明示
  }, [enabled, raceEnd, setViewState, ...deps]);
}
