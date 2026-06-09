import { createDslScaffold } from './createDslScaffold';
import { explainCurrentGrammar } from './explainCurrentGrammar';
import { generateSampleDsl } from './generateSampleDsl';
import { validateCurrentGrammar } from './validateCurrentGrammar';

export function registerCommands(): void {
  createDslScaffold();
  explainCurrentGrammar();
  generateSampleDsl();
  validateCurrentGrammar();
}
