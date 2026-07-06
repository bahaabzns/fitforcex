"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldErrorText } from "@/app/components/Field";
import { TextArea } from "@heroui/react/textarea";
import { Button } from "@heroui/react/button";

const MAX_BODY_LENGTH = 5000;

/**
 * Sends one message to every thread currently visible under the messenger's
 * active search/filters — the recipient list is passed in by the caller
 * (filteredThreads), not recomputed here.
 *
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {string[]} threadIds   threads the message will be sent to
 * @param {(result: { sent: number, skipped: number }) => void} onSuccess
 */
export default function BroadcastMessageModal({ open, onClose, threadIds, onSuccess }) {
    const t = useTranslations("broadcastModal");
    const tCommon = useTranslations("common");
    const [body, setBody] = useState("");
    const [error, setError] = useState("");
    const [sending, setSending] = useState(false);

    const recipientCount = threadIds.length;

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        if (!body.trim()) { setError(t("errorBodyRequired")); return; }
        if (body.trim().length > MAX_BODY_LENGTH) { setError(t("errorTooLong")); return; }
        if (recipientCount === 0) { setError(t("noRecipients")); return; }

        setSending(true);
        try {
            const res = await api.post("/api/messenger/threads/broadcast", {
                threadIds,
                body: body.trim(),
            });
            onSuccess?.(res.data);
            setBody("");
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || t("errorSendFailed"));
        } finally {
            setSending(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title={t("title")}>
            {open && (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                        {t("recipientHint", { count: recipientCount })}
                    </p>

                    <TextArea
                        variant="secondary"
                        fullWidth
                        rows={5}
                        autoFocus
                        aria-label={t("bodyLabel")}
                        placeholder={t("bodyPlaceholder")}
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        className="px-4"
                    />

                    <FieldErrorText msg={error} />

                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={onClose}>
                            {tCommon("cancel")}
                        </Button>
                        <Button type="submit" variant="primary" isDisabled={sending || !body.trim() || recipientCount === 0}>
                            {sending ? t("sending") : t("sendToCount", { count: recipientCount })}
                        </Button>
                    </ModalFooter>
                </form>
            )}
        </Modal>
    );
}
