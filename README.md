# ブースプランナー

展示会ブースのレイアウトを平面図で検討し、3Dで確認、見積依頼用の備品リストまで出せるブラウザアプリ。

公開URL: https://sarazawa-ui.github.io/booth-planner/(main に push すると GitHub Actions で自動公開)

作業データは各自のブラウザ(IndexedDB)にだけ保存され、サーバーには送られない。共有は「保存」で書き出す .booth.json で行う。

## 起動

```
npm install
npm run dev      # http://localhost:5186
npm run build        # dist/ に通常のWeb公開用ファイル
npm run build:share  # 配布用/ブースプランナー.html(1ファイル完結・ダブルクリックで起動)を生成
```

## できること

- 平面図: 小間サイズ・開放タイプ(一面/角/三面/島)から壁を自動生成、壁の手描き(W キー)、ドラッグ移動・回転・リサイズ、壁付け什器の吸着
- 3D: 木工/オクタノルム切替、PBR質感・影・AO・スポット照明、カメラプリセット、PNG保存
- グラフィック: 壁面全面出力(A面/B面)、パネル・バナー・吊りバナー・モニター・カウンター前面に画像貼付(全面/全体表示/伸縮)
- 3Dデータ: GLB / glTF / OBJ / STL / FBX を読込(単位・上方向を後から変更可)
- 備品リスト: オクタノルム部材(支柱・パネル・ビーム)/木工壁長・床面積・出力物・什器・照明・電気容量目安を自動集計、CSV(Excel)・印刷/PDF
- 保存: ブラウザ(IndexedDB)に自動保存。「保存」で画像・3Dデータ込みの .booth.json を書き出し

## 構成

- `src/catalog.ts` 什器カタログ(寸法・色・見積区分)
- `src/store.ts` 状態・Undo/Redo・自動保存
- `src/components/plan/` 平面図(SVG)
- `src/components/three/` 3D(react-three-fiber)
- `src/lib/estimate.ts` 備品リスト集計
