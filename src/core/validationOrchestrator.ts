import type { ResolvedProjectContext } from './projectService';
import type { ValidationRunResult } from '../types';

export class ValidationOrchestrator {
  public async prepareValidation(
    projectContext: ResolvedProjectContext
  ): Promise<ValidationRunResult> {
    const plan = await projectContext.adapter.planValidation({
      project: projectContext.detection,
      context: projectContext.context
    });

    if (plan.command.source === 'missing') {
      return {
        status: 'needs_configuration',
        summary: 'Validation command configuration is required before validation can run.',
        plan,
        issues: []
      };
    }

    return {
      status: 'ready',
      summary: 'Validation orchestration is ready. Command execution will be implemented next.',
      plan,
      issues: []
    };
  }
}
