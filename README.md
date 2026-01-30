# Shell Implementation

A fully functional POSIX-compliant shell built in TypeScript with support for built-in commands, operators, and advanced tab completion.

## Features

- Core shell functionality (REPL, exit, invalid commands)
- Built-in commands 
- External program execution
- Command location (PATH lookup)
- Output redirection and append
- Stderr redirection
- Piping between commands
- Tab completion (builtins, executables, partial completions)

## Implementation

See `app/main.ts` for the full implementation with comments explaining:
- Command parsing and execution
- Operator handling (pipes, redirects)
- Tab completion algorithm with LCP
- External command spawning with proper stream handling
