import * as assert from 'node:assert/strict';
import {
  buildBundleReviewMarkdown,
  buildSelectionSuggestions,
  collectConflictingTargets,
  extractCodeBlockSelections
} from '../core/aiPreviewApplyModel';

function runExtractCodeBlocksCase(): void {
  const markdown = [
    '# DSLForge DSL Scaffold Proposal',
    '',
    '## Suggested Files',
    '',
    '- File Target: package.json',
    '```json',
    '{',
    '  "name": "sample-workspace"',
    '}',
    '```',
    '',
    '- File Target: src/language/main.langium',
    '```langium',
    'grammar Main',
    '```'
  ].join('\n');
  const selections = extractCodeBlockSelections(markdown);

  assert.equal(selections.length, 2, 'expected two code block selections');
  assert.equal(selections[0].fileTarget, 'package.json');
  assert.equal(selections[1].fileTarget, 'src/language/main.langium');
}

function runSelectionSuggestionsCase(): void {
  const markdown = [
    '# DSLForge DSL Scaffold Proposal',
    '',
    '## Suggested Files',
    '',
    '- File Target: package.json',
    '```json',
    '{',
    '  "name": "sample-workspace"',
    '}',
    '```',
    '',
    '- File Target: src/language/main.langium',
    '```langium',
    'grammar Main',
    '```'
  ].join('\n');
  const selections = buildSelectionSuggestions(
    'Create DSL Scaffold',
    'DSLForge DSL Scaffold Proposal',
    markdown
  );
  const bundleSelection = selections.find(
    (selection) => selection.label === 'Scaffold Bundle'
  );

  assert.ok(bundleSelection, 'expected scaffold bundle selection');
  assert.equal(bundleSelection?.bundleTargets?.length, 2);
  assert.equal(
    bundleSelection?.bundleTargets?.[0].targetRelativePath,
    'package.json'
  );
}

function runBundleReviewMarkdownCase(): void {
  const review = buildBundleReviewMarkdown('Create DSL Scaffold', [
    {
      targetRelativePath: 'package.json',
      content: '{ "name": "workspace" }',
      languageId: 'json',
      sourceLabel: 'Suggested Files code block 1'
    },
    {
      targetRelativePath: 'src/language/main.langium',
      content: 'grammar Main',
      languageId: 'langium',
      sourceLabel: 'Starter Grammar code block 2'
    }
  ]);

  assert.ok(review.includes('## package.json'));
  assert.ok(review.includes('## src/language/main.langium'));
}

function runConflictDetectionCase(): void {
  const conflicts = collectConflictingTargets([
    {
      targetRelativePath: 'package.json',
      targetSnapshot: '{"name":"before"}',
      currentContent: '{"name":"after"}'
    },
    {
      targetRelativePath: 'src/language/main.langium',
      targetSnapshot: 'grammar Main',
      currentContent: 'grammar Main'
    }
  ]);

  assert.deepEqual(conflicts, ['package.json']);
}

function main(): void {
  runExtractCodeBlocksCase();
  runSelectionSuggestionsCase();
  runBundleReviewMarkdownCase();
  runConflictDetectionCase();
  console.log('ai preview apply fixtures passed');
}

main();
