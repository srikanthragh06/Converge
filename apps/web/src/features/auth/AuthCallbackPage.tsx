import { useNavigate } from "react-router-dom";
import AuthStatus from "./components/AuthStatus";
import Button from "@/components/ui/Button";
import useGoogleAuthCallback from "./hooks/useGoogleAuthCallback";

/**
 * Handles the redirect back from Google's OAuth flow (pp 60–62 / 64–66):
 * Authenticating… while the callback hook exchanges the code for a session,
 * then Signed in before it moves on to the library, or Sign in failed with
 * a way back to the sign-in page.
 */
const AuthCallbackPage = () => {
    const navigate = useNavigate();
    const { authStatus } = useGoogleAuthCallback(); // current state of the OAuth exchange: PENDING, SUCCESSFUL, or FAILED

    if (authStatus === "SUCCESSFUL")
        return (
            <AuthStatus
                tone="success"
                title="Signed in"
                detail="Taking you to your library…"
            />
        );
    if (authStatus === "FAILED")
        return (
            <AuthStatus
                tone="error"
                title="Sign in failed"
                detail="The sign-in didn't go through. Please try again."
                action={
                    <Button onClick={() => navigate("/auth")}>
                        Back to sign in
                    </Button>
                }
            />
        );
    return <AuthStatus tone="pending" title="Authenticating…" />;
};

export default AuthCallbackPage;
