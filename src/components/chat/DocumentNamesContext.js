import { createContext } from 'react';

/** The documents this account can access, so a source chip can show a real file name. */
const DocumentNamesContext = createContext([]);

export default DocumentNamesContext;
