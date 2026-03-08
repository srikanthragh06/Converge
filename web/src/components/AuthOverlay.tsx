// AuthOverlay: full-screen overlay shown when the user is not authenticated.
// Renders on top of the host page with a blurred backdrop.
// Drop this into any page that requires auth.

import { useAtomValue } from "jotai";
import { FcGoogle } from "react-icons/fc";
import { supabase } from "../lib/supabase";
import { isAuthedAtom } from "../atoms/uiAtoms";

function AuthOverlay() {
    const isAuthed = useAtomValue(isAuthedAtom);

    if (isAuthed) return null;

    const handleSignIn = async () => {
        // Pass the current path as ?from= so AuthCallbackPage can navigate back after sign-in.
        const from = encodeURIComponent(window.location.pathname);
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback?from=${from}`,
            },
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/60">
            <div className="flex flex-col items-center gap-6 bg-[#2a2a2a] rounded-2xl px-10 py-10 shadow-2xl">
                <p className="text-2xl font-bold text-zinc-100">Converge</p>
                <p className="text-sm text-zinc-400">
                    Sign in to start collaborating
                </p>
                <button
                    onClick={handleSignIn}
                    className="flex items-center gap-3 px-5 py-3 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 text-sm font-medium rounded-lg shadow transition-colors cursor-pointer"
                >
                    <FcGoogle size={20} />
                    Sign in with Google
                </button>
            </div>
        </div>
    );
}

export default AuthOverlay;
