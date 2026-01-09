import * as fs from "fs";
import * as path from "path";
import {spawn} from "child_process";
import * as readline from "readline";

const BUILT_IN_COMMANDS = ["echo", "type", "exit"];

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

async function main(): Promise<void> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const prompt = (): void => {
        process.stdout.write("$ ");

        rl.once("line", (input) => {
            input = input.trim();

            if (input === "exit") {
                rl.close();
                return;
            }

            const parts = input.split(/\s+/);
            const commandName = parts[0];
            const commandArgs = parts.slice(1);

            if (commandName === "echo") {
                echoCommand(commandArgs.join(" "));
                prompt();
            } else if (commandName === "type") {
                typeCommand(commandArgs[0] || "");
                prompt();
            } else {
                // Check if command exists in PATH, then execute
                const executablePath = findInPath(commandName);
                if (executablePath) {
                    // Execute external program with inherited stdio
                    const child = spawn(commandName, commandArgs, {
                        stdio: "inherit",
                    });

                    child.on("close", () => {
                        prompt();
                    });

                    child.on("error", () => {
                        console.log(`${commandName}: command not found`);
                        prompt();
                    });
                } else {
                    console.log(`${commandName}: command not found`);
                    prompt();
                }
            }
        });
    };

    prompt();
}

main().catch(console.error);
