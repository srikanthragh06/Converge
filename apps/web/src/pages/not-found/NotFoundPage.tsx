import Page from "../../components/Page";

/** Rendered when no route matches the current URL. */
const NotFoundPage = () => {
    return (
        <Page className="items-center justify-center gap-4">
            <h1 className="text-4xl font-bold">404</h1>
            <p className="text-text-secondary">Page not found</p>
        </Page>
    );
};

export default NotFoundPage;
