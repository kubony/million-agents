import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import type { SkillCredential } from './skillGeneratorService';

interface CredentialStatus {
  credential: SkillCredential;
  configured: boolean;
  value?: string; // Only for display (masked for api_key)
}

interface CredentialsCheckResult {
  allConfigured: boolean;
  credentials: CredentialStatus[];
}

class CredentialsService {
  /**
   * Check if all required credentials for a skill are configured
   */
  async checkCredentials(
    skillPath: string,
    projectPath: string
  ): Promise<CredentialsCheckResult> {
    // Load credentials.json from skill folder
    const credentialsFile = path.join(skillPath, 'credentials.json');

    if (!existsSync(credentialsFile)) {
      return { allConfigured: true, credentials: [] };
    }

    const credentialsJson = await fs.readFile(credentialsFile, 'utf-8');
    const credentials: SkillCredential[] = JSON.parse(credentialsJson);

    if (!credentials || credentials.length === 0) {
      return { allConfigured: true, credentials: [] };
    }

    const statuses: CredentialStatus[] = [];
    let allConfigured = true;

    for (const cred of credentials) {
      const status = await this.checkSingleCredential(cred, projectPath);
      statuses.push(status);
      if (cred.required && !status.configured) {
        allConfigured = false;
      }
    }

    return { allConfigured, credentials: statuses };
  }

  /**
   * Check if a single credential is configured
   */
  private async checkSingleCredential(
    cred: SkillCredential,
    projectPath: string
  ): Promise<CredentialStatus> {
    if (cred.type === 'api_key') {
      // Check .env file
      const envPath = path.join(projectPath, '.env');
      if (existsSync(envPath)) {
        const envContent = await fs.readFile(envPath, 'utf-8');
        const regex = new RegExp(`^${cred.envVar}=(.+)$`, 'm');
        const match = envContent.match(regex);
        if (match && match[1].trim()) {
          return {
            credential: cred,
            configured: true,
            value: this.maskValue(match[1].trim()),
          };
        }
      }
      return { credential: cred, configured: false };
    } else if (cred.type === 'service_account' || cred.type === 'oauth') {
      // Check .credentials folder
      const credPath = path.join(projectPath, '.credentials', cred.envVar);
      if (existsSync(credPath)) {
        return {
          credential: cred,
          configured: true,
          value: cred.envVar,
        };
      }
      return { credential: cred, configured: false };
    }

    return { credential: cred, configured: false };
  }

  /**
   * Mask a value for display (show first 4 and last 4 characters)
   */
  private maskValue(value: string): string {
    if (value.length <= 8) {
      return '****';
    }
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }

  /**
   * Save a credential
   */
  async saveCredential(
    cred: SkillCredential,
    value: string,
    projectPath: string
  ): Promise<void> {
    if (cred.type === 'api_key') {
      await this.saveApiKey(cred.envVar, value, projectPath);
    } else if (cred.type === 'service_account' || cred.type === 'oauth') {
      await this.saveCredentialFile(cred.envVar, value, projectPath);
    }

    // Ensure .gitignore exists and has proper entries
    await this.ensureGitignore(projectPath);
  }

  /**
   * Save API key to .env file
   */
  private async saveApiKey(
    envVar: string,
    value: string,
    projectPath: string
  ): Promise<void> {
    const envPath = path.join(projectPath, '.env');
    let envContent = '';

    if (existsSync(envPath)) {
      envContent = await fs.readFile(envPath, 'utf-8');
    }

    // Check if the variable already exists
    const regex = new RegExp(`^${envVar}=.*$`, 'm');
    if (regex.test(envContent)) {
      // Replace existing
      envContent = envContent.replace(regex, `${envVar}=${value}`);
    } else {
      // Add new
      if (envContent && !envContent.endsWith('\n')) {
        envContent += '\n';
      }
      envContent += `${envVar}=${value}\n`;
    }

    await fs.writeFile(envPath, envContent, 'utf-8');
  }

  /**
   * Save credential file (service account JSON or OAuth tokens)
   */
  private async saveCredentialFile(
    filename: string,
    content: string,
    projectPath: string
  ): Promise<void> {
    const credentialsDir = path.join(projectPath, '.credentials');
    await fs.mkdir(credentialsDir, { recursive: true });

    const filePath = path.join(credentialsDir, filename);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Ensure .gitignore has entries for credentials
   */
  async ensureGitignore(projectPath: string): Promise<void> {
    const gitignorePath = path.join(projectPath, '.gitignore');
    const requiredEntries = [
      '# Credentials - DO NOT COMMIT',
      '.env',
      '.credentials/',
      '*.pem',
      '*.key',
      '*_credentials.json',
      'service_account*.json',
    ];

    let gitignoreContent = '';
    if (existsSync(gitignorePath)) {
      gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
    }

    const linesToAdd: string[] = [];
    for (const entry of requiredEntries) {
      // Skip comments when checking
      if (entry.startsWith('#')) {
        if (!gitignoreContent.includes(entry)) {
          linesToAdd.push(entry);
        }
        continue;
      }
      // Check if entry exists (exact match or without trailing /)
      const entryWithoutSlash = entry.replace(/\/$/, '');
      if (!gitignoreContent.includes(entry) && !gitignoreContent.includes(entryWithoutSlash)) {
        linesToAdd.push(entry);
      }
    }

    if (linesToAdd.length > 0) {
      if (gitignoreContent && !gitignoreContent.endsWith('\n')) {
        gitignoreContent += '\n';
      }
      if (gitignoreContent) {
        gitignoreContent += '\n';
      }
      gitignoreContent += linesToAdd.join('\n') + '\n';
      await fs.writeFile(gitignorePath, gitignoreContent, 'utf-8');
    }
  }

  /**
   * Save credentials.json to skill folder when generating skill
   */
  async saveCredentialsMetadata(
    skillPath: string,
    credentials: SkillCredential[]
  ): Promise<void> {
    if (!credentials || credentials.length === 0) {
      return;
    }

    const credentialsFile = path.join(skillPath, 'credentials.json');
    await fs.writeFile(
      credentialsFile,
      JSON.stringify(credentials, null, 2),
      'utf-8'
    );
  }
}

export const credentialsService = new CredentialsService();
