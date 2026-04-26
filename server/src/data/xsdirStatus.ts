import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parseXsdir, XsdirData } from './xsdirParser';
import { normalizePath } from '../utils/serverUtils';

export interface XsdirStatus {
  state: 'unconfigured' | 'loaded' | 'not-found' | 'parse-error';
  configuredPath: string;
  resolvedFile?: string;
  zaidCount?: number;
  errorMessage?: string;
}

export interface XsdirLoadResult {
  data: XsdirData | undefined;
  status: XsdirStatus;
}

const XSDIR_FILENAMES = ['xsdir_mcnp6.3', 'xsdir_mcnp6.2', 'xsdir_mcnp6.1', 'xsdir'];

export function loadXsdirWithStatus(path: string): XsdirLoadResult {
  if (!path) {
    return { data: undefined, status: { state: 'unconfigured', configuredPath: '' } };
  }
  const normalized = normalizePath(path);

  for (const name of XSDIR_FILENAMES) {
    const xsdirPath = join(normalized, name);
    if (!existsSync(xsdirPath)) continue;
    try {
      const data = parseXsdir(readFileSync(xsdirPath, 'utf-8'));
      return {
        data,
        status: {
          state: 'loaded',
          configuredPath: path,
          resolvedFile: xsdirPath,
          zaidCount: data.entries.size,
        },
      };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      return {
        data: undefined,
        status: { state: 'parse-error', configuredPath: path, resolvedFile: xsdirPath, errorMessage },
      };
    }
  }

  return {
    data: undefined,
    status: {
      state: 'not-found',
      configuredPath: path,
      errorMessage: `No xsdir found in ${normalized} (looked for: ${XSDIR_FILENAMES.join(', ')})`,
    },
  };
}
