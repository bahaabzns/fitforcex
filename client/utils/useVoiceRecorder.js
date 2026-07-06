"use client";

import { useCallback, useRef, useState } from "react";

export function formatDuration(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Wraps the browser MediaRecorder API for voice notes. `start()` requests mic
 * permission and begins recording; `stop()` resolves with the recorded blob
 * and its duration; `cancel()` discards the recording in progress.
 */
export function useVoiceRecorder() {
    const [recording, setRecording] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);
    const streamRef = useRef(null);
    const startedAtRef = useRef(0);
    const timerRef = useRef(null);

    const cleanup = useCallback(() => {
        clearInterval(timerRef.current);
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
    }, []);

    const start = useCallback(async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        chunksRef.current = [];

        const mimeType = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "";
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorderRef.current = recorder;
        recorder.start();

        startedAtRef.current = Date.now();
        setElapsedSeconds(0);
        setRecording(true);
        timerRef.current = setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
        }, 250);
    }, []);

    const stop = useCallback(() => {
        return new Promise(resolve => {
            const recorder = recorderRef.current;
            if (!recorder) { resolve(null); return; }
            const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
                cleanup();
                resolve({ blob, durationSeconds });
            };
            recorder.stop();
        });
    }, [cleanup]);

    const cancel = useCallback(() => {
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== "inactive") {
            recorder.onstop = null;
            recorder.stop();
        }
        cleanup();
    }, [cleanup]);

    return { recording, elapsedSeconds, start, stop, cancel };
}
