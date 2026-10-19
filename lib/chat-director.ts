/**
 * 导演模式：在角色说出不符合人设的话时，提供示范指导并重新生成，
 * 并将指导内容记忆化以影响后续回复。
 */

export interface DirectorDraft {
    /** 不符合人设的点 */
    issues: string;
    /** 不符合的原因 */
    reason: string;
    /** 正确的说话方式示例 */
    example: string;
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
 * 构建一次性重生成指令（本次指导，不进入长期记忆）
 */
export function buildDirectorRetryNote(draft: DirectorDraft, originalContent: string): string {
    return `【导演指导】刚才这条回复不符合角色设定，请按以下指导重新生成：

问题所在：${draft.issues}
问题原因：${draft.reason}
正确示例：${draft.example}

请根据上述指导重新组织回复，保持角色一贯的说话方式和性格特点。`;
}

/**
 * 构建导演规则的提示词片段（注入到系统提示词）
 */
export function buildDirectorRulesPrompt(rules: DirectorRule[]): string {
    if (rules.length === 0) return "";
    
    const rulesText = rules.map((rule, idx) => 
        `${idx + 1}. ${rule.issues}\n   原因：${rule.reason}\n   正确方式：${rule.example}`
    ).join("\n\n");
    
    return `\n\n【导演指导规则】以下是用户对你说话方式的具体指导，请在后续回复中严格遵守：\n\n${rulesText}`;
}
