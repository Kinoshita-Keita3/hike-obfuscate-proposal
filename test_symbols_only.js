const { stepLoadExportSymbols, stepExtractInterfaceNames } = require('./build-obfuscate.js');
const path = require('path');
const fs = require('fs');

console.log('Testing stepLoadExportSymbols...');
const symbols = stepLoadExportSymbols(path.resolve(__dirname, './sample_symbols.json'));
console.log('Loaded symbols:', symbols);

const sampleJs = `
function hello() {
    return window.instances.gen_qr_lite.exports.main();
}
`;

console.log('Testing stepExtractInterfaceNames...');
const reserved = stepExtractInterfaceNames(sampleJs, symbols);
console.log('Reserved names count:', reserved.length);
console.log('Sample reserved names includes "gen_qr_lite":', reserved.includes('gen_qr_lite'));
console.log('Sample reserved names includes "hike_matrix_create":', reserved.includes('hike_matrix_create'));
console.log('SUCCESS!');
