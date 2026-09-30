import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Runs onOpen once when the page is reached with `state: { [flag]: true }`,
 * e.g. `navigate("/api-keys", { state: { createKey: true } })`, then clears
 * that state so a reload or Back doesn't trigger it again.
 *
 * onOpen runs during render, so it may only set state of the component that
 * calls this hook.
 * @param flag - the router-state key to look for
 * @param onOpen - what to do on arrival, e.g. open a dialog
 */
const useOpenOnNavigate = (flag: string, onOpen: () => void) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [handledKey, setHandledKey] = useState<string | null>(null); // location key already acted on

    const requested =
        (location.state as Record<string, unknown> | null)?.[flag] === true;

    // Adjusts state during render (not in an effect), once per navigation.
    if (requested && location.key !== handledKey) {
        setHandledKey(location.key);
        onOpen();
    }

    useEffect(() => {
        if (requested)
            navigate(location.pathname, { replace: true, state: null });
    }, [requested, navigate, location.pathname]);
};

export default useOpenOnNavigate;
