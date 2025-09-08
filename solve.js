#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function bigIntGcd(a, b) {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b !== 0n) {
        const t = a % b;
        a = b;
        b = t;
    }
    return a;
}

function reduceFraction(num, den) {
    if (den === 0n) throw new Error('Zero denominator in fraction reduction.');
    if (den < 0n) { num = -num; den = -den; }
    const g = bigIntGcd(num < 0n ? -num : num, den);
    return [num / g, den / g];
}

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const DIGIT_MAP = new Map(Array.from(DIGITS).map((c, i) => [c, i]));

function parseBigIntFromString(valueString, base) {
    if (typeof valueString !== 'string') throw new Error('Value must be a string.');
    base = Number(base);
    if (!Number.isInteger(base) || base < 2 || base > 36) throw new Error(`Invalid base ${base}. Supported bases are integers between 2 and 36.`);
    let s = valueString.trim();
    if (s.length === 0) throw new Error('Empty value string');
    let sign = 1n;
    if (s[0] === '+' || s[0] === '-') {
        if (s[0] === '-') sign = -1n;
        s = s.slice(1);
        if (s.length === 0) throw new Error('Invalid numeric string: only sign found.');
    }
    s = s.replace(/_/g, '');
    if (s.length === 0) throw new Error('Invalid numeric string after removing separators.');
    let result = 0n;
    const baseBig = BigInt(base);
    for (const ch of s) {
        const cl = ch.toLowerCase();
        const digit = DIGIT_MAP.has(cl) ? DIGIT_MAP.get(cl) : -1;
        if (digit === -1 || digit >= base) throw new Error(`Invalid character '${ch}' for base ${base} in value "${valueString}".`);
        result = result * baseBig + BigInt(digit);
    }
    return sign * result;
}

function computeConstantTermFromSelected(selectedPoints, k) {
    if (!Array.isArray(selectedPoints)) throw new Error('selectedPoints must be an array.');
    if (!Number.isInteger(k) || k <= 0) throw new Error('k must be positive integer.');
    if (selectedPoints.length < k) throw new Error(`Need at least k=${k} points; got ${selectedPoints.length}.`);
    let totalNum = 0n;
    let totalDen = 1n;
    for (let j = 0; j < k; j++) {
        const xj = selectedPoints[j].x;
        const yj = selectedPoints[j].y;
        let numerator = 1n;
        let denominator = 1n;
        for (let i = 0; i < k; i++) {
            if (i === j) continue;
            const xi = selectedPoints[i].x;
            if (xi === xj) throw new Error(`Duplicate x value found among selected points: x = ${xi.toString()}.`);
            numerator *= (0n - xi);
            denominator *= (xj - xi);
        }
        let termNum = yj * numerator;
        let termDen = denominator;
        [termNum, termDen] = reduceFraction(termNum, termDen);
        const newNum = totalNum * termDen + termNum * totalDen;
        const newDen = totalDen * termDen;
        [totalNum, totalDen] = reduceFraction(newNum, newDen);
    }
    if (totalDen === 0n) throw new Error('Final denominator is zero (unexpected).');
    return reduceFraction(totalNum, totalDen);
}

function extractFirstJsonObject(str) {
    const start = str.indexOf('{');
    if (start === -1) throw new Error('No JSON object found in input.');
    let depth = 0;
    let inString = false;
    for (let i = start; i < str.length; i++) {
        const ch = str[i];
        if (ch === '"' && str[i - 1] !== '\\') inString = !inString;
        if (inString) continue;
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        if (depth === 0) return str.slice(start, i + 1);
    }
    throw new Error('Could not find matching closing brace for JSON object.');
}

function findConstantTermFromString(jsonString) {
    const trimmed = jsonString.trim();
    if (trimmed.length === 0) throw new Error('Input is empty.');
    let parsed;
    try {
        parsed = JSON.parse(trimmed);
    } catch (err) {
        const firstObj = extractFirstJsonObject(trimmed);
        parsed = JSON.parse(firstObj);
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Top-level JSON must be an object.');
    if (!parsed.keys || typeof parsed.keys.k === 'undefined') throw new Error('Missing "keys.k" in JSON input.');
    const k = Number(parsed.keys.k);
    if (!Number.isInteger(k) || k <= 0) throw new Error(`Invalid keys.k: expected positive integer, got ${parsed.keys.k}`);
    const pts = [];
    for (const rawKey of Object.keys(parsed)) {
        if (rawKey === 'keys') continue;
        if (!/^-?\d+$/.test(rawKey)) throw new Error(`Invalid point key "${rawKey}". Point keys must be integer strings like "1","2",...`);
        const x = BigInt(rawKey);
        const entry = parsed[rawKey];
        if (!entry || typeof entry.base === 'undefined') throw new Error(`Invalid point entry for key ${rawKey}. Must be object with 'value' and 'base'.`);
        const rawValue = entry.value;
        let valueStr;
        if (typeof rawValue === 'string') valueStr = rawValue;
        else if (typeof rawValue === 'number' || typeof rawValue === 'bigint' || typeof rawValue === 'boolean') valueStr = String(rawValue);
        else throw new Error(`Invalid type for 'value' at key ${rawKey}: expected string, number, bigint or boolean.`);
        const y = parseBigIntFromString(valueStr, parseInt(entry.base, 10));
        pts.push({ x, y });
    }
    if (pts.length < k) throw new Error(`Not enough data points: keys.k = ${k}, but only found ${pts.length} points.`);
    pts.sort((a, b) => { if (a.x < b.x) return -1; if (a.x > b.x) return 1; return 0; });
    const selected = pts.slice(0, k);
    for (let i = 1; i < selected.length; i++) {
        if (selected[i].x === selected[i - 1].x) throw new Error(`Duplicate x values among selected points: ${selected[i].x.toString()}`);
    }
    return computeConstantTermFromSelected(selected, k);
}

function processJsonStringOrFileContent(content) {
    const [num, den] = findConstantTermFromString(content);
    return den === 1n ? num.toString() : `${num.toString()}/${den.toString()}`;
}

function processAllJsonFilesInCwd() {
    const cwd = process.cwd();
    let files;
    try {
        files = fs.readdirSync(cwd);
    } catch (err) {
        console.error(`Failed to read current directory: ${err.message}`);
        process.exit(1);
    }
    const jsonFiles = files.filter(f => f.toLowerCase().endsWith('.json')).filter(f => f !== 'package.json' && !f.startsWith('.')).sort();
    if (jsonFiles.length === 0) {
        console.error('No .json files found in current directory.');
        process.exit(1);
    }
    for (const fname of jsonFiles) {
        const abs = path.resolve(cwd, fname);
        try {
            const raw = fs.readFileSync(abs, 'utf8');
            const out = processJsonStringOrFileContent(raw);
            console.log(`${fname} => ${out}`);
        } catch (err) {
            console.error(`${fname} => ERROR: ${err.message}`);
            process.exitCode = 1;
        }
    }
}

function readStdinAndProcess() {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => input += chunk);
    process.stdin.on('end', () => {
        try {
            const out = processJsonStringOrFileContent(input);
            process.stdout.write(out + '\n');
        } catch (err) {
            console.error('ERROR:', err.message);
            process.exit(1);
        }
    });
}

if (process.stdin.isTTY) {
    processAllJsonFilesInCwd();
} else {
    readStdinAndProcess();
}

module.exports = {
    parseBigIntFromString,
    findConstantTermFromString,
    computeConstantTermFromSelected,
    bigIntGcd,
    reduceFraction
};
