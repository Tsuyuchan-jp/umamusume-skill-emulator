import { describe, expect, it } from "vitest";
import {
  SKILL_DATA_BUNDLED_FALLBACK_TOAST_MESSAGE,
  SKILL_DATA_CACHE_FALLBACK_TOAST_MESSAGE,
  SKILL_DATA_REMOTE_TOAST_MESSAGE,
  SKILL_DATA_STATUS_BUNDLED,
  SKILL_DATA_STATUS_CACHE,
  SKILL_DATA_STATUS_LOADING,
  SKILL_DATA_STATUS_NONE,
  SKILL_DATA_STATUS_REMOTE,
  eventPresetStatusText,
  skillDataStatusText,
  skillDataToastForSource,
} from "./skillDataUi";

describe("skillDataToastForSource", () => {
  it("remote は成功トースト A", () => {
    expect(skillDataToastForSource("remote")).toEqual({
      message: SKILL_DATA_REMOTE_TOAST_MESSAGE,
      type: "success",
    });
  });

  it("cache はエラートースト B、bundled は C で文が異なる", () => {
    expect(skillDataToastForSource("cache").message).toBe(
      SKILL_DATA_CACHE_FALLBACK_TOAST_MESSAGE
    );
    expect(skillDataToastForSource("bundled").message).toBe(
      SKILL_DATA_BUNDLED_FALLBACK_TOAST_MESSAGE
    );
    expect(skillDataToastForSource("cache").type).toBe("error");
    expect(skillDataToastForSource("bundled").type).toBe("error");
    expect(skillDataToastForSource("cache").message).not.toBe(
      skillDataToastForSource("bundled").message
    );
  });
});

describe("skillDataStatusText / eventPresetStatusText", () => {
  it("診断文は取得元に応じて切り替わる", () => {
    expect(skillDataStatusText(null, true)).toBe(SKILL_DATA_STATUS_LOADING);
    expect(skillDataStatusText(null, false)).toBe(SKILL_DATA_STATUS_NONE);
    expect(skillDataStatusText("remote", false)).toBe(SKILL_DATA_STATUS_REMOTE);
    expect(skillDataStatusText("cache", false)).toBe(SKILL_DATA_STATUS_CACHE);
    expect(skillDataStatusText("bundled", false)).toBe(SKILL_DATA_STATUS_BUNDLED);
  });

  it("プリセット件数 0 は非表示の案内", () => {
    expect(eventPresetStatusText(3)).toMatch(/3 件/);
    expect(eventPresetStatusText(0)).toMatch(/表示しません/);
  });
});
