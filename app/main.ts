import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const BUILT_IN_COMMANDS = ["echo", "type", "exit"];
const BUILT_IN_OPERATORS = ["|", "1>", ">", "2>", ">>"];

type ParsedCommand = {
  left: string;
  operator: string | null;
  right: ParsedCommand | string;
};

type CommandOutput = {
  stdout: string;
  stderr: string;
};

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

  if (parsed.operator === ">" || parsed.operator === "1>") {
    return handleRedirectInput(parsed.left, parsed.right as ParsedCommand);
  }

  if (parsed.operator === ">>") {
    return handleAppendStdout(parsed.left, parsed.right as ParsedCommand);
  }

  if (parsed.operator === "2>") {
    return handleRedirectError(parsed.left, parsed.right as ParsedCommand);
  }

  return { stdout: "", stderr: "" };
}

function handlePipeCommand(
  left: string,
  parsedRight: ParsedCommand,
): CommandOutput {
  const [leftCommand, leftArgs] = parseParts(left);
  const leftResult = handleCommand(leftCommand, leftArgs);

  const [rightCommand, rightArgs] = parseParts(parsedRight.left);

  return runExternalCommand(rightCommand, [rightArgs], leftResult.stdout);
}

function handleRedirectInput(
  left: string,
  parsedRight: ParsedCommand,
): CommandOutput {
  const [leftCommand, leftArgs] = parseParts(left);
  const leftResult = handleCommand(leftCommand, leftArgs);

  const filename = parsedRight.left.trim();
  fs.writeFileSync(filename, leftResult.stdout);
  return { stdout: "", stderr: leftResult.stderr };
}

function handleAppendStdout(
  left: string,
  parsedRight: ParsedCommand,
): CommandOutput {
  const [leftCommand, leftArgs] = parseParts(left);
  const leftResult = handleCommand(leftCommand, leftArgs);

  const filename = parsedRight.left.trim();
  fs.appendFileSync(filename, leftResult.stdout);
  return { stdout: "", stderr: leftResult.stderr };
}

function handleRedirectError(
  left: string,
  parsedRight: ParsedCommand,
): CommandOutput {
  const [leftCommand, leftArgs] = parseParts(left);
  const leftResult = handleCommand(leftCommand, leftArgs);

  const filename = parsedRight.left.trim();
  fs.writeFileSync(filename, leftResult.stderr);
  return { stdout: leftResult.stdout, stderr: "" };
}

async function main(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
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
