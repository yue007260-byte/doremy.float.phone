/**
 * 导演模式：在角色说出不符合人设的话时，提供示范指导并重新生成，
 * 并将指导内容记忆化以影响后续回复。
 */

import { resolveAuxiliaryApiConfig } from "./settings-storage";
import { simpleLLMCall } from "./api-helpers";

export interface DirectorDraft {
    /** 正确的说话方式示例 */
    example: string;
    /** 为什么示例是对的、原来是错的 */
    explanation: string;
    /** AI 对示例的理解与分析（由 analyzeDirectorExample 生成） */
    analysis?: string;
}

export interface DirectorRule extends DirectorDraft {
    id: string;
    characterId: string;
    createdAt: string;
}

const DIRECTOR_RULES_STORE = "directorRules";
const DIRECTOR_RULES_DB = "aiPhoneDirector";
const DIRECTOR_RULES_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
    if (dbInstance) return dbInstance;
    
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DIRECTOR_RULES_DB, DIRECTOR_RULES_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };
        
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(DIRECTOR_RULES_STORE)) {
                const store = db.createObjectStore(DIRECTOR_RULES_STORE, { keyPath: "id" });
                store.createIndex("characterId", "characterId", { unique: false });
            }
        };
    });
}

/**
 * 保存导演规则（长期记忆）
 */
export async function saveDirectorRule(characterId: string, draft: DirectorDraft): Promise<DirectorRule> {
    const db = await getDB();
    const rule: DirectorRule = {
        ...draft,
        id: `${characterId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        characterId,
        createdAt: new Date().toISOString(),
    };
    
    return new Promise((resolve, reject) => {
        const tx = db.transaction([DIRECTOR_RULES_STORE], "readwrite");
        const store = tx.objectStore(DIRECTOR_RULES_STORE);
        const request = store.add(rule);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(rule);
    });
}

/**
 * 读取某个角色的所有导演规则
 */
export async function loadDirectorRules(characterId: string): Promise<DirectorRule[]> {
    const db = await getDB();
    
    return new Promise((resolve, reject) => {
        const tx = db.transaction([DIRECTOR_RULES_STORE], "readonly");
        const store = tx.objectStore(DIRECTOR_RULES_STORE);
        const index = store.index("characterId");
        const request = index.getAll(characterId);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
    });
}

/**
 * 删除某条导演规则
 */
export async function deleteDirectorRule(ruleId: string): Promise<void> {
    const db = await getDB();
    
    return new Promise((resolve, reject) => {
        const tx = db.transaction([DIRECTOR_RULES_STORE], "readwrite");
        const store = tx.objectStore(DIRECTOR_RULES_STORE);
        const request = store.delete(ruleId);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

/**
 * 调用 LLM 分析导演示例：AI 阅读原始回复和用户的示例/说明，输出理解与分析。
 */
export async function analyzeDirectorExample(opts: {
    originalContents: string[];
    example: string;
    explanation: string;
    characterName: string;
    feedback?: string;
    signal?: AbortSignal;
}): Promise<{ content?: string; error?: string }> {
    const apiConfig = resolveAuxiliaryApiConfig("reasoningTranslateApiConfigId");
    if (!apiConfig) {
        return { error: "请先在设置 → 绑定配置 → 辅助 API 中设置翻译/分析 API（或设置全局默认 API）" };
    }

    const originalSection = opts.originalContents.length === 1
        ? `${opts.characterName}的原始回复：\n${opts.originalContents[0]}`
        : opts.originalContents.map((c, i) => `${opts.characterName}的原始回复 ${i + 1}：\n${c}`).join("\n\n");

    const feedbackSection = opts.feedback
        ? `\n\n用户对上次分析的反馈：${opts.feedback}`
        : "";

    const prompt = [
        "你是一位角色扮演的导演助手。用户认为角色的回复不符合人设，提供了一个正确的示例和说明。",
        "请分析用户的示例，总结出具体的写作规则——角色应该怎么说话、什么语气、什么风格、哪些表达要避免、哪些表达要采用。",
        "输出要求：",
        "- 用简洁的条目式总结（不超过 5 条）",
        "- 每条说清楚「应该」和「不应该」",
        "- 不要复述原文和示例，只输出你提炼的规则",
        "",
        originalSection,
        "",
        `用户提供的正确示例：\n${opts.example}`,
        "",
        `用户的说明（为什么示例是对的而原来是错的）：\n${opts.explanation}`,
        feedbackSection,
    ].join("\n");

    const controller = opts.signal ? null : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), 60_000) : null;
    try {
        const result = await simpleLLMCall(apiConfig, [
            { role: "user", content: prompt },
        ], { temperature: 0.3, signal: opts.signal ?? controller?.signal, label: "导演模式分析" });

        if (!result.content?.trim()) {
            return { error: result.error || "分析失败，请重试" };
        }
        return { content: result.content.trim() };
    } catch (e) {
        if (controller?.signal.aborted) return { error: "分析超时，请重试" };
        return { error: e instanceof Error ? e.message : "分析失败，请重试" };
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/**
 * 调用 LLM 分析接管期间的发言：用户以角色身份说话，AI 提炼出角色的说话方式，
 * 作为长期规则保存，后续回复自动模仿。
 */
export async function analyzeTakeoverStyle(opts: {
    samples: string[];
    characterName: string;
    signal?: AbortSignal;
}): Promise<{ content?: string; error?: string }> {
    const apiConfig = resolveAuxiliaryApiConfig("reasoningTranslateApiConfigId");
    if (!apiConfig) {
        return { error: "请先在设置 → 绑定配置 → 辅助 API 中设置翻译/分析 API（或设置全局默认 API）" };
    }

    const sampleSection = opts.samples.map((s, i) => `${i + 1}. ${s}`).join("\n");

    const prompt = [
        "你是一位角色扮演的导演助手。用户在「接管模式」下替角色发言，下面这些是角色（由用户代打）实际说出来的话。",
        "请分析这些发言，提炼出这个角色的说话方式与风格，作为长期规则，让 AI 之后扮演这个角色时能模仿一致。",
        "输出要求：",
        "- 用简洁的条目式总结（不超过 6 条）",
        "- 覆盖：语气、用词习惯、句式长短、口头禅、情绪表达方式、标点/表情使用倾向",
        "- 每条说清楚「角色通常怎么做」，不要复述大段原文",
        "",
        `${opts.characterName} 的发言样本：`,
        sampleSection,
    ].join("\n");

    const controller = opts.signal ? null : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), 60_000) : null;
    try {
        const result = await simpleLLMCall(apiConfig, [
            { role: "user", content: prompt },
        ], { temperature: 0.3, signal: opts.signal ?? controller?.signal, label: "接管说话方式学习" });

        if (!result.content?.trim()) {
            return { error: result.error || "分析失败，请重试" };
        }
        return { content: result.content.trim() };
    } catch (e) {
        if (controller?.signal.aborted) return { error: "分析超时，请重试" };
        return { error: e instanceof Error ? e.message : "分析失败，请重试" };
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/**
 * 构建一次性重生成指令（本次指导，不进入长期记忆）
 * 支持单条或多条消息的导演指导。
 */
export function buildDirectorRetryNote(draft: DirectorDraft, originalContents: string | string[]): string {
    const contents = Array.isArray(originalContents) ? originalContents : [originalContents];
    const contentSection = contents.length === 1
        ? `原始回复：${contents[0]}`
        : contents.map((c, i) => `原始回复 ${i + 1}：${c}`).join("\n");
    const analysisSection = draft.analysis ? `\nAI 提炼的写作规则：\n${draft.analysis}` : "";
    return `【导演指导】以下回复不符合角色设定，请按指导重新生成：

${contentSection}

用户提供的正确示例：${draft.example}
用户说明：${draft.explanation}${analysisSection}

请根据上述指导重新组织回复，保持角色一贯的说话方式和性格特点。`;
}

/**
 * 构建导演规则的提示词片段（注入到系统提示词）
 */
export function buildDirectorRulesPrompt(rules: DirectorRule[]): string {
    if (rules.length === 0) return "";
    
    const rulesText = rules.map((rule, idx) => 
        `${idx + 1}. 正确示例：${rule.example}\n   说明：${rule.explanation}${rule.analysis ? `\n   规则：${rule.analysis}` : ""}`
    ).join("\n\n");
    
    return `\n\n【导演指导规则】以下是用户对你说话方式的具体指导，请在后续回复中严格遵守：\n\n${rulesText}`;
}
