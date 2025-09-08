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
    if (!Number.isInteger(base) || base < 2 || base > 36) {
        throw new Error(`Invalid base ${base}. Supported bases are integers between 2 and 36.`);
    }

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
        if (digit === -1 || digit >= base) {
            throw new Error(`Invalid character '${ch}' for base ${base} in value "${valueString}".`);
        }
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

function findConstantTermFromFile(filePath) {
    const raw = fs.readFileSync(filePath, { encoding: 'utf8' });
    const trimmed = raw.trim();
    if (trimmed.length === 0) throw new Error('Input file is empty.');
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) throw new Error('Input file does not appear to contain a single JSON object.');

    let data;
    try {
        data = JSON.parse(trimmed);
    } catch (err) {
        throw new Error(`Failed to parse JSON: ${err.message}`);
    }

    if (!data.keys || typeof data.keys.k === 'undefined') throw new Error('Missing "keys.k" in JSON input.');
    const k = Number(data.keys.k);
    if (!Number.isInteger(k) || k <= 0) throw new Error(`Invalid keys.k: expected positive integer, got ${data.keys.k}`);

    const pts = [];
    for (const rawKey of Object.keys(data)) {
        if (rawKey === 'keys') continue;
        if (!/^-?\d+$/.test(rawKey)) throw new Error(`Invalid point key "${rawKey}". Point keys must be integer strings like "1","2",...`);
        const x = BigInt(rawKey);
        const entry = data[rawKey];
        if (!entry || typeof entry.value !== 'string' || typeof entry.base === 'undefined') throw new Error(`Invalid point entry for key ${rawKey}. Must be object with 'value' (string) and 'base'.`);
        const y = parseBigIntFromString(entry.value, parseInt(entry.base, 10));
        pts.push({ x, y });
    }

    if (pts.length < k) throw new Error(`Not enough data points: keys.k = ${k}, but only found ${pts.length} points.`);

    pts.sort((a, b) => {
        if (a.x < b.x) return -1;
        if (a.x > b.x) return 1;
        return 0;
    });

    const selected = pts.slice(0, k);

    for (let i = 1; i < selected.length; i++) {
        if (selected[i].x === selected[i - 1].x) throw new Error(`Duplicate x values among selected points: ${selected[i].x.toString()}`);
    }

    return computeConstantTermFromSelected(selected, k);
}

if (require.main === module) {
    const cwd = process.cwd();
    let files;
    try {
        files = fs.readdirSync(cwd);
    } catch (err) {
        console.error(`Failed to read current directory: ${err.message}`);
        process.exit(1);
    }

    const jsonFiles = files
        .filter(f => f.toLowerCase().endsWith('.json'))
        .filter(f => f !== 'package.json' && !f.startsWith('.'))
        .sort();

    if (jsonFiles.length === 0) {
        console.error('No .json files found in current directory. Place your JSON input files here and run `node robust_constant.js`.');
        process.exit(1);
    }

    for (const fname of jsonFiles) {
        const abs = path.resolve(cwd, fname);
        try {
            const [num, den] = findConstantTermFromFile(abs);
            if (den === 1n) {
                console.log(`${fname} => constant term (c) = ${num.toString()}`);
            } else {
                console.log(`${fname} => constant term (c) = ${num.toString()}/${den.toString()}`);
            }
        } catch (err) {
            console.error(`${fname} => ERROR: ${err.message}`);
            process.exitCode = 1;
        }
    }
}

module.exports = {
    parseBigIntFromString,
    findConstantTermFromFile,
    computeConstantTermFromSelected,
    bigIntGcd,
    reduceFraction,
};
