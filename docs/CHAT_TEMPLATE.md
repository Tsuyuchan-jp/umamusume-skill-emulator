# Cursor チャット起票テンプレート

> 新チャットを開いたら、下記をコピーして先頭に貼る。
> ファイル参照は `@` で添付する。

---

## 実装チャット用

```
@docs/PROJECT.md
@docs/TODO.md

## チャット種別
実装（Agent mode）

## 背景
（docs/TODO.md のどの項目か。例: 次にやること #1）

## 今回やること
（1タスクに絞って書く）

## 触るファイル
- （例）desktop-app/app/components/SkillCommandPalette.tsx

## 触らないファイル
- app/lib/fuzzyMatcher.ts
- app/lib/geminiOcr.ts
- src-tauri/

## 完了条件
- [ ] （実機確認できる条件を書く）
- [ ] 作業完了後に docs/TODO.md を更新
- [ ] コミット作成（push はしない）

## 補足
（あれば）
```

---

## 調査チャット用（Ask mode）

```
@docs/PROJECT.md
@docs/TODO.md

## チャット種別
調査（Ask mode）

## 調査したいこと
（例: パレット先頭が白表示になる原因は？）

## 確認してほしいファイル
- （例）desktop-app/app/lib/umasimSkillData.ts
- （例）desktop-app/app/components/SkillCommandPalette.tsx

## やらないこと
- コード変更はしない。原因究明と報告のみ

## 報告形式
- 原因
- 根拠（ファイル・行・データ）
- 修正方針の提案（実装はしない）
```

---

## 検証チャット用

```
@docs/PROJECT.md
@docs/TODO.md

## チャット種別
検証（Agent mode）

## 検証対象
- コミット: （例）570a1f2
- ブランチ: master

## 確認観点
- [ ] （実機で見るべきポイント）
- [ ] 副作用がないこと

## 触らないこと
- 新機能追加はしない（バグがあれば最小修正のみ）

## 結果の記録
検証完了後、docs/TODO.md の「完了済み」または「既知の問題」に追記する
```

---

## 個別要件ありの場合

大きめの機能は `docs/tasks/REQ-*.md` を追加で参照する。

```
@docs/PROJECT.md
@docs/TODO.md
@docs/tasks/REQ-（タスク名）.md
```
