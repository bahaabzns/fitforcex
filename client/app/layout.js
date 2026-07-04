import { cookies } from "next/headers";
import { getLocale, getMessages } from "next-intl/server";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

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
        <html lang={locale} dir={dir} className={inter.variable} suppressHydrationWarning>
            <body suppressHydrationWarning>
                <Providers defaultTheme={theme} locale={locale} messages={messages}>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
