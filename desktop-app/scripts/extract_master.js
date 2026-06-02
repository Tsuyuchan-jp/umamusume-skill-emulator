const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = "D:/SteamLibrary/steamapps/common/UmamusumePrettyDerby_Jpn/UmamusumePrettyDerby_Jpn_Data/Persistent/master/master.mdb";

console.log("ウマ娘のローカルデータベースからマスターデータを抽出しています...");

try {
  const db = new Database(dbPath, { readonly: true });
  
  // カテゴリ170（ベース名）ではなく、カテゴリ4（衣装名付きフルネーム）を取得する
  // 実際に育成ウマ娘として実装されているカード（card_data）のみに絞り込む
  const charaRows = db.prepare(`
    SELECT c.id, t.text as name 
    FROM card_data c
    JOIN text_data t ON t.category = 4 AND t.\`index\` = c.id
    ORDER BY c.id
  `).all();
  
  // succession_factor と text_data を結合して因子を取得
  const factorRows = db.prepare(`
    SELECT f.factor_type, f.factor_id, t.text as name 
    FROM succession_factor f 
    JOIN text_data t ON t.category = 147 AND t.\`index\` = f.factor_id 
  `).all();
  
  db.close();

  // キャラデータの整形（衣装違いごとに完全にユニークなリストになる）
  const characters = charaRows.map(r => ({ id: r.id, name: r.name }));
  
  // キャラIDから名前を引くためのマップ
  const charaMap = {};
  charaRows.forEach(r => { charaMap[r.id] = r.name; });

  // factor_type で分類し、重複を排除（Setを使用）
  const blueFactors = [...new Set(factorRows.filter(r => r.factor_type === 1).map(r => r.name))];
  const redFactors = [...new Set(factorRows.filter(r => r.factor_type === 2).map(r => r.name))];
  const greenFactors = [...new Set(factorRows.filter(r => r.factor_type === 3).map(r => r.name))];
  const whiteFactors = [...new Set(factorRows.filter(r => r.factor_type >= 4).map(r => r.name))];

  // 緑因子名 -> 衣装付きキャラ名の辞書を生成
  // 因子IDの上6桁がカードIDであることを利用
  const greenFactorToCharacter = {};
  for (const row of factorRows) {
    if (row.factor_type === 3) {
      const cardId = Math.floor(row.factor_id / 100);
      if (charaMap[cardId]) {
        greenFactorToCharacter[row.name] = charaMap[cardId];
      }
    }
  }

  const masterData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      characterCount: characters.length, // ここが衣装数に増える
      factorCounts: {
        blue: blueFactors.length,
        red: redFactors.length,
        green: greenFactors.length,
        white: whiteFactors.length
      }
    },
    characters,
    greenFactorToCharacter,
    factors: {
      blue: blueFactors.map((name, i) => ({ id: 10000 + i, name })),
      red: redFactors.map((name, i) => ({ id: 20000 + i, name })),
      green: greenFactors.map((name, i) => ({ id: 30000 + i, name })),
      white: whiteFactors.map((name, i) => ({ id: 40000 + i, name }))
    }
  };

  const outputPath = path.join(__dirname, '../app/lib/master_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(masterData, null, 2), 'utf-8');
  
  console.log(`抽出と分類が完了しました！`);
  console.log(`✅ ウマ娘 (衣装別): ${characters.length} 件`);
  console.log(`✅ 青因子: ${blueFactors.length} 件`);
  console.log(`✅ 赤因子: ${redFactors.length} 件`);
  console.log(`✅ 緑因子: ${greenFactors.length} 件`);
  console.log(`✅ 白因子: ${whiteFactors.length} 件`);
  console.log(`保存先: ${outputPath}`);

} catch (e) {
  console.error("抽出中にエラーが発生しました:", e.message);
}
