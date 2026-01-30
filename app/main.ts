// ============================================================================
// SHELL IMPLEMENTATION
// ============================================================================

import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// ============================================================================
// CONSTANTS
// ============================================================================

const BUILT_IN_COMMANDS = ["echo", "type", "exit"];
const BUILT_IN_OPERATORS = ["|", "1>", ">", "2>", ">>", "1>>", "2>>"];

// ============================================================================
// TYPES
// ============================================================================

type ParsedCommand = {
  left: string;
  operator: string | null;
  right: ParsedCommand | string;
};

type CommandOutput = {
  stdout: string;
  stderr: string;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function findInPath(command: string): string | null {
  const pathEnv = process.env.PATH || "";
  const directories = pathEnv.split(":");

  for (const dir of directories) {
    const fullPath = path.join(dir, command);
    try {
      const stats = fs.statSync(fullPath);
      if (stats.isFile() && (stats.mode & 0o111) !== 0) {
        return fullPath;
      }
    } catch (e) {
      // File doesn't exist or not accessible, continue to next directory
    }
  }

  return null;
}

function parseParts(input: string): [string, string] {
  const parts = input.split(" ");
  let args = parts.slice(1).join(" ");

  // Strip surrounding quotes from arguments
  if (
    (args.startsWith("'") && args.endsWith("'")) ||
    (args.startsWith('"') && args.endsWith('"'))
  ) {
    args = args.slice(1, -1);
  }

  return [parts[0], args];
}

// ============================================================================
// BUILT-IN COMMANDS
// ============================================================================

function echoCommand(query: string): CommandOutput {
  return { stdout: query + "\n", stderr: "" };
}

function typeCommand(query: string): CommandOutput {
  // Check if it's a builtin first
  if (BUILT_IN_COMMANDS.includes(query)) {
    return { stdout: `${query} is a shell builtin\n`, stderr: "" };
  }

  // Search through PATH
  const executablePath = findInPath(query);
  if (executablePath) {
    return { stdout: `${query} is ${executablePath}\n`, stderr: "" };
  } else {
    return { stdout: `${query}: not found\n`, stderr: "" };
  }
}

// ============================================================================
// EXTERNAL COMMAND EXECUTION
// ============================================================================

function runExternalCommand(
  command: string,
  args: string[],
  input?: string,
): CommandOutput {
  const result = spawnSync(command, args, {
    input: input,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (result.error) {
    if ((result.error as any).code === "ENOENT") {
      return {
        stdout: "",
        stderr: `${command}: command not found\n`,
      };
    }
    return {
      stdout: "",
      stderr: `Error: ${result.error.message}\n`,
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

function handleCommand(command: string, query: string): CommandOutput {
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

function parseCommand(input: string): ParsedCommand {
  const operatorPositions = BUILT_IN_OPERATORS.map((op) => ({
    op,
    index: input.indexOf(op),
  })).filter((x) => x.index !== -1);

  if (operatorPositions.length === 0) {
    return { left: input, operator: null, right: "" };
  }

  // Find the first operator
  const { op: operator, index: minIndex } = operatorPositions.reduce((a, b) =>
    a.index < b.index ? a : b,
  );

  const left = input.substring(0, minIndex).trim();
  const right = input.substring(minIndex + operator.length).trim();

  if (operator !== null) {
    const parsedRight = parseCommand(right);
    return { left, operator, right: parsedRight };
  }

  return { left, operator, right };
}

function executeParsedCommand(parsed: ParsedCommand): CommandOutput {
  if (parsed.operator === null) {
    const [command, args] = parseParts(parsed.left);
    return handleCommand(command, args);
  }

  if (parsed.operator === "|") {
    return handlePipeCommand(parsed.left, parsed.right as ParsedCommand);
  }

  // Redirect stdout: > or 1>
  if (parsed.operator === ">" || parsed.operator === "1>") {
    return redirectOutput(
      parsed.left,
      parsed.right as ParsedCommand,
      "write",
      "stdout",
    );
  }

  // Append stdout: >> or 1>>
  if (parsed.operator === ">>" || parsed.operator === "1>>") {
    return redirectOutput(
      parsed.left,
      parsed.right as ParsedCommand,
      "append",
      "stdout",
    );
  }

  // Redirect stderr: 2>
  if (parsed.operator === "2>") {
    return redirectOutput(
      parsed.left,
      parsed.right as ParsedCommand,
      "write",
      "stderr",
    );
  }

  // Append stderr: 2>>
  if (parsed.operator === "2>>") {
    return redirectOutput(
      parsed.left,
      parsed.right as ParsedCommand,
      "append",
      "stderr",
    );
  }

  return { stdout: "", stderr: "" };
}

// ============================================================================
// OPERATOR HANDLERS
// ============================================================================

function handlePipeCommand(
  left: string,
  parsedRight: ParsedCommand,
): CommandOutput {
  const [leftCommand, leftArgs] = parseParts(left);
  const leftResult = handleCommand(leftCommand, leftArgs);

  const [rightCommand, rightArgs] = parseParts(parsedRight.left);

  return runExternalCommand(rightCommand, [rightArgs], leftResult.stdout);
}

/**
 * Redirect output to a file (write or append mode)
 * @param mode "write" (>) or "append" (>>)
 * @param stream "stdout" (1> or >>) or "stderr" (2> or 2>>)
 */
function redirectOutput(
  left: string,
  parsedRight: ParsedCommand,
  mode: "write" | "append",
  stream: "stdout" | "stderr",
): CommandOutput {
  const [leftCommand, leftArgs] = parseParts(left);
  const leftResult = handleCommand(leftCommand, leftArgs);

  const filename = parsedRight.left.trim();
  const content = stream === "stdout" ? leftResult.stdout : leftResult.stderr;

  if (mode === "write") {
    fs.writeFileSync(filename, content);
  } else {
    fs.appendFileSync(filename, content);
  }

  // When redirecting stdout, pass through stderr (so errors still print)
  // When redirecting stderr, pass through stdout (so output still prints)
  if (stream === "stdout") {
    return { stdout: "", stderr: leftResult.stderr };
  } else {
    return { stdout: leftResult.stdout, stderr: "" };
  }
}

// ============================================================================
// COMPLETER (TAB AUTOCOMPLETION)
// ============================================================================

let lastCompletionInput = "";
let lastCompletionMatches: string[] = [];

function getExecutablesStartingWith(prefix: string): string[] {
  const executables: string[] = [];
  const pathDirs = process.env.PATH?.split(":") || [];

  for (const dir of pathDirs) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.startsWith(prefix)) {
          // Check if executable
          const fullPath = path.join(dir, file);
          const stats = fs.statSync(fullPath);
          if (stats.isFile() && (stats.mode & 0o111) !== 0) {
            executables.push(file + " ");
          }
        }
      }
    } catch (e) {
      // Directory doesn't exist or not readable, skip it
    }
  }

  return [...new Set(executables)]; // Remove duplicates
}

function completer(line: string): [string[], string] {
  const builtins = ["echo", "exit"];
  const builtinMatches = builtins
    .filter((cmd) => cmd.startsWith(line))
    .map((cmd) => cmd + " ");

  // Get executables from PATH
  const executableMatches = getExecutablesStartingWith(line);

  // Combine and keep builtins first, then executables
  const allMatches = [...new Set([...builtinMatches, ...executableMatches])];

  // Check if this is a second TAB on the same input with multiple matches
  if (line === lastCompletionInput && lastCompletionMatches.length > 1) {
    // Second TAB: show the matches in alphabetical order
    const sortedMatches = lastCompletionMatches
      .map((m) => m.trim())
      .sort();
    const matchDisplay = sortedMatches.join("  ");
    process.stdout.write("\n" + matchDisplay + "\n");
    lastCompletionInput = "";
    return [[], line];
  }

  // Store current state for potential next TAB press
  lastCompletionInput = line;
  lastCompletionMatches = allMatches;

  if (allMatches.length > 1) {
    // First TAB with multiple matches: ring bell only
    process.stdout.write("\x07");
    return [[], line];
  }

  if (allMatches.length === 0 && line.length > 0) {
    process.stdout.write("\x07"); // Ring bell if no matches
    return [[], line];
  }

  // Single match or no matches with empty input: return for auto-completion
  return [allMatches, line];
}

// ============================================================================
// REPL (READ-EVAL-PRINT LOOP)
// ============================================================================

async function main(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: completer,
  });

  const prompt = (): void => {
    process.stdout.write("$ ");

    rl.once("line", (input) => {
      input = input.trim();
      const result = executeParsedCommand(parseCommand(input));
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
}

main().catch(console.error);
