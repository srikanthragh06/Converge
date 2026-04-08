import useGoogleAuthCallback from "../../hooks/useGoogleAuthCallback";

const AuthCallbackPage = () => {
    const { authStatus } = useGoogleAuthCallback();

    return (
        <div className="w-screen h-screen flex flex-col items-center justify-center">
            {authStatus === "PENDING" && <div>Signing you in...</div>}
            {authStatus === "FAILED" && <div>Sign in failed :(</div>}
            {authStatus === "SUCCESSFUL" && (
                <div>Sign in successful</div>
            )}
        </div>
    );
};

export default AuthCallbackPage;
