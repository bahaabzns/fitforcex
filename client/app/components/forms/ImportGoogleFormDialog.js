"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { TextArea } from "@heroui/react/textarea";
import { Button } from "@heroui/react/button";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldErrorText } from "@/app/components/Field";

// Only wired to whether the pasted value *looks* like a Google Forms link —
// the real validation (is it reachable, is it public, does it parse) happens
// server-side in googleFormsImport.ts and its error comes back through here.
function looksLikeGoogleFormUrl(value) {
    return /^https:\/\/docs\.google\.com\/forms\//.test(value.trim());
}

export default function ImportGoogleFormDialog({ open, onClose, handleImportGoogleForm }) {
    const tForms = useTranslations("forms");
    const tCommon = useTranslations("common");
    // "url" is the low-friction default (paste a link). "html" is the
    // fallback for forms Google sign-in-gates from our anonymous server
    // fetch — e.g. any form with a File Upload question — where the coach
    // views the page in their own signed-in browser (which the wall
    // doesn't block) and pastes the page source instead.
    const [mode, setMode] = useState("url");
    const [url, setUrl] = useState("");
    const [html, setHtml] = useState("");
    const [error, setError] = useState("");
    const [isImporting, setIsImporting] = useState(false);

    function resetState() {
        setMode("url");
        setUrl("");
        setHtml("");
        setError("");
    }

    function handleClose() {
        if (isImporting) return;
        resetState();
        onClose();
    }

    function toggleMode() {
        setMode((prev) => (prev === "url" ? "html" : "url"));
        setError("");
    }

    async function handleSubmit(e) {
        e.preventDefault();
        let result;
        if (mode === "html") {
            if (!html.trim()) {
                setError(tForms("importHtmlInvalid"));
                return;
            }
            setIsImporting(true);
            setError("");
            result = await handleImportGoogleForm({ html: html.trim() });
        } else {
            if (!looksLikeGoogleFormUrl(url)) {
                setError(tForms("importUrlInvalid"));
                return;
            }
            setIsImporting(true);
            setError("");
            result = await handleImportGoogleForm({ url: url.trim() });
        }
        setIsImporting(false);
        if (!result.ok) {
            setError(result.error || tForms("importError"));
            return;
        }
        if (result.skipped?.length > 0) {
            window.alert(
                tForms("importSkippedWarning", {
                    count: result.skipped.length,
                    list: result.skipped.map((s) => s.label_en).join(", "),
                })
            );
        }
        resetState();
        onClose();
    }

    return (
        <Modal open={open} onClose={handleClose} title={tForms("importDialogTitle")}>
            <form className="flex flex-col gap-4 px-1 py-1" onSubmit={handleSubmit}>
                {mode === "url" ? (
                    <>
                        <p className="text-sm text-muted-foreground">{tForms("importDialogHint")}</p>
                        <TextField value={url} onChange={setUrl} isDisabled={isImporting}>
                            <Input type="url" placeholder={tForms("importUrlPlaceholder")} variant="secondary" autoFocus />
                        </TextField>
                    </>
                ) : (
                    <>
                        <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                            <li>{tForms("importHtmlStep1")}</li>
                            <li>{tForms("importHtmlStep2")}</li>
                            <li>{tForms("importHtmlStep3")}</li>
                        </ol>
                        <TextField value={html} onChange={setHtml} isDisabled={isImporting}>
                            <TextArea
                                placeholder={tForms("importHtmlPlaceholder")}
                                variant="secondary"
                                fullWidth
                                rows={6}
                                className="text-xs font-mono"
                                autoFocus
                            />
                        </TextField>
                    </>
                )}

                <button
                    type="button"
                    onClick={toggleMode}
                    disabled={isImporting}
                    className="self-start text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {mode === "url" ? tForms("importPasteSourceToggle") : tForms("importPasteSourceBack")}
                </button>

                <FieldErrorText msg={error} />
                <ModalFooter>
                    <Button type="button" variant="ghost" isDisabled={isImporting} onClick={handleClose}>
                        {tCommon("cancel")}
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        isDisabled={isImporting || (mode === "url" ? !url.trim() : !html.trim())}
                    >
                        {isImporting ? tForms("importing") : tForms("importButton")}
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
}
