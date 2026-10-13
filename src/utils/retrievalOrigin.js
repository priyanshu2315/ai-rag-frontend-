export const originStyle = (origin) => ({ search: 'border-blue/30 bg-blue-lt text-blue',
  chapter_expansion: 'border-indigo-400/40 bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  table_continuation: 'border-purple-400/40 bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
  section_expansion: 'border-teal-400/40 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
  section_sibling: 'border-teal-400/40 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
  section_lead: 'border-cyan-400/40 bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200',
  reference_following: 'border-amber-400/40 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
}[origin?.type] ?? 'border-border bg-surface-2 text-ink-2');

export const originIcon = (origin) => ({ search: '📄', chapter_expansion: '📖', table_continuation: '▦', section_expansion: '§', section_sibling: '📖', section_lead: '📋', reference_following: '🔗' }[origin?.type] ?? '📄');

export const originTooltip = (origin) => origin?.type === 'chapter_expansion' ? `Pulled as part of sequential workflow or procedure in ${origin.chapter ?? 'this chapter'}` : ({ section_sibling: 'Preceding or succeeding passage in section',
  section_lead: 'Header chunk providing column labels and units', table_continuation: 'Connected table row across pages',
  reference_following: 'Target section cited in seed passage', search: 'Direct Search Hit',
}[origin?.type]);
