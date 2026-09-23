# 【提案 / PoC】Hike WebAssembly ＆ ランタイム安全難読化パイプライン

> **注記**: 本リポジトリは、Hike言語開発チームに向けた一時的な概念実証（PoC）および機能提案用スタンドアロンリポジトリです。（確認後はアーカイブ/削除を想定しています）

---

## 🎯 目的と背景

Hike言語でコンパイルされた WebAssembly（`*.wasm`）と、自動生成される JavaScript グルーコード（`runtime.js`）を商用環境などで安全に配布する際、通常の JS 難読化ツールをそのまま適用すると `instance.exports.xxx` や `imports.env.malloc` などの Wasm 境界の識別子まで書き換わってしまい、実行時エラー（クラッシュ）が発生します。

本リポジトリは、**Babel による AST 静的解析**と **`javascript-obfuscator`** を組み合わせ、Wasm インターフェースを自動抽出・保護した上で安全に難読化を行うリファレンス実装（PoC）と検証結果を提供します。

---

## 📁 フォルダ・ファイル構成

```text
├── package.json          # 依存パッケージ定義 (@babel/parser, @babel/traverse, javascript-obfuscator)
├── .gitignore            # node_modules / ログ除外設定
├── build-obfuscate.js    # AST 自動抽出＆難読化ビルドスクリプト本体
├── runtime.js            # Hike 標準 WebAssembly ランタイム
├── sample_qr.wasm        # 動作検証用 サンプル Wasm モジュール
├── sample_wrapper.js     # sample_qr.wasm 用の JS グルーコード
├── test_comparison.js    # オリジナル vs 難読化後の自動比較ベンチマークテスト
├── README.md             # 英語ドキュメント (English)
└── README.ja.md          # 本ドキュメント (日本語)
```

---

## 📊 比較検証＆ベンチマーク結果

`sample_qr.wasm` と `sample_wrapper.js` を使用し、2D マトリクス生成を 200 回連続実行して動作精度と速度を比較検証しました：

| 検証項目 | オリジナル（未難読化） | 難読化後（安全保護済み） | 判定・差分 |
| :--- | :--- | :--- | :--- |
| **Wasm バイナリサイズ** | 12.70 KB | 12.70 KB | **完全一致（Wasm無改変・保護）** |
| **JSコードサイズ** | 15.69 KB | 36.75 KB | **約 2.3 倍（制御フロー平坦化・暗号化）** |
| **マトリクス規格・サイズ** | 29x29 | 29x29 | **100% 完全一致 ✅** |
| **ファインダーパターン (`isDark`)** | `true` | `true` | **100% 完全一致 ✅** |
| **200回連続処理時間** | 1.19 ms | 2.32 ms | **+1.13 ms（極めて軽微な差）** |
| **スループット** | 167,715 ops/s | 86,044 ops/s | **実用上十分な超高速動作 ✅** |

---

## 🚀 動作検証の実行手順

```bash
# 1. 依存パッケージのインストール
npm install
# （Deno を使用する場合）: deno install --node-modules-dir=auto

# 2. 比較検証テストの実行
npm test
# または
node test_comparison.js
```

---

## 💡 `hikec` コンパイラへの組み込み提案

`hikec` コンパイラ自身は、プログラム内のすべてのエクスポート関数名、インポート関数名、グローバル変数を内部で完全に把握しています。

そのため、将来的に `hikec` 自身に難読化フラグ（例: `hikec build --obfuscate`）が組み込まれると以下のような大きなメリットがあります：
1. **設定不要（ゼロコンフィグ）**: ユーザー側で Babel や難読化設定、予約語リストを用意する必要がなくなります。
2. **確実な安全性**: コンパイラが持つシンボル情報から、Wasm/JS の接続境界を 100% 確実に保護できます。
3. **シームレスな開発体験**: `wasm-strip` による不要セクション削除と JS 難読化が 1 コマンドで完結します。

