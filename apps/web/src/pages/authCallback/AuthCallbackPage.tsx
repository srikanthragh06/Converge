import Page from "../../components/Page";
import useGoogleAuthCallback from "../../hooks/useGoogleAuthCallback";

/**
 * Handles the redirect back from Google's OAuth flow. Renders a status
 * message while the callback hook exchanges the code for a session.
 */
const AuthCallbackPage = () => {
    const { authStatus } = useGoogleAuthCallback(); // Current state of the OAuth exchange: PENDING, SUCCESSFUL, or FAILED

    return (
        <Page className="items-center justify-center">
            {authStatus === "PENDING" && <div className="text-text-secondary">Signing you in...</div>}
            {authStatus === "FAILED" && <div className="text-text-secondary">Sign in failed :(</div>}
            {authStatus === "SUCCESSFUL" && <div className="text-text-secondary">Sign in successful</div>}
        </Page>
    );
};

export default AuthCallbackPage;
