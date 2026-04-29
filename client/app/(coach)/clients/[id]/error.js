"use client";
import ErrorState from "@/app/components/ErrorState";
export default function Error({ error, reset }) {
    return <ErrorState error={error} reset={reset} />;
}
