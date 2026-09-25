#!/usr/bin/env node
/**
 * Hike WebAssembly & Runtime Safe Obfuscation Pipeline (Community Fork)
 * ---------------------------------------------------------------------
 * Support for Hike compiler's `--export-symbols` feature.
 *
 * Feature Highlights:
 *  1. Hike Wasm compilation with `--export-symbols` (or `-export-symbols`) flag.
 *  2. Direct ingestion of Hike export/import symbol definitions into obfuscation reservation set.
 *  3. Hybrid protection combining `--export-symbols` metadata and Babel AST static analysis of runtime JS.
 *  4. High-strength obfuscation via javascript-obfuscator maintaining Wasm boundary safety.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const JavaScriptObfuscator = require('javascript-obfuscator');

// --- Command Line Argument Parser ---
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--export-symbols' || args[i] === '--symbols') {
            options.exportSymbols = args[i + 1] || 'symbols.json';
            i++;
        } else if (args[i] === '--src') {
            options.hikeSource = args[i + 1];
            i++;
        } else if (args[i] === '--out') {
            options.wasmOutput = args[i + 1];
            i++;
        } else if (args[i] === '--runtime') {
            options.runtimeJs = args[i + 1];
            i++;
        } else if (args[i] === '--runtime-out') {
            options.runtimeMinJs = args[i + 1];
            i++;
        }
    }
    return options;
}

const cliArgs = parseArgs();

// --- Configuration ---
const CONFIG = {
    hikeSource: cliArgs.hikeSource || process.env.HIKE_SRC || path.resolve(__dirname, './main.hike'),
    wasmOutput: cliArgs.wasmOutput || process.env.WASM_OUT || path.resolve(__dirname, './main.wasm'),
    runtimeJs: cliArgs.runtimeJs || process.env.RUNTIME_JS || path.resolve(__dirname, './runtime.js'),
    runtimeMinJs: cliArgs.runtimeMinJs || process.env.RUNTIME_MIN_JS || path.resolve(__dirname, './runtime.min.js'),
    exportSymbolsFile: cliArgs.exportSymbols || process.env.HIKE_EXPORT_SYMBOLS || path.resolve(__dirname, './sample_symbols.json'),
    
    compileCommand: 'hikec build -target wasm32 "{src}" -o "{out}" --export-symbols "{symbols}"',
    wasmStripCommand: 'wasm-strip "{wasm}"',
    
    // Wasm / Hike Standard System Keywords
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

        // Hike Runtime Common Interfaces
        'HikeRuntime',
        'HikeConcurrentRuntime',
        'HikeCode',
        'instances',
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
        'getHikeHeapSizeKB',
        'qrcode'
    ]
};

const log = {
    info: (msg) => console.log(`\x1b[34m[INFO]\x1b[0m ${msg}`),
    success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
    warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
    error: (msg) => console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`)
};

function runCommand(command, desc) {
    log.info(`${desc} Running command: ${command}`);
    try {
        execSync(command, { stdio: 'inherit' });
    } catch (err) {
        log.error(`${desc} failed.`);
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
    log.info('=== Step 1: Hike Wasm Compilation with --export-symbols ===');
    if (!fs.existsSync(CONFIG.hikeSource)) {
        log.warn(`Hike source (${path.basename(CONFIG.hikeSource)}) not found. Skipping compiler invocation, using existing artifacts.`);
        return;
    }

    if (!isCommandAvailable('hikec')) {
        log.warn('hikec binary not found in PATH. Skipping compilation.');
        return;
    }

    const cmd = CONFIG.compileCommand
        .replace('{src}', CONFIG.hikeSource)
        .replace('{out}', CONFIG.wasmOutput)
        .replace('{symbols}', CONFIG.exportSymbolsFile);
    runCommand(cmd, 'Hike Wasm Compile with --export-symbols');
}

function stepStripWasm() {
    log.info('=== Step 2: Wasm Debug Section Stripping (wasm-strip) ===');
    if (!fs.existsSync(CONFIG.wasmOutput)) {
        log.warn(`Wasm file (${path.basename(CONFIG.wasmOutput)}) not found. Skipping wasm-strip.`);
        return;
    }

    if (isCommandAvailable('wasm-strip')) {
        const cmd = CONFIG.wasmStripCommand.replace('{wasm}', CONFIG.wasmOutput);
        runCommand(cmd, 'wasm-strip');
    } else {
        log.warn('wasm-strip command not found. Skipping debug section stripping.');
    }
}

/**
 * Loads symbols exported by Hike compiler via `--export-symbols`
 */
function stepLoadExportSymbols(symbolsPath) {
    log.info(`=== Step 3: Loading Symbols from --export-symbols File ===`);
    const symbols = new Set();
    
    if (!fs.existsSync(symbolsPath)) {
        log.warn(`Export symbols file not found at: ${symbolsPath}. Skipping file-based symbol reservation.`);
        return Array.from(symbols);
    }

    try {
        const content = fs.readFileSync(symbolsPath, 'utf8').trim();
        if (content.startsWith('{') || content.startsWith('[')) {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                parsed.forEach(s => typeof s === 'string' && symbols.add(s));
            } else if (typeof parsed === 'object' && parsed !== null) {
                if (Array.isArray(parsed.exports)) parsed.exports.forEach(s => symbols.add(s));
                if (Array.isArray(parsed.imports)) parsed.imports.forEach(s => symbols.add(s));
                if (Array.isArray(parsed.symbols)) parsed.symbols.forEach(s => symbols.add(s));
            }
        } else {
            // Plain text (one symbol per line)
            content.split(/\r?\n/).forEach(line => {
                const sym = line.trim();
                if (sym && !sym.startsWith('#')) symbols.add(sym);
            });
        }
        log.success(`Loaded ${symbols.size} exported symbols from: ${path.basename(symbolsPath)}`);
    } catch (err) {
        log.error(`Failed to parse symbols file (${symbolsPath}): ${err.message}`);
    }

    return Array.from(symbols);
}

/**
 * Extracts interface names via AST static analysis and merges with --export-symbols metadata
 */
function stepExtractInterfaceNames(jsCode, extraExportSymbols = []) {
    log.info('=== Step 4: AST Static Analysis & Symbol Merging ===');
    const reservedSet = new Set([...CONFIG.baseReservedNames, ...extraExportSymbols]);

    let ast;
    try {
        ast = parser.parse(jsCode, {
            sourceType: 'unambiguous',
            plugins: ['classProperties', 'dynamicImport']
        });
    } catch (err) {
        log.error('Babel AST parse error.');
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
                if (object.type === 'Identifier' && object.name === 'instances') {
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
                const objName = left.object ? left.object.name : null;
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
    log.info(`Total reserved interface names count: ${reservedList.length}`);
    return reservedList;
}

function stepObfuscate(jsCode, reservedNames) {
    log.info('=== Step 5: High-Strength JS Obfuscation ===');

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
    console.log(' Hike WebAssembly Safe Obfuscation (--export-symbols)');
    console.log('----------------------------------------------------');

    try {
        stepCompileHike();
        stepStripWasm();

        const exportSymbols = stepLoadExportSymbols(CONFIG.exportSymbolsFile);

        if (!fs.existsSync(CONFIG.runtimeJs)) {
            throw new Error(`Target runtime.js not found at: ${CONFIG.runtimeJs}`);
        }
        log.info(`Reading target runtime.js: ${path.basename(CONFIG.runtimeJs)}`);
        const originalCode = fs.readFileSync(CONFIG.runtimeJs, 'utf8');

        const reservedNames = stepExtractInterfaceNames(originalCode, exportSymbols);
        const obfuscatedCode = stepObfuscate(originalCode, reservedNames);

        log.info(`Writing obfuscated code to: ${path.basename(CONFIG.runtimeMinJs)}`);
        fs.writeFileSync(CONFIG.runtimeMinJs, obfuscatedCode, 'utf8');

        const origSize = Buffer.byteLength(originalCode, 'utf8');
        const minSize = Buffer.byteLength(obfuscatedCode, 'utf8');
        log.success(`Obfuscation successful! Original: ${(origSize / 1024).toFixed(2)} KB -> Obfuscated: ${(minSize / 1024).toFixed(2)} KB`);
        log.success(`Output: ${path.basename(CONFIG.runtimeMinJs)}`);
        console.log('----------------------------------------------------');
    } catch (error) {
        log.error(`Build failed: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    stepLoadExportSymbols,
    stepExtractInterfaceNames,
    stepObfuscate
};
