/**
 * @typedef {object} DocumentOutlineEntry
 * @property {string} sectionCode
 * @property {string} title
 * @property {number|null} targetPage 1-indexed PDF page.
 * @property {number|null} pageCount
 * DocumentDetails.documentOutline is an optional array of these entries.
 */

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
 * @property {string[]=} table_ids
 * @property {string[]=} linked_table_ids
 * @property {string[]=} row_ids
 * @property {boolean=} is_toc
 * @property {boolean=} isDocumentBoundary
 * @property {string|null=} boundaryTitle
 * @property {string[]=} cross_references
 * @property {Array<string|object>=} references
 * @property {Array<{type: string, table_id?: string, from_page?: number, to_page?: number}>=} relationships
 * @property {{tokenCount: number, tokenLimit: number, withinLimit: boolean}=} token_budget
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
 * @property {number=} rerankScore
 * @property {{type: 'search'|'chapter_expansion'|'table_continuation'|'section_expansion'|'section_sibling'|'section_lead'|'neighbor_expansion'|'reference_following', seedParentId?: string, chapter?: string, tableId?: string, sectionId?: string, reference?: string}=} retrievalOrigin
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

/**
 * Flat source record in the retrieved_chunks SSE event.
 * @typedef {object} RetrievedChunk
 * @property {string} id
 * @property {string} documentId
 * @property {string} text
 * @property {string} searchText
 * @property {string} documentTitle
 * @property {string} fileUrl
 * @property {number} pageNumber
 * @property {number[]} sourcePages
 * @property {number} startOffset
 * @property {number} endOffset
 * @property {string} sectionId
 * @property {string[]} headingPath
 * @property {{type: 'search'|'chapter_expansion'|'table_continuation'|'section_expansion'|'section_sibling'|'section_lead'|'neighbor_expansion'|'reference_following', seedParentId?: string, chapter?: string, tableId?: string, sectionId?: string, reference?: string}} retrievalOrigin
 */

/**
 * @typedef {object} ReasoningChain
 * @property {string} summary
 * @property {Array<{step: number, type: string, title: string, description: string, findings: string}>} steps
 * Delivered in reasoning_chain SSE and message.metadata.reasoningChain.
 */

/**
 * @typedef {object} AnswerCitation
 * @property {{type: string, seedParentId?: string, reference?: string, chapter?: string}=} retrievalOrigin
 * @property {string} sourceId Page labels are not parent IDs.
 * @property {string} displayLabel
 * @property {string} documentId
 * @property {string} documentTitle
 * @property {string} chunkId
 * @property {string|null} fileUrl
 * @property {number} pageNumber
 * @property {number[]} sourcePages
 * @property {number} startOffset
 * @property {number} endOffset
 * @property {string} snippet
 */

/**
 * @typedef {object} AnswerUsageSummary
 * @property {'total_usage_summary'} type
 * @property {number} totalTokens
 * @property {number} totalCostINR
 * @property {string} formattedTotalCost
 * @property {StepCost[]} breakdown
 */

/**
 * @typedef {object} StepCost
 * @property {'step_cost'=} type
 * @property {string} step
 * @property {string} model
 * @property {number} promptTokens
 * @property {number} completionTokens
 * @property {number} totalTokens
 * @property {number} costUSD
 * @property {number} costINR
 * @property {string} formattedINR
 */

/**
 * Unknown server metadata keys are retained without interpreting them.
 * @typedef {Record<string, unknown> & { citations?: AnswerCitation[], totalTokens?: number, totalCostINR?: number, formattedTotalCost?: string }} MessageMetadata
 */

/**
 * @typedef {object} ChatMessage
 * @property {string} id
 * @property {'user'|'assistant'} role
 * @property {string} content
 * @property {MessageMetadata|null=} metadata
 * @property {string} createdAt
 */

/**
 * @typedef {object} ConversationSession
 * @property {string} id
 * @property {string} userId
 * @property {string|null} documentId
 * @property {ChatMessage[]} messages
 */

export {};
