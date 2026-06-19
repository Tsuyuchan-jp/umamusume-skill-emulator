import { Dispatch, RefObject, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import {
  applyPanDrag,
  applyWheelZoom,
  CartesianRect,
  ChartPlotMetrics,
  ChartViewState,
  createInitialChartViewState,
  clampChartViewState,
} from "../lib/raceGraphBuilder";

/** ホイール完全停止とみなす無入力時間（ms）。この間隔を超えて初めて commitLiveView を実行する */
export const MAP_INTERACTION_WHEEL_IDLE_MS = 300;

/** 操作中の chartViewState → Recharts domain 反映の上限 fps */
export const MAP_CHART_DOMAIN_COMMIT_FPS = 30;
export const MAP_CHART_DOMAIN_COMMIT_MS = Math.ceil(1000 / MAP_CHART_DOMAIN_COMMIT_FPS);

interface UseChartViewInteractionOptions {
  enabled: boolean;
  raceEnd: number;
  chartAreaRef: RefObject<HTMLDivElement | null>;
  plotMetrics: ChartPlotMetrics;
  plotMetricsReady: boolean;
  viewState: ChartViewState;
  setViewState: Dispatch<SetStateAction<ChartViewState>>;
  /** ダブルクリックリセット直前（measured metrics 無効化用） */
  onViewReset?: () => void;
  /** true: 操作中は setViewState を呼ばず liveViewRef のみ更新（デフォルト true） */
  deferDomainCommit?: boolean;
}

interface UseChartViewInteractionResult {
  /** ホイール・ドラッグ操作中（overlay 再配置を defer するフラグ） */
  isMapInteracting: boolean;
  /** 操作中の最新 view（Canvas rAF 用）。ref のみ — React state で返さない */
  liveViewRef: RefObject<ChartViewState>;
  /** 操作開始時に固定する cartesian（synthetic metrics / Canvas 描画用） */
  interactionCartesianRef: RefObject<CartesianRect | null>;
}

/** ホイールズームのアンカー座標（可視窓 center = 画面中心拡大） */
function wheelZoomAnchor(view: ChartViewState): Pick<ChartViewState, "centerTime" | "centerSpeed" | "centerPercent"> {
  return {
    centerTime: view.centerTime,
    centerSpeed: view.centerSpeed,
    centerPercent: view.centerPercent,
  };
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
  onViewReset,
  deferDomainCommit = true,
}: UseChartViewInteractionOptions): UseChartViewInteractionResult {
  const viewStateRef = useRef(viewState);
  const plotMetricsRef = useRef(plotMetrics);
  const liveViewRef = useRef(viewState);
  const interactionCartesianRef = useRef<CartesianRect | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; view: ChartViewState } | null>(null);
  const pendingViewStateRef = useRef<ChartViewState | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const domainCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDomainCommitTimeRef = useRef(0);
  const wheelIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const wheelActiveRef = useRef(false);

  const deferActive = enabled && (deferDomainCommit ?? true);
  const deferActiveRef = useRef(deferActive);

  const [isMapInteracting, setIsMapInteracting] = useState(false);

  useEffect(() => {
    deferActiveRef.current = deferActive;
  }, [deferActive]);

  useEffect(() => {
    viewStateRef.current = viewState;
    if (interactionCartesianRef.current == null) {
      liveViewRef.current = viewState;
    }
  }, [viewState]);

  useEffect(() => {
    plotMetricsRef.current = plotMetrics;
  }, [plotMetrics]);

  const syncInteracting = useCallback(() => {
    setIsMapInteracting(isDraggingRef.current || wheelActiveRef.current);
  }, []);

  const cancelDomainCommitTimer = useCallback(() => {
    if (domainCommitTimerRef.current != null) {
      clearTimeout(domainCommitTimerRef.current);
      domainCommitTimerRef.current = null;
    }
  }, []);

  const flushPendingViewState = useCallback(
    (bypassThrottle = false) => {
      rafIdRef.current = null;
      const pending = pendingViewStateRef.current;
      if (pending == null) return;

      const isInteracting = isDraggingRef.current || wheelActiveRef.current;

      if (!bypassThrottle && isInteracting) {
        const now = performance.now();
        const elapsed = now - lastDomainCommitTimeRef.current;

        if (elapsed < MAP_CHART_DOMAIN_COMMIT_MS) {
          if (domainCommitTimerRef.current == null) {
            const delay = MAP_CHART_DOMAIN_COMMIT_MS - elapsed;
            domainCommitTimerRef.current = setTimeout(() => {
              domainCommitTimerRef.current = null;
              if (rafIdRef.current == null) {
                rafIdRef.current = requestAnimationFrame(() => {
                  flushPendingViewState(false);
                });
              }
            }, delay);
          }
          return;
        }
      }

      pendingViewStateRef.current = null;
      lastDomainCommitTimeRef.current = performance.now();
      setViewState(pending);
    },
    [setViewState],
  );

  /** rAF / throttle 待ちの pending を即時 commit（操作終了時の overlay 同期用） */
  const commitPendingViewStateNow = useCallback(() => {
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    cancelDomainCommitTimer();
    flushPendingViewState(true);
  }, [cancelDomainCommitTimer, flushPendingViewState]);

  const scheduleViewStateCommit = useCallback(
    (next: ChartViewState) => {
      pendingViewStateRef.current = next;
      if (rafIdRef.current != null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        flushPendingViewState(false);
      });
    },
    [flushPendingViewState],
  );

  const ensureInteractionSession = useCallback(() => {
    if (interactionCartesianRef.current != null) return;
    interactionCartesianRef.current = { ...plotMetricsRef.current.cartesian };
    liveViewRef.current = viewStateRef.current;
  }, []);

  const commitLiveView = useCallback(() => {
    if (process.env.NODE_ENV === "development") {
      performance.mark("handoff:commit");
    }

    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    cancelDomainCommitTimer();
    pendingViewStateRef.current = null;

    if (deferActiveRef.current) {
      setViewState(liveViewRef.current);
      interactionCartesianRef.current = null;
    } else {
      commitPendingViewStateNow();
      interactionCartesianRef.current = null;
    }
  }, [cancelDomainCommitTimer, commitPendingViewStateNow, setViewState]);

  const scheduleWheelIdleEnd = useCallback(() => {
    if (wheelIdleTimerRef.current != null) {
      clearTimeout(wheelIdleTimerRef.current);
    }
    wheelIdleTimerRef.current = setTimeout(() => {
      wheelIdleTimerRef.current = null;
      commitLiveView();
      wheelActiveRef.current = false;
      syncInteracting();
    }, MAP_INTERACTION_WHEEL_IDLE_MS);
  }, [commitLiveView, syncInteracting]);

  const resetView = useCallback(() => {
    if (raceEnd <= 0) return;
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    cancelDomainCommitTimer();
    pendingViewStateRef.current = null;
    wheelActiveRef.current = false;
    if (wheelIdleTimerRef.current != null) {
      clearTimeout(wheelIdleTimerRef.current);
      wheelIdleTimerRef.current = null;
    }
    isDraggingRef.current = false;
    syncInteracting();
    onViewReset?.();
    const initial = createInitialChartViewState(raceEnd);
    liveViewRef.current = initial;
    interactionCartesianRef.current = null;
    lastDomainCommitTimeRef.current = performance.now();
    setViewState(initial);
  }, [raceEnd, onViewReset, setViewState, syncInteracting, cancelDomainCommitTimer]);

  useEffect(() => {
    const el = chartAreaRef.current;
    if (!el || !enabled || raceEnd <= 0) return;

    const handleWheel = (event: WheelEvent) => {
      const defer = deferActiveRef.current;
      if (!defer && !plotMetricsRef.current.scales) return;
      if (defer && plotMetricsRef.current.cartesian.width <= 0) return;
      event.preventDefault();

      const zoomIn = event.deltaY < 0;

      if (defer) {
        ensureInteractionSession();
        const view = liveViewRef.current;
        const anchor = wheelZoomAnchor(view);
        liveViewRef.current = applyWheelZoom(
          view,
          raceEnd,
          anchor.centerTime,
          anchor.centerSpeed,
          anchor.centerPercent,
          zoomIn,
        );
      } else {
        const prev = pendingViewStateRef.current ?? viewStateRef.current;
        const anchor = wheelZoomAnchor(prev);
        scheduleViewStateCommit(
          applyWheelZoom(
            prev,
            raceEnd,
            anchor.centerTime,
            anchor.centerSpeed,
            anchor.centerPercent,
            zoomIn,
          ),
        );
      }

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
      event.preventDefault();
      const defer = deferActiveRef.current;
      if (!defer && !plotMetricsRef.current.scales) return;
      if (defer && plotMetricsRef.current.cartesian.width <= 0) return;

      if (defer) {
        ensureInteractionSession();
      }

      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        view: defer ? liveViewRef.current : viewStateRef.current,
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

      if (deferActiveRef.current) {
        const cartesian = interactionCartesianRef.current;
        if (!cartesian) return;
        liveViewRef.current = applyPanDrag(
          drag.view,
          raceEnd,
          dx,
          dy,
          cartesian.width,
          cartesian.height,
        );
      } else {
        const { cartesian } = plotMetricsRef.current;
        scheduleViewStateCommit(
          applyPanDrag(drag.view, raceEnd, dx, dy, cartesian.width, cartesian.height),
        );
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      commitLiveView();
      isDraggingRef.current = false;
      syncInteracting();
      window.getSelection()?.removeAllRanges();
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
      cancelDomainCommitTimer();
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
    commitLiveView,
    cancelDomainCommitTimer,
    ensureInteractionSession,
  ]);

  return { isMapInteracting, liveViewRef, interactionCartesianRef };
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
