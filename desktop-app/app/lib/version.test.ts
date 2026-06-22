import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import { APP_VERSION, APP_VERSION_LABEL } from "./version";

const desktopAppRoot = join(__dirname, "../..");

describe("version", () => {
  it("APP_VERSION は package.json と一致する", () => {
    expect(APP_VERSION).toBe(packageJson.version);
    expect(APP_VERSION_LABEL).toBe(`v${packageJson.version}`);
  });

  it("Cargo.toml の version は package.json と一致する", () => {
    const cargoToml = readFileSync(join(desktopAppRoot, "src-tauri/Cargo.toml"), "utf8");
    expect(cargoToml).toMatch(new RegExp(`^version = "${APP_VERSION}"`, "m"));
  });

  it("tauri.conf.json は package.json を参照する", () => {
    const tauriConf = JSON.parse(
      readFileSync(join(desktopAppRoot, "src-tauri/tauri.conf.json"), "utf8")
    );
    expect(tauriConf.version).toBe("../package.json");
  });
});
