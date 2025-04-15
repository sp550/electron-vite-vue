# Configuration Migration Plan

## Overview

This document outlines the plan for migrating the configuration and app data storage for the application. The goal is to ensure that the application can store and retrieve configuration data reliably, even in a packaged environment, without relying on the local userdata directory.

## Requirements

*   The application must be able to store and retrieve configuration data in both development and production environments.
*   The application must not rely on the local userdata directory for storing configuration data.
*   The location of the data directory (containing patient database, patient JSON, etc.) must be configurable by the user via the UI.
*   The configuration file (`config.json`) must be writable in the production environment.

## Final Plan

1.  **`config.json` Location:**
    *   **Development Environment:** `public/config.json`
    *   **Production Environment:** Placed adjacent to the executable. If not present, a new one is created on app startup.

2.  **`dataDirectory` Location:**
    *   The location of the `dataDirectory` (containing patient database, patient JSON, etc.) will be specified inside `config.json`.
    *   The user will be able to change this location via the UI in the app.

## Detailed Steps

1.  **Modify `useConfig.ts`:**
    *   Implement logic to determine the environment (development or production). Use `app.isPackaged` to determine the environment.
    *   Based on the environment, load the `config.json` file from the appropriate location (`public/config.json` in development, or adjacent to the executable in production).
    *   In production, if the `config.json` is not found next to the executable, create a new one using the default configuration.
    *   Use `window.electronAPI.readFileAbsolute` to read the `config.json` file.
    *   The `dataDirectory` will be read from the `config.json` file.
    *   Implement the logic to save the `config.json` file. In production, the changes should be saved to the `config.json` file located next to the executable.

2.  **Update `electron/main/index.ts`:**
    *   Expose a function via `ipcMain` to get the application's base directory (where the executable is located). This can be used by the renderer process to construct absolute paths to files within the application's directory structure, including the `config.json`. Use `app.getAppPath()` to get the application path.
    *   Implement the logic to create a new `config.json` next to the executable if it doesn't exist on app startup in production.

3.  **Modify `public/config.json`:**
    *   This file will serve as the default configuration in development and the initial configuration in production.
    *   It will contain the initial value for the `dataDirectory`.

4.  **Update `src/App.vue` or a dedicated settings component:**
    *   Implement a UI that allows the user to change the `dataDirectory`.
    *   When the user changes the `dataDirectory`, update the `config.json` file and persist the changes.

## Mermaid Diagram

```mermaid
graph LR
    A[App Start] --> B{Environment?};
    B -- Development --> C[Load config.json from public/config.json];
    B -- Production --> D[Load config.json next to executable];
    D -- config.json found --> E[Read dataDirectory from config.json];
    D -- config.json not found --> F[Create new config.json with default values];
    F --> G[Write new config.json next to executable];
    G --> E;
    C --> E;
    E --> H[Load patient data and notes from dataDirectory];
    I[User changes dataDirectory in UI] --> J[Update config.json];
    J --> K[Persist changes next to executable];