# harness-hub Test Environment

This directory contains the test environment tooling for harness-hub development and integration testing.

## Overview

The test environment provides tools for:
- Creating isolated test environments for harness testing
- Generating test scenarios with predefined configurations
- Detecting and probing installed harnesses
- Managing ephemeral test environments

## Directory Structure

```
test/
├── flake.nix          # Nix development environment configuration
├── flake.lock         # Locked dependencies for the Nix environment
├── tools/             # CLI tools for environment management
│   ├── env.mjs        # Environment management CLI
│   ├── generate.mjs   # Scenario generation tool
│   ├── detect.mjs     # Harness detection tool
│   ├── probe.mjs      # Harness probing tool
│   └── template.test.ts # Tests for template functionality
├── template/          # Template files for new environments
│   ├── package.json   # Package configuration template
│   └── AGENTS.md     # Agent documentation template
└── env/               # (gitignored) Ephemeral test environments
```

## Getting Started

### Prerequisites

- Node.js >= 22.12.0
- Nix package manager (optional but recommended for pinned environments)

### Quick Start

1. **Create a test environment:**
   ```bash
   npm run create playground
   # or
   npm run init playground
   ```

2. **List existing environments:**
   ```bash
   npm run list
   ```

3. **Enter a pinned shell environment:**
   ```bash
   npm run shell
   # or for a specific environment:
   npm run shell playground
   ```

4. **Generate a test scenario:**
   ```bash
   npm run generate playground baseline
   ```

5. **Detect installed harnesses:**
   ```bash
   npm run detect
   ```

6. **Probe a specific harness:**
   ```bash
   npm run probe claude-code
   ```

7. **Remove an environment:**
   ```bash
   npm run remove playground
   ```

## Environment Management

### Creating Environments

```bash
npm run create [name]
```

Creates a new test environment in `test/env/[name]/` with:
- A git repository initialized
- Template files copied from `test/template/`
- Package.json customized with the environment name
- NPM link to the harness-hub CLI

If no name is provided, it defaults to "playground".

### Listing Environments

```bash
npm run list
```

Shows all existing test environments in `test/env/`.

### Removing Environments

```bash
npm run remove <name> [--yes]
```

Removes the specified environment. Use `--yes` to skip confirmation.

## Scenario Generation

### Generate Command

```bash
npm run generate <env-name> <scenario> [--target <dir>]
```

Generates a test scenario into the specified environment. Available scenarios:
- `baseline` - Basic setup with AGENTS.md and writing-tests skill
- `multi` - Multi-harness configuration
- And others defined in `test/tools/scenarios/`

## Harness Detection and Probing

### Detect

```bash
npm run detect
```

Lists all supported harnesses and shows which are installed on your system.

### Probe

```bash
npm run probe <harness-id>
```

Runs a test command against a specific harness to verify it's working correctly.

## Development

### Building Tools

```bash
npm run build:tools
```

Compiles TypeScript tools to JavaScript in `test/tools/dist/`.

### Running Tests

```bash
npm test
```

Runs all test suites including the environment tooling tests.

## Pinned Environments

For reproducible testing, use the Nix flake:

```bash
npm run shell
```

This enters a development shell with pinned versions of all harnesses defined in `config/config.json`.

## Configuration

The single source of truth for harness versions is `config/config.json` at the repository root.