import type { ReactNode } from "react";

/**
 * One numbered step on the MCP setup page (pp 38 / 46): a gold outlined
 * circle with the serif step number, the step title, and its content
 * indented under the title.
 * @param step - the step number
 * @param title - the step heading, e.g. "Get an API key"
 * @param children - the step's content
 */
const StepSection = ({
    step,
    title,
    children,
}: {
    step: number;
    title: string;
    children: ReactNode;
}) => (
    <section className="flex gap-3 sm:gap-4">
        <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold font-serif text-lg text-gold sm:h-9 sm:w-9"
        >
            {step}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-3 pt-0.5 sm:pt-1">
            <h2 className="text-lg font-semibold text-fg sm:text-xl">
                <span className="sr-only">Step {step}: </span>
                {title}
            </h2>
            {children}
        </div>
    </section>
);

export default StepSection;
