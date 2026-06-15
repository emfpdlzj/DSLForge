export interface CodeBlockSelection {
  heading?: string;
  languageId: string;
  content: string;
  fileTarget?: string;
}

export interface PreviewBundleTarget {
  targetRelativePath: string;
  content: string;
  languageId?: string;
  sourceLabel: string;
}

export interface PreviewSelection {
  label: string;
  description: string;
  detail?: string;
  content?: string;
  suggestedRelativePath?: string;
  bundleTargets?: PreviewBundleTarget[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function getSectionHeading(line: string): string | undefined {
  const match = /^##\s+(?<heading>.+?)\s*$/.exec(line.trim());
  return match?.groups?.heading?.trim();
}

function normalizeFileTarget(rawTarget: string | undefined): string | undefined {
  const trimmed = rawTarget?.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/^['"`]|['"`]$/g, '');
}

function fileTargetFromContextLine(line: string): string | undefined {
  const match =
    /^(?:[-*]\s*)?(?:file target|target file|file path|path)\s*:\s*(?<target>.+)$/i.exec(
      line.trim()
    );

  return normalizeFileTarget(match?.groups?.target);
}

export function extractBodyMarkdown(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const bodyStartIndex = lines.findIndex((line) => line.trim().startsWith('## '));

  if (bodyStartIndex < 0) {
    return markdown.trim();
  }

  return lines.slice(bodyStartIndex).join('\n').trim();
}

export function extractCodeBlockSelections(markdown: string): CodeBlockSelection[] {
  const lines = markdown.split(/\r?\n/);
  const selections: CodeBlockSelection[] = [];
  let currentHeading: string | undefined;
  let lastFileTarget: string | undefined;
  let inCodeBlock = false;
  let currentLanguageId = '';
  let currentCodeLines: string[] = [];
  let currentCodeBlockFileTarget: string | undefined;

  for (const line of lines) {
    const heading = getSectionHeading(line);

    if (!inCodeBlock && heading) {
      currentHeading = heading;
      continue;
    }

    if (!inCodeBlock) {
      const fileTarget = fileTargetFromContextLine(line);

      if (fileTarget) {
        lastFileTarget = fileTarget;
      }
    }

    const fenceMatch = /^```(?<languageId>[a-zA-Z0-9_-]*)\s*$/.exec(line.trim());

    if (fenceMatch) {
      if (inCodeBlock) {
        selections.push({
          heading: currentHeading,
          languageId: currentLanguageId,
          content: currentCodeLines.join('\n').trimEnd(),
          fileTarget: currentCodeBlockFileTarget
        });
        inCodeBlock = false;
        currentLanguageId = '';
        currentCodeLines = [];
        currentCodeBlockFileTarget = undefined;
      } else {
        inCodeBlock = true;
        currentLanguageId = fenceMatch.groups?.languageId?.trim() ?? '';
        currentCodeBlockFileTarget = lastFileTarget;
      }

      continue;
    }

    if (inCodeBlock) {
      currentCodeLines.push(line);
    }
  }

  return selections.filter((selection) => selection.content.length > 0);
}

function extensionForLanguageId(languageId: string): string {
  switch (languageId.toLowerCase()) {
    case 'json':
      return '.json';
    case 'xml':
      return '.xml';
    case 'markdown':
      return '.md';
    case 'langium':
      return '.langium';
    case 'antlr':
      return '.g4';
    case 'xtext':
      return '.xtext';
    case 'typescript':
      return '.ts';
    case 'javascript':
      return '.js';
    case 'shell':
    case 'bash':
    case 'sh':
      return '.sh';
    default:
      return '.txt';
  }
}

function defaultRelativePathForSelection(
  featureName: string,
  outputTitle: string,
  index: number,
  languageId: string
): string {
  const featureSlug = slugify(featureName);
  const documentSlug = slugify(outputTitle || featureName);
  const extension = extensionForLanguageId(languageId);

  if (index < 0) {
    return `docs/${documentSlug}.md`;
  }

  const folderName =
    featureName.includes('Sample DSL')
      ? 'examples'
      : featureName.includes('Scaffold')
        ? 'drafts'
        : 'docs';

  return `${folderName}/${featureSlug}-${index + 1}${extension}`;
}

export function buildSelectionSuggestions(
  featureName: string,
  outputTitle: string,
  markdown: string
): PreviewSelection[] {
  const selections: PreviewSelection[] = [
    {
      label: 'Entire Preview Document',
      description: 'Write the full markdown preview, including the DSLForge header.',
      content: markdown.trim(),
      suggestedRelativePath: defaultRelativePathForSelection(
        featureName,
        outputTitle,
        -1,
        'markdown'
      )
    }
  ];
  const bodyMarkdown = extractBodyMarkdown(markdown);

  if (bodyMarkdown.length > 0 && bodyMarkdown !== markdown.trim()) {
    selections.push({
      label: 'Preview Body Only',
      description: 'Write the markdown body without the generated DSLForge header block.',
      content: bodyMarkdown,
      suggestedRelativePath: defaultRelativePathForSelection(
        featureName,
        outputTitle,
        -1,
        'markdown'
      )
    });
  }

  const codeBlockSelections = extractCodeBlockSelections(markdown);

  for (const [index, selection] of codeBlockSelections.entries()) {
    const description = selection.heading
      ? `Code block from ${selection.heading}`
      : 'Code block from preview document';

    selections.push({
      label: `Code Block ${index + 1}`,
      description,
      detail: selection.fileTarget
        ? `file target: ${selection.fileTarget}`
        : selection.languageId
          ? `language: ${selection.languageId}`
          : 'language: plain text',
      content: selection.content,
      suggestedRelativePath:
        selection.fileTarget ??
        defaultRelativePathForSelection(
          featureName,
          outputTitle,
          index,
          selection.languageId
        )
    });
  }

  const bundleTargets: PreviewBundleTarget[] = codeBlockSelections.flatMap(
    (selection, index) =>
      selection.fileTarget
        ? [
            {
              targetRelativePath: selection.fileTarget,
              content: selection.content,
              languageId: selection.languageId,
              sourceLabel: selection.heading
                ? `${selection.heading} code block ${index + 1}`
                : `Code block ${index + 1}`
            }
          ]
        : []
  );

  if (
    featureName.includes('Scaffold') &&
    bundleTargets.length >= 2 &&
    new Set(bundleTargets.map((target) => target.targetRelativePath)).size ===
      bundleTargets.length
  ) {
    selections.push({
      label: 'Scaffold Bundle',
      description: 'Review and apply every scaffold code block with an explicit file target.',
      detail: bundleTargets.map((target) => target.targetRelativePath).join(', '),
      bundleTargets
    });
  }

  return selections;
}

export function buildBundleReviewMarkdown(
  featureName: string,
  bundleTargets: PreviewBundleTarget[]
): string {
  return [
    `# DSLForge ${featureName} Bundle Review`,
    '',
    'Review these file targets before completing the apply step.',
    '',
    ...bundleTargets.flatMap((target) => [
      `## ${target.targetRelativePath}`,
      '',
      `- Source: ${target.sourceLabel}`,
      `- Language: ${target.languageId || 'plain text'}`,
      '',
      `\`\`\`${target.languageId || ''}`,
      target.content,
      '```',
      ''
    ])
  ].join('\n');
}

export function collectConflictingTargets(
  targets: Array<{
    targetRelativePath: string;
    targetSnapshot?: string;
    currentContent?: string;
  }>
): string[] {
  return targets
    .filter(
      (target) =>
        typeof target.targetSnapshot !== 'undefined' &&
        target.currentContent !== target.targetSnapshot
    )
    .map((target) => target.targetRelativePath);
}
