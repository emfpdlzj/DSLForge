import { registerCommands } from './commands';

export function activate(): void {
  registerCommands();
}

export function deactivate(): void {
  // Placeholder for future cleanup hooks.
}
