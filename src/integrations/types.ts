export type IntegrationCapability =
  | 'requirements'
  | 'specification'
  | 'design'
  | 'planning'
  | 'implementation'
  | 'review'
  | 'verification'
  | 'archive'
  | 'code-intelligence';

export interface PlatformIntegrationMapping {
  toolId?: string;
  agentId?: string | null;
}

export interface ComponentVerification {
  id: string;
  platforms: string[];
  capabilities: IntegrationCapability[];
  stageContracts: string[];
}

export interface IntegrationManifest {
  id: string;
  displayName: string;
  source: 'official' | 'local';
  management: 'smart' | 'user';
  capabilities: IntegrationCapability[];
  stageContracts: string[];
  platformMappings: Record<string, PlatformIntegrationMapping>;
  verification?: ComponentVerification;
  localTrust?: {
    digest: string;
    trusted: boolean;
  };
}

export class IntegrationRegistry {
  private readonly manifests: Map<string, IntegrationManifest>;

  constructor(manifests: IntegrationManifest[]) {
    this.manifests = new Map();
    for (const manifest of manifests) {
      if (this.manifests.has(manifest.id)) {
        throw new Error(`Duplicate integration manifest: ${manifest.id}`);
      }
      this.manifests.set(manifest.id, manifest);
    }
  }

  list(): IntegrationManifest[] {
    return [...this.manifests.values()];
  }

  get(id: string): IntegrationManifest | undefined {
    return this.manifests.get(id);
  }

  require(id: string): IntegrationManifest {
    const manifest = this.get(id);
    if (!manifest) throw new Error(`Unknown integration: ${id}`);
    return manifest;
  }

  has(id: string): boolean {
    return this.manifests.has(id);
  }
}
