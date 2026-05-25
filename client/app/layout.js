import { cookies } from "next/headers";
import { getLocale, getMessages } from "next-intl/server";
import { Providers } from "./providers";
import "./globals.css";

export const metadata = {
    title: "FitForce",
    description: "Fitness coaching platform",
};

export default async function RootLayout({ children }) {
    const cookieStore = await cookies();
    const theme = cookieStore.get("theme")?.value ?? "system";
    const locale = await getLocale();
    const messages = await getMessages();
    const dir = locale === "ar" ? "rtl" : "ltr";

    return (
        <html lang={locale} dir={dir} suppressHydrationWarning>
            <body>
                <Providers defaultTheme={theme} locale={locale} messages={messages}>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
