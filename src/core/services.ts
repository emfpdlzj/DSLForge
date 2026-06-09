import { AdapterRegistry } from './adapterRegistry';
import { DiagnosticsPresenter } from './diagnosticsPresenter';
import { GrammarExplanationService } from './grammarExplanationService';
import { ProjectService } from './projectService';
import { ValidationOrchestrator } from './validationOrchestrator';
import { langiumAdapter } from '../langium/adapter';

const adapterRegistry = new AdapterRegistry([langiumAdapter]);

export const projectService = new ProjectService(adapterRegistry);
export const validationOrchestrator = new ValidationOrchestrator();
export const diagnosticsPresenter = new DiagnosticsPresenter();
export const grammarExplanationService = new GrammarExplanationService();
