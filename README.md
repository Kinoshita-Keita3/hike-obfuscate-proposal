# [Proposal / PoC] Hike WebAssembly & Runtime Safe Obfuscation Pipeline

[日本語版 (Japanese README)](./README.ja.md)

> **Note**: This repository is a temporary, standalone Proof-of-Concept (PoC) proposal for the Hike Language development team. (Unmaintained / Archive-ready).

---

## 🎯 Purpose & Background

When shipping production WebAssembly modules compiled by the **Hike Language** alongside their companion JavaScript runtime (`runtime.js`), applying JavaScript obfuscators naively breaks the WebAssembly export/import boundaries (e.g., renaming `instance.exports.xxx` or `imports.env.malloc`).

This repository provides a reference implementation and benchmark demonstrating how **AST static analysis (Babel)** combined with `javascript-obfuscator` automatically extracts and protects Wasm interfaces, producing a fully functional, highly obfuscated runtime with **zero manual configuration and zero interface breakage**.

---

## 📁 Repository Structure

```text
├── package.json          # Dependencies (@babel/parser, @babel/traverse, javascript-obfuscator)
├── .gitignore            # Clean git ignore for node_modules / logs
├── build-obfuscate.js    # Automated build & AST interface extraction pipeline
├── runtime.js            # Standard Hike WebAssembly runtime
├── sample_qr.wasm        # Compiled sample Wasm module for verification
├── sample_wrapper.js     # Companion JS glue code for sample_qr.wasm
├── test_comparison.js    # Benchmark script comparing original vs obfuscated
└── README.md             # This document
```

---

## 📊 Verification & Benchmark Results

Ran 200 iterations of 2D Matrix Generation on WebAssembly using `sample_qr.wasm` and `sample_wrapper.js`:

| Metric | Original (Unmodified) | Obfuscated (Protected) | Result |
| :--- | :--- | :--- | :--- |
| **Wasm Binary Size** | 12.70 KB | 12.70 KB | **Unaltered (Safe)** |
| **JS Wrapper Size** | 15.69 KB | 36.75 KB | **2.3x (Control flow flattened)** |
| **Matrix Dimensions** | 29x29 | 29x29 | **100% Match ✅** |
| **Finder Pattern (`isDark`)** | `true` | `true` | **100% Match ✅** |
| **200 Iterations Time** | 1.19 ms | 2.32 ms | **+1.13 ms only** |
| **Throughput** | 167,715 ops/s | 86,044 ops/s | **Ultra-fast production speed ✅** |

---

## 🚀 How to Run the Verification

```bash
# 1. Install dependencies
npm install
# (or if using Deno): deno install --node-modules-dir=auto

# 2. Run the comparison test
npm test
# (or): node test_comparison.js
```

---

## 💡 Proposal for `hikec` Compiler Integration

Since the `hikec` compiler has complete internal knowledge of all exported functions, global variables, and imported host bindings, integrating this obfuscation pass directly into `hikec` (e.g. `hikec build --obfuscate`) would allow:
1. **Zero external configuration**: No need for users to configure Babel or reservation lists.
2. **Guaranteed interface safety**: Automatic preservation of Wasm/JS boundaries.
3. **Streamlined developer experience**: Single-command production build with `wasm-strip` and JS obfuscation.

