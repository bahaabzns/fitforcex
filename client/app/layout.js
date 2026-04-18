import "./globals.css";

export const metadata = {
    title: "FitForce X",
    description: "Fitness coaching platform",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body className="min-h-full flex flex-col">{children}</body>
        </html>
    );
}
