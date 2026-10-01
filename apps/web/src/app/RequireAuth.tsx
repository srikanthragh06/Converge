import { useAtomValue } from "jotai";
import { Navigate, Outlet } from "react-router-dom";
import { authAtom } from "@/atoms/auth";
import AuthStatus from "@/features/auth/components/AuthStatus";
import DelayedRender from "@/components/common/DelayedRender";

/**
 * Layout route for the signed-in pages: shows the Authenticating screen
 * while /auth/me resolves, sends a signed-out user to /auth, and otherwise
 * renders the matched page.
 */
const RequireAuth = () => {
    const auth = useAtomValue(authAtom);

    if (auth.status === "loading")
        return (
            <DelayedRender>
                <AuthStatus tone="pending" title="Authenticating…" />
            </DelayedRender>
        );

    if (auth.status === "unauthenticated") return <Navigate to="/auth" />;

    return <Outlet />;
};

export default RequireAuth;
