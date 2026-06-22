import packageJson from "../../package.json";

/** アプリ semver（正本: desktop-app/package.json） */
export const APP_VERSION = packageJson.version;

/** UI 表示用ラベル（例: v1.1.0） */
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
