import { Dispatch, RefObject, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import {
  applyPanDrag,
  applyWheelZoom,
  ChartPlotMetrics,
  ChartViewState,
  createInitialChartViewState,
  clampChartViewState,
  svgToPercent,
  svgToSpeed,
  svgToTime,
} from "../lib/raceGraphBuilder";

/** ホイール停止後、isMapInteracting を false にするまでの待機（ms） */
export const MAP_INTERACTION_WHEEL_IDLE_MS = 150;

interface UseChartViewInteractionOptions {
  enabled: boolean;
  raceEnd: number;
  chartAreaRef: RefObject<HTMLDivElement | null>;
  plotMetrics: ChartPlotMetrics;
  plotMetricsReady: boolean;
  viewState: ChartViewState;
  setViewState: Dispatch<SetStateAction<ChartViewState>>;
}

interface UseChartViewInteractionResult {
  /** ホイール・ドラッグ操作中（overlay 再配置を defer するフラグ） */
  isMapInteracting: boolean;
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
}: UseChartViewInteractionOptions): UseChartViewInteractionResult {
  const viewStateRef = useRef(viewState);
  const plotMetricsRef = useRef(plotMetrics);
  const dragRef = useRef<{ startX: number; startY: number; view: ChartViewState } | null>(null);
  const pendingViewStateRef = useRef<ChartViewState | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const wheelIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const wheelActiveRef = useRef(false);

  const [isMapInteracting, setIsMapInteracting] = useState(false);

  useEffect(() => {
    viewStateRef.current = viewState;
  }, [viewState]);

  useEffect(() => {
    plotMetricsRef.current = plotMetrics;
  }, [plotMetrics]);

  const syncInteracting = useCallback(() => {
    setIsMapInteracting(isDraggingRef.current || wheelActiveRef.current);
  }, []);

  const flushPendingViewState = useCallback(() => {
    rafIdRef.current = null;
    const pending = pendingViewStateRef.current;
    if (pending == null) return;
    pendingViewStateRef.current = null;
    setViewState(pending);
  }, [setViewState]);

  const scheduleViewStateCommit = useCallback(
    (next: ChartViewState) => {
      pendingViewStateRef.current = next;
      if (rafIdRef.current != null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        flushPendingViewState();
      });
    },
    [flushPendingViewState],
  );

  const scheduleWheelIdleEnd = useCallback(() => {
    if (wheelIdleTimerRef.current != null) {
      clearTimeout(wheelIdleTimerRef.current);
    }
    wheelIdleTimerRef.current = setTimeout(() => {
      wheelIdleTimerRef.current = null;
      wheelActiveRef.current = false;
      syncInteracting();
    }, MAP_INTERACTION_WHEEL_IDLE_MS);
  }, [syncInteracting]);

  const resetView = useCallback(() => {
    if (raceEnd <= 0) return;
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingViewStateRef.current = null;
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
      const cursorPercent = svgToPercent(y, metrics);
      const zoomIn = event.deltaY < 0;

      const prev = pendingViewStateRef.current ?? viewStateRef.current;
      scheduleViewStateCommit(
        applyWheelZoom(prev, raceEnd, cursorTime, cursorSpeed, cursorPercent, zoomIn),
      );

      wheelActiveRef.current = true;
      syncInteracting();
      scheduleWheelIdleEnd();
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
      isDraggingRef.current = true;
      syncInteracting();
      el.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const { cartesian } = plotMetricsRef.current;

      scheduleViewStateCommit(
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
      isDraggingRef.current = false;
      syncInteracting();
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
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (wheelIdleTimerRef.current != null) {
        clearTimeout(wheelIdleTimerRef.current);
        wheelIdleTimerRef.current = null;
      }
      pendingViewStateRef.current = null;
      isDraggingRef.current = false;
      wheelActiveRef.current = false;
    };
  }, [
    chartAreaRef,
    enabled,
    plotMetricsReady,
    raceEnd,
    resetView,
    scheduleViewStateCommit,
    scheduleWheelIdleEnd,
    syncInteracting,
  ]);

  return { isMapInteracting };
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
