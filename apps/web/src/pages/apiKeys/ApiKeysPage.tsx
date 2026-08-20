import Page from "../../components/Page";

/**
 * Full-screen API keys page. Placeholder — key listing, creation, and
 * revocation are not yet implemented.
 */
const ApiKeysPage = () => {
    return (
        <Page authRequired haveSidebar>
            <div className="flex flex-col items-center w-full px-4 sm:px-0 pt-4 sm:pt-8">
                <div className="w-full sm:max-w-[600px]">
                    <h1 className="text-text-primary font-bold sm:text-3xl text-xl">
                        API Keys
                    </h1>
                </div>
            </div>
        </Page>
    );
};

export default ApiKeysPage;
