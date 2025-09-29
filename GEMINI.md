# GEMINI.md - Board Tycoon Project

## Project Overview

This project is a "Board Tycoon" game, a web-based board game similar to Monopoly, implemented with vanilla JavaScript, HTML, and CSS. The entire game runs as a single-page application from the `index.html` file.

The core logic is contained in `src/main.js`, which manages the game state, rules, player actions, and UI updates. The game features a sophisticated, extensible AI system documented in `docs/ai-guide-ja.md`, allowing for different AI player behaviors. The AI logic is handled by `src/ai/autoPlayer.js`, which includes a default heuristic agent.

A notable part of the development process is the `updateMarketRows.js` script, a Node.js script used to programmatically inject JavaScript code for the stock market UI into the main `index.html` file.

## Building and Running

This is a static web project with no build process or external frontend dependencies.

1.  **Serve the application:**
    *   Run the following command from the project root:
        ```bash
        npx http-server .
        ```
    *   Alternatively, you can use any static file server or your IDE's built-in server (like WebStorm's).

2.  **Access the game:**
    *   Open your web browser and navigate to `http://localhost:8080` (or the address provided by your server).

The `package.json` file is minimal and does not contain scripts for building or running the main application, although it defines a placeholder `test` script.

## Development Conventions

The project follows a set of conventions outlined in `AGENTS.md`:

*   **Structure:** Logic is centered in `src/main.js`, with UI in `index.html`. The AI system is modular.
*   **Code Style:**
    *   4-space indentation.
    *   Single quotes for JavaScript strings.
    *   `camelCase` for variables, `UPPER_SNAKE_CASE` for constants.
*   **Commits:** The project uses the Conventional Commits specification (e.g., `feat(board): ...`).
*   **Testing:** Current testing is manual. There are plans to introduce automated testing with Playwright or Vitest, with test files to be located in a `tests/` directory.
