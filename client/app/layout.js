import { cookies } from "next/headers";
import { getLocale, getMessages } from "next-intl/server";
import { Noto_Sans_Arabic } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const notoSansArabic = Noto_Sans_Arabic({
    subsets: ["arabic", "latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-sans-base",
});

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
        <html lang={locale} dir={dir} className={notoSansArabic.variable} suppressHydrationWarning>
            <body suppressHydrationWarning>
                <Providers defaultTheme={theme} locale={locale} messages={messages}>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
