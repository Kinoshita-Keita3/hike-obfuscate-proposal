# Hike WebAssembly & Runtime Safe Obfuscation Tool (`--export-symbols` Edition)

A high-strength, WebAssembly-safe obfuscation build pipeline for [Hike Programming Language (hike-lang)](https://github.com/hike-lang/hike-lang) programs (`*.wasm`) and auto-generated JavaScript glue code (`runtime.js`).

Natively supports the newly added `--export-symbols` option from the Hike compiler.

---

## ⚠️ Maintenance Notice & Freedom to Fork

- **Unmaintained Status**: This repository is published as a proof-of-concept reference implementation. **The author does not possess deep compiler/obfuscation expertise and will not actively maintain, fix bugs, or provide updates to this project.**
- **Encouragement to Fork**: Feel free to **fork this repository**, modify, customize, fix bugs, or adapt it to your own needs without restriction.

---

## License (MIT License)

This repository is licensed under the **MIT License**. Free to use, modify, fork, and distribute for commercial or non-commercial purposes.

---

## Comparison: Ordinary Obfuscator vs. Hike Safe Obfuscator

| Metric / Feature | Ordinary Obfuscator (Terser, UglifyJS, Standard Obfuscator) | Hike Safe Obfuscator (`--export-symbols` Edition) |
| :--- | :--- | :--- |
| **Wasm Boundary Safety** | **Unsafe / Crashes**<br>Obfuscates Wasm export/import interfaces (`instance.exports.malloc`, etc.) causing runtime crashes | **100% Safe (Bulletproof)**<br>Ingests `--export-symbols` metadata to automatically protect all Wasm/JS boundary symbols |
| **Obfuscation Strength** | Forced to reduce protection levels to prevent boundary breakage | **Maximum Strength**<br>Enables high-strength control flow flattening and string encoding with zero runtime errors |
| **Configuration Effort** | Manual symbol discovery & tedious reservation list maintenance | **Zero-Config**<br>Automatically ingests symbols from Hike compiler's `--export-symbols` flag |
| **CLI / Shell Pipeline** | Usually requires heavy Node.js build tools | **Bash Script & Standalone Binary Included**<br>Run directly via `./build-obfuscate.sh` or single executable |

---

## Benchmark Results (Performance & Size Comparison)

Verified using `sample_qr.wasm` and `sample_wrapper.js` across 200 continuous 2D matrix generations:

| Metric | Original (Unmodified) | Obfuscated (`--export-symbols` Protected) | Result / Delta |
| :--- | :--- | :--- | :--- |
| **Wasm Binary Size** | 12.70 KB | 12.70 KB | **Identical (Wasm Unaltered)** |
| **JS Wrapper Size** | 15.69 KB | 36.75 KB | **~2.3x (Control Flow Flattening)** |
| **Matrix Dimension** | 29x29 | 29x29 | **100% Match** |
| **Finder Pattern (`isDark`)** | `true` | `true` | **100% Match** |
| **Execution Time (200 ops)**| 1.19 ms | 2.32 ms | **+1.13 ms (Minimal overhead)** |
| **Throughput** | 167,715 ops/sec | 86,044 ops/sec | **Ultra-fast production ready** |

---

## Acknowledgements

We express our sincere gratitude and appreciation to:

### 1. Authors & Maintainers of Underlying Obfuscation Tools (`javascript-obfuscator` & `Babel`)
Heartfelt thanks to the author and maintainers of [javascript-obfuscator](https://github.com/javascript-obfuscator/javascript-obfuscator) and the [Babel](https://babeljs.io/) team (`@babel/parser`, `@babel/traverse`). Your excellent obfuscation engine and AST parsing foundation make robust Wasm boundary protection possible.

### 2. The Author & Core Team of the Hike Programming Language
Deepest thanks to the author and core team of the [Hike Programming Language (hike-lang)](https://github.com/hike-lang/hike-lang). We greatly appreciate your support and implementation of the `--export-symbols` option in `hikec`, enabling bulletproof Wasm obfuscation integration.

---

## Bash Shell Script Edition (`build-obfuscate.sh`)

You can run the obfuscation pipeline directly via Bash without executing node files manually:

```bash
chmod +x build-obfuscate.sh
./build-obfuscate.sh --export-symbols sample_symbols.json
```

---

## Standalone Support (Node-less & Single Executable)

### 1. Pure JS Standalone Script (`build-obfuscate-standalone.js`)
Zero external npm dependencies:

```bash
deno run -A build-obfuscate-standalone.js --export-symbols sample_symbols.json
```

### 2. Deno Standalone Binary (`.exe`)
Compile into a single self-contained executable with Deno without requiring Node.js:

```bash
deno compile --allow-read --allow-write --allow-run --output hike-obfuscate.exe build-obfuscate-standalone.js
./hike-obfuscate.exe --export-symbols sample_symbols.json
```
