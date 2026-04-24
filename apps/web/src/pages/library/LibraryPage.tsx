import Page from "../../components/Page";

/**
 * Full-screen library page. Lists the authenticated user's documents
 * with search, sorting, and infinite scroll.
 */
const LibraryPage = () => {
    return <Page authRequired></Page>;
};

export default LibraryPage;
