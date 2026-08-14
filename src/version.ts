export interface VersionInfo {
  version: string;
  build: number;
  buildId: string;
  commitSha: string;
  buildDate: string;
  minSupportedVersion: string;
}

declare const __VERSION_INFO__: VersionInfo;

export default __VERSION_INFO__;