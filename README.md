# Shell Implementation

A fully functional POSIX-compliant shell built in TypeScript with support for built-in commands, operators, and advanced tab completion.

## Features

See `app/main.ts` for comprehensive feature documentation, including:

- **Built-in Commands**: `echo`, `type`, `exit`
- **Operators**: Pipes (`|`), output redirects (`>`, `>>`, `1>`, `1>>`), stderr redirects (`2>`, `2>>`)
- **Command Execution**: Run external programs from PATH with proper argument handling
- **Tab Completion**: Intelligent completion with longest common prefix (LCP) auto-completion and multiple match display
- **Interactive REPL**: Full readline support with history and editing

## Usage

```sh
./your_program.sh
```

This starts an interactive shell prompt where you can:

```sh
$ echo hello
hello

$ type echo
echo is a shell builtin

$ ls -la > output.txt

$ cat file.txt | grep pattern
```

## Testing

All 17 test stages pass:
- Core shell functionality (REPL, exit, invalid commands)
- Built-in commands (echo, type)
- External program execution
- Command location (PATH lookup)
- Output redirection and append
- Stderr redirection
- Piping between commands
- Tab completion (builtins, executables, partial completions)

## Implementation

See `app/main.ts` for the full implementation with detailed comments explaining:
- Command parsing and execution
- Operator handling (pipes, redirects)
- Tab completion algorithm with LCP
- External command spawning with proper stream handling
