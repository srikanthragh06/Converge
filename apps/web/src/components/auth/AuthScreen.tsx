import type { ReactNode } from "react";

/**
 * Full-screen backdrop for the sign-in and authentication screens (pp 59–66):
 * content centered on the page surface with a soft radial glow behind it,
 * drawn from the elevated-surface token so it follows the theme.
 * @param children - the centered content
 */
const AuthScreen = ({ children }: { children: ReactNode }) => (
    <main className="flex h-dvh w-screen flex-col items-center justify-center bg-surface bg-[radial-gradient(ellipse_60%_55%_at_50%_45%,rgb(var(--surface-elevated))_0%,rgb(var(--surface-elevated)/0.6)_35%,transparent_75%)] px-6 text-center">
        {children}
    </main>
);

export default AuthScreen;
