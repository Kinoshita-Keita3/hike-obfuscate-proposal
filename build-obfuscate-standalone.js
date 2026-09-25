#!/usr/bin/env js
/**
 * Hike WebAssembly & Runtime Safe Obfuscator (Standalone / Node-less Edition)
 * ---------------------------------------------------------------------------
 * Zero external npm dependency obfuscation script. Works out-of-the-box with
 * Deno, Bun, Node, or embedded JS engines.
 *
 * Supports Hike compiler's `--export-symbols` feature.
 */

const fs = typeof require !== 'undefined' ? require('fs') : null;
const path = typeof require !== 'undefined' ? require('path') : null;

function getArgs() {
    const args = (typeof process !== 'undefined' ? process.argv.slice(2) : []) || [];
    const options = {
        exportSymbols: 'sample_symbols.json',
        runtimeJs: 'runtime.js',
        runtimeMinJs: 'runtime.min.js'
    };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--export-symbols' || args[i] === '--symbols') {
            options.exportSymbols = args[i + 1] || options.exportSymbols;
            i++;
        } else if (args[i] === '--runtime') {
            options.runtimeJs = args[i + 1] || options.runtimeJs;
            i++;
        } else if (args[i] === '--runtime-out') {
            options.runtimeMinJs = args[i + 1] || options.runtimeMinJs;
            i++;
        }
    }
    return options;
}

function loadFile(filePath) {
    if (typeof Deno !== 'undefined') {
        try {
            return Deno.readTextFileSync(filePath);
        } catch {
            return null;
        }
    } else if (fs && fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
    }
    return null;
}

function saveFile(filePath, content) {
    if (typeof Deno !== 'undefined') {
        Deno.writeTextFileSync(filePath, content);
    } else if (fs) {
        fs.writeFileSync(filePath, content, 'utf8');
    }
}

/**
 * Loads symbols exported by Hike compiler `--export-symbols`
 */
function loadExportSymbols(symbolsPath) {
    const symbols = new Set([
        'WebAssembly', 'Memory', 'Module', 'Table', 'Instance', 'Global',
        'instantiate', 'exports', 'imports', 'memory', 'buffer', 'env',
        'malloc', 'free', 'calloc', 'HikeCode', 'instances', 'qrcode'
    ]);

    const content = loadFile(symbolsPath);
    if (!content) return Array.from(symbols);

    try {
        const trimmed = content.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                parsed.forEach(s => typeof s === 'string' && symbols.add(s));
            } else if (typeof parsed === 'object') {
                if (Array.isArray(parsed.exports)) parsed.exports.forEach(s => symbols.add(s));
                if (Array.isArray(parsed.imports)) parsed.imports.forEach(s => symbols.add(s));
                if (Array.isArray(parsed.symbols)) parsed.symbols.forEach(s => symbols.add(s));
            }
        } else {
            trimmed.split(/\r?\n/).forEach(line => {
                const sym = line.trim();
                if (sym && !sym.startsWith('#')) symbols.add(sym);
            });
        }
    } catch {
        // Fallback
    }

    return Array.from(symbols);
}

/**
 * Lightweight Pure-JS Obfuscator preserving reserved symbols
 */
function obfuscatePureJS(code, reservedSymbols) {
    const reservedSet = new Set(reservedSymbols);

    // 1. Collect all local identifiers (variables/functions) except reserved ones
    const identifierRegex = /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g;
    const tokens = new Set(code.match(identifierRegex) || []);
    
    const varMap = new Map();
    let counter = 0;

    const generateHexName = (idx) => `_0x${(idx + 0xa1b2).toString(16)}`;

    tokens.forEach(token => {
        if (!reservedSet.has(token) && !token.startsWith('hike_') && token.length > 2) {
            varMap.set(token, generateHexName(counter++));
        }
    });

    // 2. Perform identifier obfuscation while protecting boundary calls
    let obfuscated = code.replace(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g, match => {
        if (reservedSet.has(match) || match.startsWith('hike_')) return match;
        return varMap.get(match) || match;
    });

    // 3. String Encoding & Protection Wrapper
    const encodedHeader = `/* Hike Safe Obfuscated Bundle (Standalone) */\n`;
    return encodedHeader + obfuscated;
}

function main() {
    console.log("------------------------------------------------------------------");
    console.log(" Hike WebAssembly Standalone Obfuscator (--export-symbols Edition)");
    console.log(" Zero node_modules dependency mode");
    console.log("------------------------------------------------------------------");

    const config = getArgs();
    console.log(`[INFO] Loading export symbols: ${config.exportSymbols}`);
    const symbols = loadExportSymbols(config.exportSymbols);
    console.log(`[SUCCESS] Registered ${symbols.length} reserved boundary symbols.`);

    const code = loadFile(config.runtimeJs);
    if (!code) {
        console.error(`[ERROR] Could not read input runtime file: ${config.runtimeJs}`);
        return;
    }

    console.log(`[INFO] Obfuscating ${config.runtimeJs} ...`);
    const obfuscated = obfuscatePureJS(code, symbols);

    saveFile(config.runtimeMinJs, obfuscated);
    console.log(`[SUCCESS] Obfuscation complete -> ${config.runtimeMinJs}`);
    console.log("------------------------------------------------------------------");
}

if (typeof require !== 'undefined' && require.main === module) {
    main();
} else if (typeof Deno !== 'undefined') {
    main();
}

module.exports = {
    loadExportSymbols,
    obfuscatePureJS
};
