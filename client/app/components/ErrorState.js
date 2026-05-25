"use client";
import { useTranslations } from "next-intl";
import { Alert } from "@heroui/react/alert";
import { Button } from "@heroui/react/button";

export default function ErrorState({ error, reset }) {
    const t = useTranslations('error');
    return (
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
            <div className="max-w-md w-full flex flex-col gap-4">
                <Alert>
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Title>{t('somethingWentWrong')}</Alert.Title>
                        <Alert.Description>
                            {error?.message || t('unexpectedError')}
                        </Alert.Description>
                    </Alert.Content>
                </Alert>
                <div className="flex justify-center">
                    <Button variant="primary" onClick={() => reset()}>
                        {t('tryAgain')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
