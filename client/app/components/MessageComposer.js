"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Paperclip, Mic, Square, Trash2, X, FileText } from "lucide-react";
import { TextField } from "@heroui/react/textfield";
import { TextArea } from "@heroui/react/textarea";
import { Button } from "@heroui/react/button";
import EmojiPickerButton from "@/app/components/EmojiPickerButton";
import { useVoiceRecorder, formatDuration } from "@/utils/useVoiceRecorder";

const scrollbarCls = "[&::-webkit-scrollbar]:w-0 [scrollbar-width:none]";
const ACCEPTED_FILE_TYPES = "image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip";

function attachmentKindFromFile(file) {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("audio/")) return "voice";
    return "file";
}

/**
 * Chat compose bar shared by the coach messenger and the client portal chat.
 * Owns its own draft/attachment/recording state; the caller only supplies the
 * three send actions and the (optional) message currently being edited.
 *
 * @param {(key: string, values?: object) => string} t   translations for:
 *   replyPlaceholder, editingLabel, cancelEdit, attachLabel, recordLabel,
 *   stopRecordingLabel, cancelRecordingLabel, removeAttachmentLabel, sendLabel,
 *   sendFailed
 * @param {{ id: string, body: string } | null} editingMessage
 * @param {() => void} onCancelEdit
 * @param {(id: string, body: string) => Promise<void>} onSaveEdit
 * @param {(body: string) => Promise<void>} onSendText
 * @param {(attachment: { kind: 'image'|'voice'|'file', file: File|Blob, name: string, durationSeconds?: number }, caption: string) => Promise<void>} onSendAttachment
 */
export default function MessageComposer({
    t, editingMessage, onCancelEdit, onSaveEdit, onSendText, onSendAttachment,
}) {
    const [draft, setDraft] = useState(editingMessage ? (editingMessage.body ?? "") : "");
    const [pendingAttachment, setPendingAttachment] = useState(null);
    const [sending, setSending] = useState(false);
    const [micError, setMicError] = useState("");
    const [sendError, setSendError] = useState("");
    const fileInputRef = useRef(null);
    const { recording, elapsedSeconds, start, stop, cancel } = useVoiceRecorder();

    // Reset the composer when switching which message is being edited (including
    // entering/leaving edit mode) — adjusted during render per React's guidance,
    // rather than in an effect, to avoid an extra commit-then-fix render pass.
    const [syncedEditId, setSyncedEditId] = useState(editingMessage?.id ?? null);
    if ((editingMessage?.id ?? null) !== syncedEditId) {
        setSyncedEditId(editingMessage?.id ?? null);
        setDraft(editingMessage ? (editingMessage.body ?? "") : "");
        setPendingAttachment(null);
    }

    useEffect(() => {
        if (pendingAttachment?.previewUrl) {
            const url = pendingAttachment.previewUrl;
            return () => URL.revokeObjectURL(url);
        }
    }, [pendingAttachment?.previewUrl]);

    function handleFileSelect(e) {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        const kind = attachmentKindFromFile(file);
        setPendingAttachment({
            kind, file, name: file.name,
            previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
        });
    }

    async function handleMicClick() {
        setMicError("");
        // getUserMedia only exists in "secure contexts" — https, or the literal hosts
        // localhost/127.0.0.1. A domain like my.lvh.me that merely resolves to
        // loopback does NOT count, so this reliably catches that dev-environment trap
        // instead of failing silently.
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            setMicError(t("micUnsupported"));
            return;
        }
        try {
            await start();
        } catch (err) {
            setMicError(err?.name === "NotAllowedError" ? t("micPermissionDenied") : t("micUnavailable"));
        }
    }

    async function handleStopRecording() {
        const result = await stop();
        if (result) {
            setPendingAttachment({
                kind: "voice", file: result.blob, name: "voice-message.webm",
                durationSeconds: result.durationSeconds,
                previewUrl: URL.createObjectURL(result.blob),
            });
        }
    }

    // The three branches below keep the draft/attachment/edit state intact on
    // failure so the user can retry (rather than losing their input) — but a
    // failure must still be visible, or a retry-able state is indistinguishable
    // from "nothing happened." `sendError` surfaces whatever the server said
    // (falling back to a generic message for network-level failures that never
    // reach a response), for every send kind alike.
    async function handleSubmit(e) {
        e?.preventDefault();
        if (sending) return;
        setSendError("");

        if (editingMessage) {
            if (!draft.trim()) return;
            setSending(true);
            try { await onSaveEdit(editingMessage.id, draft.trim()); setDraft(""); }
            catch (err) { setSendError(err?.response?.data?.error || t("sendFailed")); }
            finally { setSending(false); }
            return;
        }

        if (pendingAttachment) {
            setSending(true);
            try { await onSendAttachment(pendingAttachment, draft.trim()); setPendingAttachment(null); setDraft(""); }
            catch (err) { setSendError(err?.response?.data?.error || t("sendFailed")); }
            finally { setSending(false); }
            return;
        }

        if (!draft.trim()) return;
        setSending(true);
        try { await onSendText(draft.trim()); setDraft(""); }
        catch (err) { setSendError(err?.response?.data?.error || t("sendFailed")); }
        finally { setSending(false); }
    }

    if (recording) {
        return (
            <div className="w-full rounded-2xl border border-border bg-default flex items-center gap-3 px-4 py-3">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
                </span>
                <span className="flex-1 text-sm text-foreground tabular-nums">{formatDuration(elapsedSeconds)}</span>
                <Button type="button" isIconOnly size="sm" variant="ghost" aria-label={t("cancelRecordingLabel")} onClick={cancel}>
                    <Trash2 size={15} />
                </Button>
                <Button type="button" isIconOnly size="sm" color="primary" aria-label={t("stopRecordingLabel")} onClick={handleStopRecording}>
                    <Square size={13} />
                </Button>
            </div>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="w-full rounded-2xl border border-border bg-default flex flex-col px-4 pt-3 pb-3 gap-2 transition-[box-shadow,background-color] focus-within:ring-2 focus-within:ring-focus focus-within:bg-[color-mix(in_oklch,var(--color-default)_85%,white_15%)] dark:focus-within:bg-[color-mix(in_oklch,var(--color-default)_85%,black_15%)]"
        >
            {editingMessage && (
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border/60 -mx-4 px-4 -mt-1">
                    <span className="text-xs font-medium text-primary">{t("editingLabel")}</span>
                    <button type="button" onClick={onCancelEdit} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X size={14} />
                    </button>
                </div>
            )}

            {pendingAttachment && pendingAttachment.kind === "voice" ? (
                <div className="flex items-center gap-2 pb-1.5">
                    {/* Listen-before-send: native controls give play/pause, a
                        scrubber, and its own duration readout for free. */}
                    <audio controls src={pendingAttachment.previewUrl} className="h-9 flex-1 min-w-0" />
                    <button
                        type="button"
                        aria-label={t("removeAttachmentLabel")}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        onClick={() => setPendingAttachment(null)}
                    >
                        <X size={15} />
                    </button>
                </div>
            ) : pendingAttachment && (
                <div className="flex items-center gap-2 pb-1.5">
                    {pendingAttachment.kind === "image" ? (
                        <img src={pendingAttachment.previewUrl} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
                    ) : (
                        <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <FileText size={18} />
                        </div>
                    )}
                    <span className="flex-1 min-w-0 truncate text-sm text-foreground">
                        {pendingAttachment.name}
                    </span>
                    <button
                        type="button"
                        aria-label={t("removeAttachmentLabel")}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        onClick={() => setPendingAttachment(null)}
                    >
                        <X size={15} />
                    </button>
                </div>
            )}

            <TextField value={draft} onChange={setDraft} aria-label={t("replyPlaceholder")} className="w-full">
                <TextArea
                    placeholder={t("replyPlaceholder")}
                    variant="secondary"
                    fullWidth
                    rows={1}
                    className={`resize-none [field-sizing:content] max-h-32 overflow-y-auto text-sm px-0! border-transparent! shadow-none! focus:ring-0! focus:shadow-none! [--textarea-bg:transparent] [--textarea-bg-hover:transparent] [--textarea-bg-focus:transparent] ${scrollbarCls}`}
                    onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                        }
                    }}
                />
            </TextField>

            {micError && <p className="text-xs text-destructive">{micError}</p>}
            {sendError && <p className="text-xs text-destructive">{sendError}</p>}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                    <EmojiPickerButton onSelect={emoji => setDraft(d => d + emoji)} />
                    {!editingMessage && (
                        <>
                            <input ref={fileInputRef} type="file" hidden accept={ACCEPTED_FILE_TYPES} onChange={handleFileSelect} />
                            <button
                                type="button"
                                aria-label={t("attachLabel")}
                                className="flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-default transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Paperclip size={17} />
                            </button>
                            <button
                                type="button"
                                aria-label={t("recordLabel")}
                                className="flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-default transition-colors"
                                onClick={handleMicClick}
                            >
                                <Mic size={17} />
                            </button>
                        </>
                    )}
                </div>
                <Button
                    type="submit"
                    color="primary"
                    isDisabled={sending || (editingMessage ? !draft.trim() : !draft.trim() && !pendingAttachment)}
                    size="sm"
                    isIconOnly
                    className="shrink-0"
                >
                    <Send size={13} />
                </Button>
            </div>
        </form>
    );
}
