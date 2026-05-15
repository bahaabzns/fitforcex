import { cookies } from "next/headers";
import { Providers } from "./providers";
import "./globals.css";

export const metadata = {
    title: "FitForce X",
    description: "Fitness coaching platform",
};

export default async function RootLayout({ children }) {
    const cookieStore = await cookies();
    const theme = cookieStore.get("theme")?.value ?? "system";

    return (
        <html lang="en" suppressHydrationWarning>
            <body>
                <Providers defaultTheme={theme}>{children}</Providers>
            </body>
        </html>
    );
}
