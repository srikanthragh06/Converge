import useGoogleAuthCallback from "../../hooks/useGoogleAuthCallback";

const AuthCallbackPage = () => {
    const { authCallbackStatus } = useGoogleAuthCallback();

    return (
        <div className="w-screen h-screen flex flex-col items-center justify-center">
            {authCallbackStatus === "PENDING" && <div>Signing you in...</div>}
            {authCallbackStatus === "FAILED" && <div>Sign in failed :(</div>}
            {authCallbackStatus === "SUCCESSFUL" && (
                <div>Sign in successful</div>
            )}
        </div>
    );
};

export default AuthCallbackPage;
