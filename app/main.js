"use strict";
// ============================================================================
// SHELL IMPLEMENTATION
// ============================================================================
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var child_process_1 = require("child_process");
var fs = require("fs");
var path = require("path");
var readline = require("readline");
// ============================================================================
// CONSTANTS
// ============================================================================
var BUILT_IN_COMMANDS = ["echo", "type", "exit"];
var BUILT_IN_OPERATORS = ["|", "1>", ">", "2>", ">>", "1>>", "2>>"];
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function findInPath(command) {
    var pathEnv = process.env.PATH || "";
    var directories = pathEnv.split(":");
    for (var _i = 0, directories_1 = directories; _i < directories_1.length; _i++) {
        var dir = directories_1[_i];
        var fullPath = path.join(dir, command);
        try {
            var stats = fs.statSync(fullPath);
            if (stats.isFile() && (stats.mode & 73) !== 0) {
                return fullPath;
            }
        }
        catch (e) {
            // File doesn't exist or not accessible, continue to next directory
        }
    }
    return null;
}
function parseParts(input) {
    var parts = input.split(" ");
    var args = parts.slice(1).join(" ");
    // Strip surrounding quotes from arguments
    if ((args.startsWith("'") && args.endsWith("'")) ||
        (args.startsWith('"') && args.endsWith('"'))) {
        args = args.slice(1, -1);
    }
    return [parts[0], args];
}
// ============================================================================
// BUILT-IN COMMANDS
// ============================================================================
function echoCommand(query) {
    return { stdout: query + "\n", stderr: "" };
}
function typeCommand(query) {
    // Check if it's a builtin first
    if (BUILT_IN_COMMANDS.includes(query)) {
        return { stdout: "".concat(query, " is a shell builtin\n"), stderr: "" };
    }
    // Search through PATH
    var executablePath = findInPath(query);
    if (executablePath) {
        return { stdout: "".concat(query, " is ").concat(executablePath, "\n"), stderr: "" };
    }
    else {
        return { stdout: "".concat(query, ": not found\n"), stderr: "" };
    }
}
// ============================================================================
// EXTERNAL COMMAND EXECUTION
// ============================================================================
function runExternalCommand(command, args, input) {
    var result = (0, child_process_1.spawnSync)(command, args, {
        input: input,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
    });
    if (result.error) {
        if (result.error.code === "ENOENT") {
            return {
                stdout: "",
                stderr: "".concat(command, ": command not found\n"),
            };
        }
        return {
            stdout: "",
            stderr: "Error: ".concat(result.error.message, "\n"),
        };
    }
    return {
        stdout: result.stdout || "",
        stderr: result.stderr || "",
    };
}
// ============================================================================
// COMMAND PARSING AND EXECUTION
// ============================================================================
function handleCommand(command, query) {
    if (command === "echo") {
        return echoCommand(query);
    }
    if (command === "type") {
        return typeCommand(query);
    }
    if (command === "exit") {
        process.exit(0);
    }
    return runExternalCommand(command, query.split(" "), "");
}
function parseCommand(input) {
    var operatorPositions = BUILT_IN_OPERATORS.map(function (op) { return ({
        op: op,
        index: input.indexOf(op),
    }); }).filter(function (x) { return x.index !== -1; });
    if (operatorPositions.length === 0) {
        return { left: input, operator: null, right: "" };
    }
    // Find the first operator
    var _a = operatorPositions.reduce(function (a, b) {
        return a.index < b.index ? a : b;
    }), operator = _a.op, minIndex = _a.index;
    var left = input.substring(0, minIndex).trim();
    var right = input.substring(minIndex + operator.length).trim();
    if (operator !== null) {
        var parsedRight = parseCommand(right);
        return { left: left, operator: operator, right: parsedRight };
    }
    return { left: left, operator: operator, right: right };
}
function executeParsedCommand(parsed) {
    if (parsed.operator === null) {
        var _a = parseParts(parsed.left), command = _a[0], args = _a[1];
        return handleCommand(command, args);
    }
    if (parsed.operator === "|") {
        return handlePipeCommand(parsed.left, parsed.right);
    }
    // Redirect stdout: > or 1>
    if (parsed.operator === ">" || parsed.operator === "1>") {
        return redirectOutput(parsed.left, parsed.right, "write", "stdout");
    }
    // Append stdout: >> or 1>>
    if (parsed.operator === ">>" || parsed.operator === "1>>") {
        return redirectOutput(parsed.left, parsed.right, "append", "stdout");
    }
    // Redirect stderr: 2>
    if (parsed.operator === "2>") {
        return redirectOutput(parsed.left, parsed.right, "write", "stderr");
    }
    // Append stderr: 2>>
    if (parsed.operator === "2>>") {
        return redirectOutput(parsed.left, parsed.right, "append", "stderr");
    }
    return { stdout: "", stderr: "" };
}
// ============================================================================
// OPERATOR HANDLERS
// ============================================================================
function handlePipeCommand(left, parsedRight) {
    var _a = parseParts(left), leftCommand = _a[0], leftArgs = _a[1];
    var leftResult = handleCommand(leftCommand, leftArgs);
    var _b = parseParts(parsedRight.left), rightCommand = _b[0], rightArgs = _b[1];
    return runExternalCommand(rightCommand, [rightArgs], leftResult.stdout);
}
/**
 * Redirect output to a file (write or append mode)
 * @param mode "write" (>) or "append" (>>)
 * @param stream "stdout" (1> or >>) or "stderr" (2> or 2>>)
 */
function redirectOutput(left, parsedRight, mode, stream) {
    var _a = parseParts(left), leftCommand = _a[0], leftArgs = _a[1];
    var leftResult = handleCommand(leftCommand, leftArgs);
    var filename = parsedRight.left.trim();
    var content = stream === "stdout" ? leftResult.stdout : leftResult.stderr;
    if (mode === "write") {
        fs.writeFileSync(filename, content);
    }
    else {
        fs.appendFileSync(filename, content);
    }
    // When redirecting stdout, pass through stderr (so errors still print)
    // When redirecting stderr, pass through stdout (so output still prints)
    if (stream === "stdout") {
        return { stdout: "", stderr: leftResult.stderr };
    }
    else {
        return { stdout: leftResult.stdout, stderr: "" };
    }
}
// ============================================================================
// Completer
// ============================================================================
function completer(line) {
    var builtins = ["echo", "exit"];
    var matches = builtins
        .filter(function (cmd) { return cmd.startsWith(line); })
        .map(function (cmd) { return cmd + " "; });
    if (matches.length === 0 && line.length > 0) {
        process.stdout.write("\x07");
    }
    return [matches, line];
}
// ============================================================================
// REPL (READ-EVAL-PRINT LOOP)
// ============================================================================
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var rl, prompt;
        return __generator(this, function (_a) {
            rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                completer: completer,
            });
            prompt = function () {
                process.stdout.write("$ ");
                rl.once("line", function (input) {
                    input = input.trim();
                    var result = executeParsedCommand(parseCommand(input));
                    if (result.stdout) {
                        process.stdout.write(result.stdout);
                    }
                    if (result.stderr) {
                        process.stderr.write(result.stderr);
                    }
                    prompt();
                });
            };
            prompt();
            return [2 /*return*/];
        });
    });
}
main().catch(console.error);
