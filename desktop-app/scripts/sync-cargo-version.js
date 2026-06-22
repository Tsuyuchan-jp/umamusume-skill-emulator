/**
 * package.json の version を Cargo.toml に同期する。
 * 正本: desktop-app/package.json
 */
const fs = require("fs");
const path = require("path");

const desktopAppRoot = path.join(__dirname, "..");
const packageJsonPath = path.join(desktopAppRoot, "package.json");
const cargoTomlPath = path.join(desktopAppRoot, "src-tauri", "Cargo.toml");

const { version } = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
const synced = cargoToml.replace(/^version = ".*"$/m, `version = "${version}"`);

if (synced === cargoToml) {
  console.log(`Cargo.toml version already ${version}`);
} else {
  fs.writeFileSync(cargoTomlPath, synced, "utf8");
  console.log(`Synced Cargo.toml version to ${version}`);
}
