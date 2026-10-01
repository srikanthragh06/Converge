import type { ReactNode } from "react";
import { LuCheck, LuX } from "react-icons/lu";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/common/Logo";
import AuthScreen from "./AuthScreen";

/** What the status indicator shows. */
export type AuthStatusTone = "pending" | "success" | "error";

/**
 * One authentication state (pp 60–62 / 64–66): the muted Converge mark, a
 * gold spinner or a green check / red × in a ring, a title, an optional
 * muted line, and an optional action (e.g. Back to sign in).
 * @param tone - "pending" (spinner), "success" (check), or "error" (×)
 * @param title - e.g. "Authenticating…" or "Signed in"
 * @param detail - muted line under the title
 * @param action - e.g. a button back to sign in
 */
const AuthStatus = ({
    tone,
    title,
    detail,
    action,
}: {
    tone: AuthStatusTone;
    title: string;
    detail?: string;
    action?: ReactNode;
}) => (
    <AuthScreen>
        <div role="status" className="flex flex-col items-center">
            <LogoMark size={34} className="text-fg-muted" />
            {tone === "pending" ? (
                <span
                    aria-hidden
                    className="mt-9 h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-gold"
                />
            ) : (
                <span
                    aria-hidden
                    className={cn(
                        "mt-9 flex h-11 w-11 items-center justify-center rounded-full border-2 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:stroke-[3]",
                        tone === "success"
                            ? "border-success text-success"
                            : "border-danger text-danger",
                    )}
                >
                    {tone === "success" ? <LuCheck /> : <LuX />}
                </span>
            )}
            <p
                className={cn(
                    "mt-4",
                    tone === "pending"
                        ? "text-sm text-fg-secondary"
                        : "text-base text-fg",
                )}
            >
                {title}
            </p>
            {detail && <p className="mt-1.5 text-sm text-fg-muted">{detail}</p>}
            {action && <div className="mt-5">{action}</div>}
        </div>
    </AuthScreen>
);

export default AuthStatus;
