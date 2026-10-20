"use client";

import { useState, useCallback } from "react";
import type { ChatMessage } from "@/lib/chat-storage";
import type { DirectorDraft } from "@/lib/chat-director";
import { analyzeDirectorExample } from "@/lib/chat-director";
import { Loader2 } from "lucide-react";

interface DirectorModeDialogProps {
    messages: ChatMessage[];
    characterName: string;
    busy: boolean;
    onSubmit: (draft: DirectorDraft, saveAsRule: boolean) => void;
    onCancel: () => void;
}

export function DirectorModeDialog({ messages, characterName, busy, onSubmit, onCancel }: DirectorModeDialogProps) {
    const [example, setExample] = useState("");
    const [explanation, setExplanation] = useState("");
    const [saveAsRule, setSaveAsRule] = useState(false);

    // AI 分析
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzeError, setAnalyzeError] = useState<string | null>(null);

    // 重新分析反馈弹窗
    const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);
    const [feedback, setFeedback] = useState("");

    const canAnalyze = !analyzing && !busy && example.trim() && explanation.trim();
    const canSubmit = !busy && !analyzing && !!analysis;

    const isSingle = messages.length === 1;
    const originalContents = messages.map(m => m.content);

    const runAnalysis = useCallback(async (feedbackText?: string) => {
        if (!example.trim() || !explanation.trim()) return;
        setAnalyzing(true);
        setAnalyzeError(null);
        try {
            const result = await analyzeDirectorExample({
                originalContents,
                example: example.trim(),
                explanation: explanation.trim(),
                characterName,
                feedback: feedbackText?.trim() || undefined,
            });
            if (result.content) {
                setAnalysis(result.content);
            } else {
                setAnalyzeError(result.error || "分析失败，请重试");
            }
        } catch {
            setAnalyzeError("分析失败，请重试");
        } finally {
            setAnalyzing(false);
        }
    }, [example, explanation, originalContents, characterName]);

    const handleAnalyze = () => {
        setAnalysis(null);
        void runAnalysis();
    };

    const handleReanalyze = () => {
        setShowFeedbackPopup(true);
        setFeedback("");
    };

    const handleFeedbackSubmit = (withFeedback: boolean) => {
        setShowFeedbackPopup(false);
        setAnalysis(null);
        void runAnalysis(withFeedback ? feedback : undefined);
    };

    const handleSubmit = () => {
        if (!canSubmit) return;
        onSubmit({
            example: example.trim(),
            explanation: explanation.trim(),
            analysis: analysis || undefined,
        }, saveAsRule);
    };

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
                                ? "给出正确示例，AI 会分析后按你的指导重新生成"
                                : `已选中 ${messages.length} 条回复，给出正确示例，AI 会从最早那条开始重新生成`}
                        </span>
                    </div>
                    <button
                        onClick={onCancel}
                        disabled={busy || analyzing}
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
                    <div className={`flex flex-col gap-2 ${!isSingle ? "max-h-[140px] overflow-y-auto" : ""}`}>
                        {messages.map((message, idx) => (
                            <div
                                key={message.id}
                                className="rounded-2xl bg-[var(--c-surface-2)] px-4 py-3 ts-14 text-[var(--c-text)] max-h-[100px] overflow-y-auto"
                            >
                                {!isSingle && (
                                    <span className="ts-12 text-[var(--c-text-tertiary)] mr-1">#{idx + 1}</span>
                                )}
                                {message.content || "(空消息)"}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 正确示例 */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="director-example" className="ts-13 text-[var(--c-text-secondary)]">
                        正确的说话方式示例：
                    </label>
                    <textarea
                        id="director-example"
                        value={example}
                        onChange={(e) => { setExample(e.target.value); if (analysis) setAnalysis(null); }}
                        placeholder="写出角色在这个场景下应该怎么回复"
                        disabled={busy || analyzing}
                        className="w-full min-h-[100px] resize-none rounded-2xl border border-[var(--c-border)] bg-[var(--c-input)] px-4 py-3 ts-14 text-[var(--c-text)] placeholder:text-[var(--c-text-tertiary)] outline-none disabled:opacity-50"
                    />
                </div>

                {/* 为什么这样写 */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="director-explanation" className="ts-13 text-[var(--c-text-secondary)]">
                        为什么是示例这样写，而不是原来那样：
                    </label>
                    <textarea
                        id="director-explanation"
                        value={explanation}
                        onChange={(e) => { setExplanation(e.target.value); if (analysis) setAnalysis(null); }}
                        placeholder="例如：角色是个冷淡的人，不会用这么多感叹号和语气词"
                        disabled={busy || analyzing}
                        className="w-full min-h-[80px] resize-none rounded-2xl border border-[var(--c-border)] bg-[var(--c-input)] px-4 py-3 ts-14 text-[var(--c-text)] placeholder:text-[var(--c-text-tertiary)] outline-none disabled:opacity-50"
                    />
                </div>

                {/* 分析按钮（未分析时显示） */}
                {!analysis && !analyzing && (
                    <button
                        onClick={handleAnalyze}
                        disabled={!canAnalyze}
                        className="ui-btn ui-btn-primary self-start"
                        type="button"
                    >
                        让 AI 分析
                    </button>
                )}

                {/* 分析中 */}
                {analyzing && (
                    <div className="flex items-center gap-2 py-3 text-[var(--c-text-secondary)] ts-14">
                        <Loader2 size={18} className="animate-spin" />
                        <span>AI 正在分析你的示例...</span>
                    </div>
                )}

                {/* 分析错误 */}
                {analyzeError && (
                    <div className="rounded-2xl bg-red-50 dark:bg-red-950/30 px-4 py-3 ts-13 text-red-600 dark:text-red-400">
                        {analyzeError}
                    </div>
                )}

                {/* AI 分析结果 */}
                {analysis && (
                    <div className="flex flex-col gap-2">
                        <span className="ts-13 text-[var(--c-text-secondary)]">AI 的理解与分析：</span>
                        <div className="rounded-2xl bg-[var(--c-surface-2)] px-4 py-3 ts-14 text-[var(--c-text)] max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                            {analysis}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleReanalyze}
                                disabled={busy}
                                className="ui-btn ui-btn-outline ts-13"
                                type="button"
                            >
                                重新分析
                            </button>
                            <span className="ts-12 text-[var(--c-text-tertiary)]">
                                分析正确就可以提交了
                            </span>
                        </div>
                    </div>
                )}

                {/* 保存为长期规则 */}
                {analysis && (
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
                )}

                {/* 操作按钮 */}
                <div className="flex justify-end gap-2 pt-2">
                    <button
                        onClick={onCancel}
                        disabled={busy || analyzing}
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

            {/* 重新分析反馈弹窗 */}
            {showFeedbackPopup && (
                <div
                    className="chat-html-overlay"
                    style={{ zIndex: 1 }}
                    onClick={(e) => { e.stopPropagation(); setShowFeedbackPopup(false); }}
                >
                    <div
                        className="g-card w-[min(80vw,380px)] p-4 flex flex-col gap-3"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span className="menu-label">哪里分析得不对？</span>
                        <span className="menu-desc !mt-0">可以写下原因帮助 AI 更好地理解，也可以直接重新分析</span>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="（可选）哪里不对、为什么不对..."
                            className="w-full min-h-[80px] resize-none rounded-2xl border border-[var(--c-border)] bg-[var(--c-input)] px-4 py-3 ts-14 text-[var(--c-text)] placeholder:text-[var(--c-text-tertiary)] outline-none"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => handleFeedbackSubmit(false)}
                                className="ui-btn ui-btn-outline"
                                type="button"
                            >直接重新分析</button>
                            <button
                                onClick={() => handleFeedbackSubmit(true)}
                                disabled={!feedback.trim()}
                                className="ui-btn ui-btn-primary"
                                type="button"
                            >带反馈重新分析</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
