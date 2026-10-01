import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { showToast } from "./toast";

/** Statuses a query shouldn't retry: asking again won't change the answer. */
const NO_RETRY_STATUSES = [403, 404];

/**
 * The app's single QueryClient. Failed actions (mutations) show an error
 * toast from their `meta.errorMessage`, so call sites need no try/catch;
 * failed loads (queries) are only logged.
 */
export const queryClient = new QueryClient({
    queryCache: new QueryCache({
        onError: (error, query) => {
            console.error("Query failed:", query.queryKey, error);
        },
    }),
    mutationCache: new MutationCache({
        onError: (error, variables, _context, mutation) => {
            console.error("Mutation failed:", error);
            const errorMessage = mutation.meta?.errorMessage;
            const message =
                typeof errorMessage === "function"
                    ? errorMessage(variables)
                    : (errorMessage ?? "Something went wrong");
            showToast(message, { tone: "error" });
        },
    }),
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => {
                const status = isAxiosError(error)
                    ? error.response?.status
                    : undefined;
                if (status !== undefined && NO_RETRY_STATUSES.includes(status))
                    return false;
                return failureCount < 3;
            },
        },
    },
});
