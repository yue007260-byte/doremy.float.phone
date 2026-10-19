"use client";

import { useState } from "react";
import type { ChatMessage } from "@/lib/chat-storage";
import type { DirectorDraft } from "@/lib/chat-director";

interface DirectorModeDialogProps {
    messages: ChatMessage[];
    characterName: string;
    busy: boolean;
    onSubmit: (draft: DirectorDraft, saveAsRule: boolean) => void;
    onCancel: () => void;
}

export function DirectorModeDialog({ messages, characterName, busy, onSubmit, onCancel }: DirectorModeDialogProps) {
    const [issues, setIssues] = useState("");
    const [reason, setReason] = useState("");
    const [example, setExample] = useState("");
    const [saveAsRule, setSaveAsRule] = useState(false);

    const canSubmit = !busy && issues.trim() && reason.trim() && example.trim();

    const handleSubmit = () => {
        if (!canSubmit) return;
        onSubmit({ issues: issues.trim(), reason: reason.trim(), example: example.trim() }, saveAsRule);
    };

    const isSingle = messages.length === 1;

    return (
        <div className="chat-html-overlay" onClick={onCancel}>
            <div
                className="g-card w-[min(88vw,480px)] max-h-[82vh] p-4 flex flex-col gap-4 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <span className="menu-label">导演模式</span>
                        <span className="menu-desc !mt-0">
                            {isSingle
                                ? "指出这条回复不符合角色的地方，AI 会按你的指导重新生成"
                                : `已选中 ${messages.length} 条回复，指出它们的问题，AI 会从最早那条开始重新生成`}
                        </span>
                    </div>
                    <button
                        onClick={onCancel}
                        disabled={busy}
                        className="ui-bare-btn text-[var(--c-icon)] ts-18 leading-none"
                        type="button"
                    >✕</button>
                </div>

                {/* 原始回复预览 */}
                <div className="flex flex-col gap-2">
                    <span className="ts-13 text-[var(--c-text-secondary)]">
                        {isSingle
                            ? `${characterName} 的原始回复：`
                            : `${characterName} 的 ${messages.length} 条原始回复：`}
                    </span>
                    <div className={`flex flex-col gap-2 ${!isSingle ? "max-h-[180px] overflow-y-auto" : ""}`}>
                        {messages.map((message, idx) => (
                            <div
                                key={message.id}
                                className="rounded-2xl bg-[var(--c-surface-2)] px-4 py-3 ts-14 text-[var(--c-text)] max-h-[120px] overflow-y-auto"
                            >
                                {!isSingle && (
                                    <span className="ts-12 text-[var(--c-text-tertiary)] mr-1">#{idx + 1}</span>
                                )}
                                {message.content || "(空消息)"}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 问题所在 */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="director-issues" className="ts-13 text-[var(--c-text-secondary)]">
                        不符合人设的点：
                    </label>
                    <textarea
                        id="director-issues"
                        value={issues}
                        onChange={(e) => setIssues(e.target.value)}
                        placeholder="例如：语气太正式了，不像这个角色平时说话的样子"
                        disabled={busy}
                        className="w-full min-h-[80px] resize-none rounded-2xl border border-[var(--c-border)] bg-[var(--c-input)] px-4 py-3 ts-14 text-[var(--c-text)] placeholder:text-[var(--c-text-tertiary)] outline-none disabled:opacity-50"
                    />
                </div>

                {/* 问题原因 */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="director-reason" className="ts-13 text-[var(--c-text-secondary)]">
                        不符合的原因：
                    </label>
                    <textarea
                        id="director-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="例如：角色设定里是个活泼的高中生，应该用更口语化、更有活力的表达"
                        disabled={busy}
                        className="w-full min-h-[80px] resize-none rounded-2xl border border-[var(--c-border)] bg-[var(--c-input)] px-4 py-3 ts-14 text-[var(--c-text)] placeholder:text-[var(--c-text-tertiary)] outline-none disabled:opacity-50"
                    />
                </div>

                {/* 正确示例 */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="director-example" className="ts-13 text-[var(--c-text-secondary)]">
                        正确的说话方式示例：
                    </label>
                    <textarea
                        id="director-example"
                        value={example}
                        onChange={(e) => setExample(e.target.value)}
                        placeholder="给出一个符合角色设定的回复示例，让 AI 理解你想要的风格"
                        disabled={busy}
                        className="w-full min-h-[100px] resize-none rounded-2xl border border-[var(--c-border)] bg-[var(--c-input)] px-4 py-3 ts-14 text-[var(--c-text)] placeholder:text-[var(--c-text-tertiary)] outline-none disabled:opacity-50"
                    />
                </div>

                {/* 保存为长期规则 */}
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={saveAsRule}
                        onChange={(e) => setSaveAsRule(e.target.checked)}
                        disabled={busy}
                        className="w-4 h-4 rounded accent-[var(--c-accent)] disabled:opacity-50"
                    />
                    <span className="ts-13 text-[var(--c-text-secondary)]">
                        保存为长期规则（后续对话都遵守这个指导）
                    </span>
                </label>

                {/* 操作按钮 */}
                <div className="flex justify-end gap-2 pt-2">
                    <button
                        onClick={onCancel}
                        disabled={busy}
                        className="ui-btn ui-btn-outline"
                        type="button"
                    >取消</button>
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="ui-btn ui-btn-primary"
                        type="button"
                    >
                        {busy ? "重新生成中..." : "提交并重新生成"}
                    </button>
                </div>
            </div>
        </div>
    );
}
