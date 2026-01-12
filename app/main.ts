import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const BUILT_IN_COMMANDS = ["echo", "type", "exit"];
const BUILT_IN_OPERATORS = ["|", ">"];

type ParsedCommand = {
  left: string;
  operator: string | null;
  right: ParsedCommand | string;
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

function extractCommand(commandAndQuery: string): string {
  const parts = commandAndQuery.split(" ");
  return parts[0];
}

function extractQuery(commandAndQuery: string): string {
  const parts = commandAndQuery.split(" ");
  return parts.slice(1).join(" ");
}

function echoCommand(query: string): string {
  return query;
}

function typeCommand(query: string): string {
  // Check if it's a builtin first
  if (BUILT_IN_COMMANDS.includes(query)) {
    return `${query} is a shell builtin`;
  }

  // Search through PATH
  const executablePath = findInPath(query);
  if (executablePath) {
    return `${query} is ${executablePath}`;
  } else {
    return `${query}: not found`;
  }
}

function runExternalCommand(
  command: string,
  args: string[],
  input?: string,
): string {
  const result = spawnSync(command, args, {
    input: input,
    encoding: "utf-8",
  });

  if (result.error) {
    return `Error: ${result.error.message}`;
  }

  return result.stdout;
}

function handleCommand(command: string, query: string): string {
  if (command === "echo") {
    return echoCommand(query);
  }
  if (command === "type") {
    return typeCommand(query);
  }

  return `${command}: command not found`;
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

function executeParsedCommand(parsed: ParsedCommand): string {
  if (parsed.operator === null) {
    return handleCommand(
      extractCommand(parsed.left),
      extractQuery(parsed.left),
    );
  }

  if (parsed.operator === "|") {
    return handlePipeCommand(parsed.left, parsed.right as ParsedCommand);
  }

  // if (parsed.operator === ">") {
  //   return handleUnionCommand(parsed.left, parsed.right as ParsedCommand);
  // }
}

function handlePipeCommand(left: string, parsedRight: ParsedCommand): string {
  const leftResult = handleCommand(extractCommand(left), extractQuery(left));

  const rightCommand = extractCommand(parsedRight.left);
  const rightArgs = extractQuery(parsedRight.left);

  return runExternalCommand(rightCommand, [rightArgs], leftResult);
}

// function handleUnionCommand(left: string, parsedRight: ParsedCommand): void {
//   return;
// }

async function main(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (): void => {
    process.stdout.write("$ ");

    rl.once("line", (input) => {
      input = input.trim();
      console.log(executeParsedCommand(parseCommand(input)));
      prompt();
    });
  };

  prompt();
}

main().catch(console.error);
