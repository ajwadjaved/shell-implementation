import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const BUILT_IN_COMMANDS = ["echo", "type", "exit"];
const BUILT_IN_OPERATORS = ["|", ">"];

function echoCommand(query: string): void {
    console.log(query);
}

function findInPath(command: string): string | null {
    const pathEnv = process.env.PATH || "";
    const directories = pathEnv.split(":");

    for (const dir of directories) {
        const fullPath = path.join(dir, command);
        try {
            const stats = fs.statSync(fullPath);
            // check if the file is executable
            if (stats.isFile() && (stats.mode & 0o111) !== 0) {
                return fullPath;
            }
        } catch (e) {
            // File doesn't exist or not accessible, continue to next directory
        }
    }

    return null;
}

function typeCommand(query: string): void {
    // Check if it's a builtin first
    if (BUILT_IN_COMMANDS.includes(query)) {
        console.log(`${query} is a shell builtin`);
        return;
    }

    // Search through PATH
    const executablePath = findInPath(query);
    if (executablePath) {
        console.log(`${query} is ${executablePath}`);
    } else {
        console.log(`${query}: not found`);
    }
}

function handleCommand(commandAndQuery: string): void {
    const parts = commandAndQuery.split(' ')
    const command = parts[0];
    const query = parts.slice(1).join(' ');

    if (command === "echo") {
        echoCommand(query)
    } else if (command === "type") {
        typeCommand(query)
    }


}

function handlePipeCommand(left: string, parsedRight: ParsedCommand): void {
    return
}

function handleUnionCommand(left: string, parsedRight: ParsedCommand): void {
    return
}

type ParsedCommand = {
    left: string;
    operator: string | null;
    right: ParsedCommand | string;
}

function parseCommand(input: string): ParsedCommand {
    const operatorPositions = BUILT_IN_OPERATORS
        .map(op => ({op, index: input.indexOf(op)}))
        .filter(x => x.index !== -1);

    if (operatorPositions.length === 0) {
        return {left: input, operator: null, right: ""};
    }

    // Find the first operator
    const {op: operator, index: minIndex} = operatorPositions.reduce((a, b) =>
        a.index < b.index ? a : b
    );

    const left = input.substring(0, minIndex).trim();
    const right = input.substring(minIndex + operator.length).trim();


    if (operator !== null) {
        const parsedRight = parseCommand(right)

        if (operator === "|") {
            handlePipeCommand(left, parsedRight)
        }

        if (operator === ">") {
            handleUnionCommand(left, parsedRight)
        }

        return {left, operator, right: parsedRight}
    }

    handleCommand(left);


    return {left, operator, right};
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
            parseCommand(input);
            prompt();
        });
    };

    prompt();
}

main().catch(console.error);
