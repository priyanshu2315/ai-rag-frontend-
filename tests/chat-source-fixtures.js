export const fileUrl = 'https://xyz.supabase.co/storage/v1/object/public/documents/Handbook.pdf';
export const retrieved = { type: 'retrieved_chunks', count: 4, chunks: [{
  id: 'c5a1f4b2-test', text: 'Depot Code: D01 Alderbank Yard\nFiscal 2022 Cost: 3,880',
  documentTitle: 'Handbook.pdf', fileUrl, pageNumber: 3, sourcePages: [3], startOffset: 1205, endOffset: 1850,
}] };
export const citations = { type: 'citations', citations: [{ sourceId: 'Page 3',
  displayLabel: 'Handbook.pdf, Page 3 (5. Financial Record)', fileUrl, pageNumber: 3,
  startOffset: 1205, endOffset: 1850, snippet: 'Depot Code: D01 Alderbank Yard...',
}] };
export const usage = { type: 'total_usage_summary', totalTokens: 4120, totalCostINR: 0.0384, formattedTotalCost: '₹0.04',
  breakdown: [{ step: 'Question Splitter', totalTokens: 240, formattedINR: '₹0.0018' },
    { step: 'Relevance Grader', totalTokens: 1850, formattedINR: '₹0.0080' },
    { step: 'Final Answer Generation', totalTokens: 2030, formattedINR: '₹0.0286' }] };

export const v2StepCost = { type: 'step_cost', step: 'Question Splitter', model: 'llama-3.1-8b-instant',
  promptTokens: 142, completionTokens: 28, totalTokens: 170, costUSD: 0.000105, costINR: 0.0102, formattedINR: '₹0.0102' };
export const v2Usage = { type: 'total_usage_summary', totalTokens: 2840, totalCostINR: 0.245, formattedTotalCost: '₹0.25', breakdown: [
  { step: 'Question Splitter', model: 'llama-3.1-8b-instant', promptTokens: 140, completionTokens: 25, totalTokens: 165, costUSD: 0.000009, costINR: 0.0009, formattedINR: '₹0.0009' },
  { step: 'Relevance Grader', model: 'llama-3.1-8b-instant', promptTokens: 1250, completionTokens: 45, totalTokens: 1295, costUSD: 0.000066, costINR: 0.0064, formattedINR: '₹0.0064' },
  { step: 'Final Answer Generation', model: 'openai/gpt-oss-120b', promptTokens: 1120, completionTokens: 260, totalTokens: 1380, costUSD: 0.00245, costINR: 0.2371, formattedINR: '₹0.24' },
] };
export const v2Chunks = [
  { id: 'round1-parent', documentId: 'depot-doc', documentTitle: 'Depot Handbook', fileUrl, text: '| Depot | Cost |\n| --- | --- |\n| D01 | 3,880 |', searchText: 'Document: Depot Handbook\nSection: 5. Financial record',
    pageNumber: 3, sourcePages: [3, 4], startOffset: 124, endOffset: 890, sectionId: 'section-5', headingPath: ['5. Financial record'], retrievalOrigin: { type: 'search' } },
  { id: 'round2-parent', documentId: 'depot-doc', documentTitle: 'Depot Handbook', fileUrl, text: 'D08 fiscal 2023 cost: 4,120',
    pageNumber: 4, sourcePages: [4], startOffset: 891, endOffset: 1100, sectionId: 'section-5', headingPath: ['5. Financial record'], retrievalOrigin: { type: 'table_continuation', seedParentId: 'round1-parent', tableId: 'table-1' } },
];
export const v2Citations = v2Chunks.map((chunk) => ({ sourceId: chunk.sourcePages.length > 1 ? 'Page 3-4' : 'Page 4',
  displayLabel: `Depot Handbook, ${chunk.sourcePages.length > 1 ? 'Page 3-4' : 'Page 4'} (5. Financial record)`,
  chunkId: chunk.id, documentId: chunk.documentId, documentTitle: chunk.documentTitle, fileUrl: chunk.fileUrl,
  pageNumber: chunk.pageNumber, sourcePages: chunk.sourcePages, startOffset: chunk.startOffset, endOffset: chunk.endOffset, snippet: chunk.text.slice(0, 50) }));

// A small, valid three-page PDF. Offsets are computed for its cross-reference table.
export const fixturePdf = () => {
  const passages = ['Introduction', 'Context page', 'Depot Code: D01 Alderbank Yard\nFiscal 2022 Cost: 3,880'];
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [4 0 R 6 0 R 8 0 R] /Count 3 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  passages.forEach((passage, index) => {
    const content = `BT /F1 16 Tf 50 700 Td ${passage.split('\n').map((line, i) => `${i ? '0 -25 Td ' : ''}(${line}) Tj`).join('\n')} ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
};
