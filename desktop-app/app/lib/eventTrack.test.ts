import { describe, expect, it } from "vitest";
import { DEFAULT_SURFACE_COND, parseEventTrackText } from "./eventTrack";

const SAMPLE = `
9,C,東京,芝1800m,GOOD
10,C,京都,芝2200m(外),GOOD
10,C,ロンシャン,芝2400m,BAD
11,L,京都,芝3000m(外)
`.trim();

describe("parseEventTrackText", () => {
  it("チャンミは 9 人・指定バ場、LoH は 12 人・デフォルトバ場（良）", () => {
    const presets = parseEventTrackText(SAMPLE);
    expect(presets).toHaveLength(4);

    expect(presets[0]).toMatchObject({
      name: "9月チャンミ 東京 芝1800m",
      locationId: "10006",
      courseId: "10603",
      playerNum: 9,
      surfaceCond: 1,
    });

    expect(presets[1]).toMatchObject({
      name: "10月チャンミ 京都 芝2200m(外)",
      locationId: "10008",
      courseId: "10808",
      playerNum: 9,
      surfaceCond: 1,
    });

    expect(presets[2]).toMatchObject({
      name: "10月チャンミ ロンシャン 芝2400m",
      locationId: "10201",
      courseId: "11203",
      playerNum: 9,
      surfaceCond: 4,
    });

    expect(presets[3]).toMatchObject({
      name: "11月LoH 京都 芝3000m(外)",
      locationId: "10008",
      courseId: "10810",
      playerNum: 12,
      surfaceCond: DEFAULT_SURFACE_COND,
    });
  });

  it("空行・列不足は無視する", () => {
    expect(parseEventTrackText("\n\nfoo,bar\n")).toEqual([]);
  });

  it("未知の競馬場名はスキップする", () => {
    expect(parseEventTrackText("9,C,架空競馬場,芝1800m,GOOD")).toEqual([]);
  });
});
