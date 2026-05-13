import Page from "../../components/Page";

/**
 * Full-screen workspaces page. Lists the authenticated user's workspaces
 * and allows switching between them.
 */
const WorkspacesPage = () => {
    return (
        <Page authRequired haveSidebar>
            <div
                className="mr-10 bg-background-base sticky top-[52px] sm:top-[76px] z-40 pb-4 pt-4 sm:pt-8 w-full
                    flex flex-col space-y-4"
            >
                <div
                    className="text-text-primary px-4 sm:px-8 font-bold
                                flex sm:justify-center justify-start"
                >
                    <h1 className="sm:text-4xl text-2xl sm:mr-[560px]">
                        Workspaces
                    </h1>
                </div>
            </div>
        </Page>
    );
};

export default WorkspacesPage;
