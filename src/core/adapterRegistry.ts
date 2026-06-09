import type { DslAdapter } from './adapter';

export class AdapterRegistry {
  private readonly adapters: DslAdapter[];

  public constructor(adapters: DslAdapter[]) {
    this.adapters = [...adapters];
  }

  public all(): readonly DslAdapter[] {
    return this.adapters;
  }

  public getById(id: string): DslAdapter | undefined {
    return this.adapters.find((adapter) => adapter.id === id);
  }
}
