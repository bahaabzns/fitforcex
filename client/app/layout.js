import "./globals.css";

export const metadata = {
    title: "FitForce X",
    description: "Fitness coaching platform",
};

export default function RootLayout({ children }) {
    
    return (
        <html lang="en" className="h-full">
            <body className="h-screen overflow-hidden">{children}</body>
        </html>
    );
}
