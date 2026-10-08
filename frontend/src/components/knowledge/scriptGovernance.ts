import type { CreateScriptInput } from '../../api/knowledgeApi';
import type { KnowledgeScript, ScriptParameter, ScriptRisk } from '../../types/knowledge';
import { parseParams } from './scriptParams';

/** Everything that makes a script a governed, runnable fix - beyond title/content. */
export interface GovernanceForm {
  scriptKey: string;
  riskLevel: ScriptRisk;
  requiresAdmin: boolean;
  timeoutSeconds: number;
  issueMatch: string;
  autoRun: boolean;
  params: ScriptParameter[];
  checkScript: string;
  verifyScript: string;
  undoScript: string;
}

export function governanceFrom(script?: KnowledgeScript | null): GovernanceForm {
  return {
    scriptKey: script?.scriptKey ?? '',
    riskLevel: script?.riskLevel ?? 'MEDIUM',
    requiresAdmin: script?.requiresAdmin ?? false,
    timeoutSeconds: script?.timeoutSeconds ?? 120,
    issueMatch: script?.issueMatch ?? '',
    autoRun: script?.autoRun ?? false,
    params: parseParams(script?.parametersSchema),
    checkScript: script?.checkScript ?? '',
    verifyScript: script?.verifyScript ?? '',
    undoScript: script?.undoScript ?? '',
  };
}

/** The API fields for a governance form (the key is only sent when set, so the backend can derive one). */
export function governanceInput(g: GovernanceForm, includeKey: boolean): Partial<CreateScriptInput> {
  const params = g.params
    .filter((p) => p.name.trim())
    .map((p) => {
      const clean: ScriptParameter = { name: p.name.trim(), type: p.type };
      if (p.label?.trim()) clean.label = p.label.trim();
      if (p.required) clean.required = true;
      if (p.default !== undefined && p.default !== '') {
        clean.default = p.type === 'int' ? Number(p.default) : p.type === 'bool' ? p.default === true || p.default === 'true' : p.default;
      }
      if (p.type === 'choice' && p.options?.length) clean.options = p.options;
      if (p.type === 'string' && p.pattern?.trim()) clean.pattern = p.pattern.trim();
      if (p.type === 'string' && p.maxLength) clean.maxLength = Number(p.maxLength);
      if (p.type === 'int' && p.min !== undefined && String(p.min) !== '') clean.min = Number(p.min);
      if (p.type === 'int' && p.max !== undefined && String(p.max) !== '') clean.max = Number(p.max);
      return clean;
    });
  return {
    ...(includeKey && g.scriptKey.trim() ? { scriptKey: g.scriptKey.trim().toUpperCase() } : {}),
    riskLevel: g.riskLevel,
    requiresAdmin: g.requiresAdmin,
    timeoutSeconds: g.timeoutSeconds,
    issueMatch: g.issueMatch.trim() || null,
    autoRun: g.autoRun,
    parametersSchema: params.length ? JSON.stringify(params) : null,
    checkScript: g.checkScript.trim() ? g.checkScript : null,
    verifyScript: g.verifyScript.trim() ? g.verifyScript : null,
    undoScript: g.undoScript.trim() ? g.undoScript : null,
  };
}
