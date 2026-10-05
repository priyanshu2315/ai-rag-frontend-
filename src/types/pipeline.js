/**
 * @typedef {object} EmbeddingDiagnostic
 * @property {string} model
 * @property {number} tokenCount
 * @property {number} tokenLimit
 * @property {boolean} withinLimit
 * @property {number=} dimensions
 */

/**
 * @typedef {object} ChunkMetadata
 * @property {number} page_number
 * @property {number[]} source_pages
 * @property {number} chunk_index
 * @property {string} document_title
 * @property {string[]} heading_path
 * @property {string} section_id
 * @property {number} section_part_index
 * @property {string} chunker_version
 * @property {number=} child_index
 * @property {EmbeddingDiagnostic=} embedding
 */

/**
 * Saved parent returned by get-all-parent-chunk and data.parent in the child response.
 * @typedef {object} Parent
 * @property {string} id
 * @property {string} documentId
 * @property {string} text
 * @property {string} searchText
 * @property {string|null} prevParentId
 * @property {string|null} nextParentId
 * @property {number} totalChildren
 * @property {ChunkMetadata} metadata
 */

/**
 * Saved child returned by get-all-child-chunk. Vectors arrive only through REST.
 * @typedef {object} Child
 * @property {string} id
 * @property {string} parentId
 * @property {string} documentId
 * @property {string} text
 * @property {string} searchText
 * @property {ChunkMetadata} metadata
 * @property {number[]} embedding
 * @property {number} embeddingDimensions
 */

export {};
