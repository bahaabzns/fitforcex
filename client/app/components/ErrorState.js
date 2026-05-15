"use client";
import { Alert } from "@heroui/react/alert";
import { Button } from "@heroui/react/button";

export default function ErrorState({ error, reset }) {
    return (
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
            <div className="max-w-md w-full flex flex-col gap-4">
                <Alert>
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Title>Something went wrong</Alert.Title>
                        <Alert.Description>
                            {error?.message || "An unexpected error occurred while loading this page."}
                        </Alert.Description>
                    </Alert.Content>
                </Alert>
                <div className="flex justify-center">
                    <Button variant="primary" onClick={() => reset()}>
                        Try Again
                    </Button>
                </div>
            </div>
        </div>
    );
}
