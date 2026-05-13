import "./globals.css";

export const metadata = {
    title: "FitForce X",
    description: "Fitness coaching platform",
};

export default function RootLayout({ children }) {
    
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
