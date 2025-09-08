Hashira Polynomial Solver
This project provides a tool to calculate the constant term ('c') of a polynomial using Lagrange Interpolation. Given a set of k points (x, y) that lie on a polynomial of degree m = k - 1, this tool can determine the value of the polynomial at x=0, which corresponds to its constant term.

The tool is designed to handle very large numbers using JavaScript's BigInt and can parse input values from various numerical bases (e.g., base 2, base 10, base 16).

Usage
You can use this tool in two ways: through a simple web interface or via the command line.

1. Web Frontend (index.html)
The easiest way to use the tool is with the interactive web frontend.

Prerequisites:

A modern web browser (Chrome, Firefox, Edge, etc.)

How to Run:

Ensure the index.html, testcase1.json, and testcase2.json files are all in the same directory.

Open the index.html file directly in your web browser.

You will be presented with two options:

Run Pre-defined Test Cases: Click the buttons to instantly calculate the results for the provided test files.

Upload a JSON File: Click the upload button to select your own JSON file and get the result.

2. Command-Line Tool (solve.js)
For command-line usage, you can run the solve.js script directly.

Prerequisites:

Node.js installed on your system.

How to Run:

Ensure the solve.js, testcase1.json, and testcase2.json files are all in the same directory.

Open your terminal or command prompt and navigate to that directory.

Run the following command:

node solve.js

The script will automatically process both testcase1.json and testcase2.json and print their respective constant terms to the console.
