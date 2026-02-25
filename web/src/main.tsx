import { createRoot } from 'react-dom/client'
import App from './App'

// Mount the React app into the #root div defined in index.html.
// The non-null assertion (!) is safe because index.html always has #root.
createRoot(document.getElementById('root')!).render(<App />)
