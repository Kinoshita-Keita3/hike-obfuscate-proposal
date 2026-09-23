#!/usr/bin/env node
/**
 * [Proposal / PoC] Hike WebAssembly & Runtime Safe Obfuscation Pipeline
 * ---------------------------------------------------------------------
 * 機能概要:
 *  1. hikec による WASM コンパイル (オプション)
 *  2. wasm-strip によるデバッグ情報・不要セクションの除去
 *  3. Babel AST 静的解析による runtime.js 内の Wasm インターフェース名・公開API名の自動抽出
 *  4. javascript-obfuscator による安全な高強度難読化 (runtime.min.js 出力)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const JavaScriptObfuscator = require('javascript-obfuscator');

// --- 設定・パス ---
const CONFIG = {
    hikeSource: process.env.HIKE_SRC || path.resolve(__dirname, './main.hike'),
    wasmOutput: process.env.WASM_OUT || path.resolve(__dirname, './main.wasm'),
    runtimeJs: process.env.RUNTIME_JS || path.resolve(__dirname, './runtime.js'),
    runtimeMinJs: process.env.RUNTIME_MIN_JS || path.resolve(__dirname, './runtime.min.js'),
    
    compileCommand: 'hikec build -target wasm32 "{src}" -o "{out}"',
    wasmStripCommand: 'wasm-strip "{wasm}"',
    
    // Wasm / Hike 標準システムキーワード
    baseReservedNames: [
        'WebAssembly',
        'Memory',
        'Module',
        'Table',
        'Instance',
        'Global',
        'CompileError',
        'LinkError',
        'RuntimeError',
        'instantiate',
        'instantiateStreaming',
        'compile',
        'compileStreaming',
        'validate',
        'instance',
        'exports',
        'imports',
        'memory',
        'buffer',
        'grow',
        'byteLength',
        'env',
        '__heap_base',
        '__data_end',
        '__indirect_function_table',
        'table',

        // Hike ランタイム共通インターフェース
        'HikeRuntime',
        'HikeConcurrentRuntime',
        'wasmUrl',
        'scriptUrl',
        'heapSizeKB',
        'setHeapSizeKB',
        'getHeapSizeKB',
        'onResult',
        'onLog',
        'onFrame',
        'start',
        'stop',
        'load',
        'terminate',
        'worker',
        'malloc',
        'calloc',
        'free',
        'postMessage',
        'onmessage',
        'data',
        '__hikeActiveRuntime',
        'setHikeHeapSizeKB',
        'getHikeHeapSizeKB'
    ]
};

const log = {
    info: (msg) => console.log(`\x1b[34m[INFO]\x1b[0m ${msg}`),
    success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
    warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
    error: (msg) => console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`)
};

function runCommand(command, desc) {
    log.info(`${desc} を実行中: ${command}`);
    try {
        execSync(command, { stdio: 'inherit' });
    } catch (err) {
        log.error(`${desc} が失敗しました。`);
        throw err;
    }
}

function isCommandAvailable(commandName) {
    try {
        const checkCmd = process.platform === 'win32' ? `where ${commandName}` : `which ${commandName}`;
        execSync(checkCmd, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function stepCompileHike() {
    log.info('=== ステップ 1: Hike Wasm コンパイル ===');
    if (!fs.existsSync(CONFIG.hikeSource)) {
        log.warn(`Hike ソースファイル (${path.basename(CONFIG.hikeSource)}) が見つからないため、既存の WASM を使用します。`);
        return;
    }

    if (!isCommandAvailable('hikec')) {
        log.warn('hikec コマンドが見つかりません。コンパイルをスキップします。');
        return;
    }

    const cmd = CONFIG.compileCommand
        .replace('{src}', CONFIG.hikeSource)
        .replace('{out}', CONFIG.wasmOutput);
    runCommand(cmd, 'Hike Wasm コンパイル');
}

function stepStripWasm() {
    log.info('=== ステップ 2: Wasm デバッグ情報の削除 (wasm-strip) ===');
    if (!fs.existsSync(CONFIG.wasmOutput)) {
        log.warn(`WASM ファイル (${path.basename(CONFIG.wasmOutput)}) が存在しないため、スキップします。`);
        return;
    }

    if (isCommandAvailable('wasm-strip')) {
        const cmd = CONFIG.wasmStripCommand.replace('{wasm}', CONFIG.wasmOutput);
        runCommand(cmd, 'wasm-strip');
    } else {
        log.warn('wasm-strip が見つかりません。デバッグ情報削除をスキップします。');
    }
}

function stepExtractInterfaceNames(jsCode) {
    log.info('=== ステップ 3: AST 静的解析によるインターフェース名自動抽出 ===');
    const reservedSet = new Set(CONFIG.baseReservedNames);

    let ast;
    try {
        ast = parser.parse(jsCode, {
            sourceType: 'unambiguous',
            plugins: ['classProperties', 'dynamicImport']
        });
    } catch (err) {
        log.error('Babel による AST パースに失敗しました。');
        throw err;
    }

    traverse(ast, {
        MemberExpression(nodePath) {
            const { object, property, computed } = nodePath.node;
            if (!computed && property && property.name) {
                if (
                    (object.type === 'MemberExpression' && object.property && object.property.name === 'exports') ||
                    (object.type === 'Identifier' && object.name === 'exports')
                ) {
                    reservedSet.add(property.name);
                }
                if (object.type === 'Identifier' && object.name === 'env') {
                    reservedSet.add(property.name);
                }
            }
        },
        ObjectProperty(nodePath) {
            const key = nodePath.node.key;
            if (key) {
                const name = key.type === 'Identifier' ? key.name : (key.type === 'StringLiteral' ? key.value : null);
                if (name && (name.startsWith('hike_') || name === 'malloc' || name === 'free' || name === 'calloc' || name === 'memory')) {
                    reservedSet.add(name);
                }
            }
        },
        AssignmentExpression(nodePath) {
            const { left } = nodePath.node;
            if (left.type === 'MemberExpression' && !left.computed) {
                const objName = left.object.name;
                if (objName === 'window' || objName === 'globalThis' || objName === 'global') {
                    if (left.property && left.property.name) {
                        reservedSet.add(left.property.name);
                    }
                }
            }
        },
        ClassDeclaration(nodePath) {
            if (nodePath.node.id && nodePath.node.id.name) {
                reservedSet.add(nodePath.node.id.name);
            }
        }
    });

    const reservedList = Array.from(reservedSet);
    log.info(`抽出・保持された予約語数: ${reservedList.length} 件`);
    return reservedList;
}

function stepObfuscate(jsCode, reservedNames) {
    log.info('=== ステップ 4: javascript-obfuscator による高強度難読化 ===');

    const obfuscationOptions = {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: false,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: true,
        renameGlobals: false,
        selfDefending: true,
        simplify: true,
        splitStrings: true,
        stringArray: true,
        stringArrayCallsTransform: true,
        stringArrayCallsTransformThreshold: 0.75,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.8,
        transformObjectKeys: false,
        reservedNames: reservedNames,
        reservedStrings: reservedNames
    };

    const obfuscationResult = JavaScriptObfuscator.obfuscate(jsCode, obfuscationOptions);
    return obfuscationResult.getObfuscatedCode();
}

async function main() {
    console.log('----------------------------------------------------');
    console.log(' Hike WebAssembly & Runtime Safe Obfuscation Build');
    console.log('----------------------------------------------------');

    try {
        stepCompileHike();
        stepStripWasm();

        if (!fs.existsSync(CONFIG.runtimeJs)) {
            throw new Error(`対象の runtime.js が見つかりません: ${path.basename(CONFIG.runtimeJs)}`);
        }
        log.info(`runtime.js を読み込み中: ${path.basename(CONFIG.runtimeJs)}`);
        const originalCode = fs.readFileSync(CONFIG.runtimeJs, 'utf8');

        const reservedNames = stepExtractInterfaceNames(originalCode);
        const obfuscatedCode = stepObfuscate(originalCode, reservedNames);

        log.info(`難読化コードを出力中: ${path.basename(CONFIG.runtimeMinJs)}`);
        fs.writeFileSync(CONFIG.runtimeMinJs, obfuscatedCode, 'utf8');

        const origSize = Buffer.byteLength(originalCode, 'utf8');
        const minSize = Buffer.byteLength(obfuscatedCode, 'utf8');
        log.success(`難読化完了! 元サイズ: ${(origSize / 1024).toFixed(2)} KB -> 難読化後: ${(minSize / 1024).toFixed(2)} KB`);
        log.success(`出力先: ${path.basename(CONFIG.runtimeMinJs)}`);
        console.log('----------------------------------------------------');
    } catch (error) {
        log.error(`ビルド処理中にエラーが発生しました: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    stepExtractInterfaceNames,
    stepObfuscate
};

