# Hike WebAssembly ＆ ランタイム安全難読化ツール (`--export-symbols` 対応コミュニティフォーク版)

[Hike プログラミング言語 (hike-lang)](https://github.com/hike-lang/hike-lang) でコンパイルされた WebAssembly（`*.wasm`）および自動生成される JavaScript ランタイム・グルーコード（`runtime.js`）を、Wasm / JS 境界インターフェースを破壊することなく安全に高強度難読化するためのビルドパイプラインです。

Hike コンパイラに追加された `--export-symbols` オプションに対応しています。

---

## ⚠️ メンテナンスおよび自由なフォークについて

- **保守・維持について**: 本リポジトリは有志による参考実装として公開されています。**作者自身は難読化やコンパイラ等の専門的な知見が乏しく、今後の継続的な保守・サポート・機能改善・バグ修正等のメンテナンスを行う予定はありません。**
- **自由なフォーク推奨**: 本ツールのカスタマイズ、バグ修正、機能追加等が必要な場合は、どなたでもご自由に本リポジトリをフォーク（Fork）し、ご自身の用途に合わせて改変・再配布・活用してください。

---

## ライセンス (MIT License)

本リポジトリは **MIT License** のもとで公開されています。

- 商用・非商用を問わず、誰でも無料で自由に使用、複製、改変、結合、掲載、配布、サブライセンス、および/または販売することができます。
- 詳細は [LICENSE](LICENSE) ファイルをご参照ください。

---

## 普通の難読化ツール（Terser / UglifyJS / 単体 Obfuscator）との比較

| 比較項目 | 普通の難読化ツール (Terser, UglifyJS, 一般のObfuscator) | 本ツール (`--export-symbols` 対応 Hike Safe Obfuscator) |
| :--- | :--- | :--- |
| **Wasm境界保護** | **不適切（クラッシュ発生）**<br>`instance.exports.hike_main` や `imports.env.malloc` 等の識別子まで難読化・変名されてしまい、実行時エラーが発生 | **100% 安全（境界完全保護）**<br>`--export-symbols` メタデータにより Wasm/JS 接続境界のシンボルを全自動予約・保護 |
| **難読化強度** | Wasm 境界エラーを避けるために設定を弱くせざるを得ない | **最大強度を維持可能**<br>制御フロー平坦化・文字列暗号化・難読化を強力にかけることが可能 |
| **設定の手間** | 手動で予約語リスト（`reserved`）を1つずつ調査・記述する必要がある | **ゼロコンフィグ / 完全自動**<br>Hike コンパイラの `--export-symbols` から自動抽出 |
| **実行環境** | Node.js 依存の重いビルド環境が必要なケースが多い | **Bash スクリプト / スタンドアロンバイナリ対応**<br>Node不要の Bash や単一 `.exe` で1コマンド実行 |

---

## 謝辞 (Acknowledgements)

本プロジェクトの作成にあたり、優れた難読化基盤および言語機能を提供してくださっている開発者の皆様に深く感謝と御礼を申し上げます。

### 1. 内部難読化ツール (`javascript-obfuscator` & `Babel`) 作成者・開発者の皆様へ
本パイプラインの難読化エンジンとして活用させていただいている JavaScript 高強度難読化ツール [javascript-obfuscator](https://github.com/javascript-obfuscator/javascript-obfuscator) の作者・開発者の皆様、ならびに JavaScript AST 解析ライブラリ [Babel](https://babeljs.io/) (`@babel/parser`, `@babel/traverse`) の開発者の皆様に心より感謝申し上げます。素晴らしい難読化・パース技術のおかげで、Wasm 境界を壊さない安全な難読化が実現できています。

### 2. Hike 言語の作者・開発チームの皆様へ
次世代のシステムプログラミング言語 [Hike (hike-lang)](https://github.com/hike-lang/hike-lang) を開発・提供してくださっている作者様および開発チームの皆様に深く御礼申し上げます。特に、Wasm コンパイル時にエクスポート/インポート・シンボル情報を出力する `--export-symbols` オプションをサポートしていただいたことで、難読化パイプラインとの完全かつ安全な連携が実現いたしました。

---

## Bash シェルスクリプト版 (`build-obfuscate.sh`)

JavaScript ファイル（`node ...`）を直接実行するのではなく、Linux / macOS / Git Bash 等の端末から Bash スクリプト 1 本で実行したい場合、**`build-obfuscate.sh`** が使用できます。

```bash
# 権限の付与 (初回のみ)
chmod +x build-obfuscate.sh

# Bash スクリプトから直接実行
./build-obfuscate.sh --export-symbols sample_symbols.json
```

#### 引数オプション:
- `--export-symbols <path>`: Hike コンパイラが出力したシンボル定義ファイルのパス。
- `--runtime <path>`: 難読化対象の `runtime.js` パス。
- `--out <path>`: 難読化後の出力先 (`runtime.min.js`) パス。
- `--src <path>`: (オプション) `hikec` でコンパイルする Hike ソースファイル。
- `--wasm-out <path>`: (オプション) `hikec` での Wasm 出力パス。

---

## その他の実行方法 (Node不要 / 単一バイナリ)

### 1. 完全独立型 Pure JS 難読化スクリプト (`build-obfuscate-standalone.js`)
外部 `node_modules` 依存なしで動作する全環境対応スクリプトです。

```bash
deno run -A build-obfuscate-standalone.js --export-symbols sample_symbols.json
```

### 2. Deno 単一バイナリ (Executable `.exe`)
Node.js すらインストールされていない環境でも動作する単一の独立実行ファイル（`.exe`）を作成できます。

```bash
# 単一バイナリのビルド (同梱の build-exe.bat でも実行可能)
deno compile --allow-read --allow-write --allow-run --output hike-obfuscate.exe build-obfuscate-standalone.js

# 直接実行
./hike-obfuscate.exe --export-symbols sample_symbols.json
```

---

## `--export-symbols` 対応の概要

Hike コンパイラ（`hikec`）がコンパイル時に生成する `--export-symbols` 情報（例: `symbols.json`）を本ツールが直接読み込み、予約語リスト（`reservedNames` / `reservedStrings`）へ自動登録します。

これにより以下のハイブリッド保護を実現します：
1. **コンパイラ主導の確実なシンボル保護**: Hike コンパイラから直接出力された公開関数・変数名・システムシンボルを 100% 予約保護。
2. **AST 静的解析による JS 側インターフェース保護**: `runtime.js` 内のプロパティやグローバル識別子を自動抽出・保護。

---

## フォルダ構成

```text
hike-obfuscate-export-symbols/
├── build-obfuscate.sh               # Bash シェルスクリプト版難読化パイプライン
├── build-obfuscate-standalone.js    # Node.js / node_modules 依存なしの Pure JS 難読化スクリプト
├── build-obfuscate.js               # --export-symbols 対応の標準ビルドスクリプト
├── build-exe.bat                    # Deno を使って独立 .exe バイナリを作成するバッチスクリプト
├── test_comparison.js               # --export-symbols 連携動作検証＆ベンチマークテスト
├── sample_symbols.json              # hikec --export-symbols で出力されるシンボル定義のサンプル
├── runtime.js                       # Hike 標準 WebAssembly ランタイム
├── sample_qr.wasm                   # 検証用 Wasm モジュール
├── sample_wrapper.js                # 検証用 JS ラッパー
├── package.json                     # 依存パッケージ定義
├── LICENSE                          # MIT License
├── README.ja.md                     # 本ドキュメント (日本語)
└── README.md                        # 英語ドキュメント
```
