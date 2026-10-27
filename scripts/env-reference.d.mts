export interface EnvRead {
  repo: string;
  file: string;
  line: number;
  url: string;
}

export interface EnvVariable {
  name: string;
  repos: string[];
  default: string | null;
  required: string;
  secret: boolean;
  description: string;
  docs?: string;
  pattern?: boolean;
  examples?: string[];
  readIn: EnvRead[];
  // undefined without the infra checkout; null when fantasy-infra doesn't set it.
  production?: {secret: boolean} | null;
}

export interface EnvReference {
  variables: EnvVariable[];
  complete: boolean;
  problems: string[];
}

export const metadataPath: string;
export function buildReference(root: string, options?: {scanRepos?: boolean}): EnvReference;
