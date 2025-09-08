const fs = require('fs');

/**
 * Parses a string representation of a number in a given base into a BigInt.
 * @param {string} stringValue - The string to parse.
 * @param {number} base - The numerical base.
 * @returns {BigInt} The resulting BigInt.
 */
function parseBigInt(stringValue, base) {
    const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = 0n;
    const baseBigInt = BigInt(base);
    for (const char of stringValue) {
        const digitValue = DIGITS.indexOf(char.toLowerCase());
        if (digitValue === -1 || digitValue >= base) {
            throw new Error(`Invalid character '${char}' for base ${base}`);
        }
        result = result * baseBigInt + BigInt(digitValue);
    }
    return result;
}

/**
 * Calculates the polynomial's constant term from a JSON file.
 * @param {string} filePath - The path to the input JSON file.
 * @returns {BigInt} The calculated constant term.
 */
function findConstantTerm(filePath) {
    const jsonString = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(jsonString);
    const k = data.keys.k;

    const allPoints = [];
    for (const key in data) {
        if (key !== 'keys') {
            const x = BigInt(key);
            const rootData = data[key];
            const y = parseBigInt(rootData.value, parseInt(rootData.base, 10));
            allPoints.push({ x, y });
        }
    }

    allPoints.sort((a, b) => (a.x < b.x ? -1 : 1));

    const selectedPoints = allPoints.slice(0, k);
    if (selectedPoints.length < k) {
        throw new Error(`Not enough points in file. Need ${k}, but found only ${selectedPoints.length}.`);
    }

    let constantTerm = 0n;
    for (let j = 0; j < k; j++) {
        const xj = selectedPoints[j].x;
        const yj = selectedPoints[j].y;

        let numerator = 1n;
        let denominator = 1n;

        for (let i = 0; i < k; i++) {
            if (i === j) continue;
            const xi = selectedPoints[i].x;
            numerator *= (0n - xi);
            denominator *= (xj - xi);
        }

        const term = (yj * numerator) / denominator;
        constantTerm += term;
    }

    return constantTerm;
}



try {
    console.log("Output for Test Case 1:");
    const result1 = findConstantTerm('testcase1.json');
    console.log(result1.toString());

    console.log("\nOutput for Test Case 2:");
    const result2 = findConstantTerm('testcase2.json');
    console.log(result2.toString());
} catch (error) {
    console.error(`An error occurred: ${error.message}`);
    process.exit(1);
}
