"use client";
import { useTranslations } from "next-intl";
import { Alert } from "@heroui/react/alert";

// Shown instead of ErrorState when the server answers 403: the person is signed in but their role is not
// allowed to use this page. A retry would never help, so there is no "Try Again" — and the wording says what to do.
export default function NoAccessState() {
    const t = useTranslations('error');
    return (
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
            <div className="max-w-md w-full">
                <Alert>
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Title>{t('noAccessTitle')}</Alert.Title>
                        <Alert.Description>{t('noAccessHint')}</Alert.Description>
                    </Alert.Content>
                </Alert>
            </div>
        </div>
    );
}
