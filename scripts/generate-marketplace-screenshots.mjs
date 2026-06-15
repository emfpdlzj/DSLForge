import fs from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve('media/screenshots');

fs.mkdirSync(outputDir, { recursive: true });

const colors = {
  bg0: '#08111f',
  bg1: '#0d1b2a',
  bg2: '#11263a',
  panel: '#101a28',
  panelBorder: '#24364f',
  editor: '#0c1623',
  editorBorder: '#213247',
  text: '#edf3ff',
  muted: '#9db2c9',
  subtle: '#7e95ad',
  green: '#62d394',
  amber: '#ffcf66',
  red: '#ff7b7b',
  blue: '#6bb4ff',
  teal: '#5fd1d8'
};

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function multilineText(x, y, lines, options = {}) {
  const {
    fill = colors.text,
    size = 28,
    lineHeight = size * 1.45,
    weight = 400,
    family = 'SF Pro Text, Inter, Arial, sans-serif'
  } = options;

  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : lineHeight;
      return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join('');

  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" font-family="${family}">${tspans}</text>`;
}

function codeBlock(x, y, width, lines, options = {}) {
  const {
    height = 220,
    stroke = colors.editorBorder,
    fill = colors.editor,
    accent = colors.blue
  } = options;

  const lineSvg = lines
    .map((line, index) => {
      const lineY = y + 44 + index * 28;
      return multilineText(x + 24, lineY, [line], {
        fill: index === 0 ? accent : '#d7e5ff',
        size: 20,
        family: 'SFMono-Regular, Menlo, Consolas, monospace'
      });
    })
    .join('');

  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="${fill}" stroke="${stroke}" />
    ${lineSvg}
  `;
}

function pill(x, y, label, fill, textFill = '#08111f') {
  const width = Math.max(112, label.length * 11 + 34);
  return `
    <rect x="${x}" y="${y}" width="${width}" height="38" rx="19" fill="${fill}" />
    <text x="${x + width / 2}" y="${y + 25}" text-anchor="middle" fill="${textFill}" font-size="18" font-weight="700" font-family="SF Pro Text, Inter, Arial, sans-serif">${escapeXml(label)}</text>
  `;
}

function windowFrame({ title, subtitle, accent, body }) {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${colors.bg0}" />
        <stop offset="52%" stop-color="${colors.bg1}" />
        <stop offset="100%" stop-color="${colors.bg2}" />
      </linearGradient>
      <linearGradient id="glow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.30" />
        <stop offset="100%" stop-color="${colors.blue}" stop-opacity="0.06" />
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="18" stdDeviation="28" flood-color="#030813" flood-opacity="0.45" />
      </filter>
    </defs>

    <rect width="1600" height="1000" fill="url(#bg)" />
    <circle cx="1270" cy="180" r="230" fill="url(#glow)" />
    <circle cx="250" cy="820" r="180" fill="${accent}" opacity="0.08" />

    <rect x="72" y="66" width="1456" height="868" rx="34" fill="#0b1420" stroke="#223248" filter="url(#shadow)" />
    <rect x="72" y="66" width="1456" height="78" rx="34" fill="#0e1825" />
    <circle cx="118" cy="105" r="10" fill="#ff6d7a" />
    <circle cx="148" cy="105" r="10" fill="#ffcf66" />
    <circle cx="178" cy="105" r="10" fill="#62d394" />
    <text x="228" y="114" fill="${colors.text}" font-size="24" font-weight="700" font-family="SF Pro Text, Inter, Arial, sans-serif">${escapeXml(title)}</text>
    <text x="228" y="140" fill="${colors.muted}" font-size="16" font-family="SF Pro Text, Inter, Arial, sans-serif">${escapeXml(subtitle)}</text>
    <text x="1402" y="112" fill="${colors.subtle}" font-size="16" text-anchor="end" font-family="SF Pro Text, Inter, Arial, sans-serif">DSLForge • Langium v0.1</text>

    ${body}
  </svg>`;
}

function sidebar(items, footer) {
  const rows = items
    .map(
      (item, index) => `
      <rect x="110" y="${192 + index * 52}" width="286" height="40" rx="14" fill="${item.active ? '#13253a' : 'transparent'}" />
      <circle cx="136" cy="${212 + index * 52}" r="5" fill="${item.dot ?? colors.teal}" />
      <text x="156" y="${218 + index * 52}" fill="${item.active ? colors.text : colors.muted}" font-size="19" font-family="SF Pro Text, Inter, Arial, sans-serif">${escapeXml(item.label)}</text>`
    )
    .join('');

  return `
    <rect x="98" y="166" width="314" height="720" rx="26" fill="${colors.panel}" stroke="${colors.panelBorder}" />
    <text x="128" y="208" fill="${colors.subtle}" font-size="16" font-weight="700" font-family="SF Pro Text, Inter, Arial, sans-serif">WORKSPACE</text>
    ${rows}
    <text x="128" y="846" fill="${colors.subtle}" font-size="15" font-family="SF Pro Text, Inter, Arial, sans-serif">${escapeXml(footer)}</text>
  `;
}

function screenshotValidationConfigured() {
  return windowFrame({
    title: 'Validate Current Grammar',
    subtitle: 'Configured command path selected first, without AI involvement.',
    accent: colors.green,
    body: `
      ${sidebar(
        [
          { label: 'src/language/configured.langium', active: true, dot: colors.green },
          { label: '.vscode/settings.json' },
          { label: 'package.json' },
          { label: 'scripts/validate-configured.js' },
          { label: 'Problems (1)' },
          { label: 'Output: DSLForge' }
        ],
        'Priority: setting → package.json script → guidance'
      )}

      <rect x="438" y="166" width="646" height="432" rx="28" fill="${colors.panel}" stroke="${colors.panelBorder}" />
      <text x="474" y="214" fill="${colors.subtle}" font-size="16" font-weight="700" font-family="SF Pro Text, Inter, Arial, sans-serif">ACTIVE GRAMMAR</text>
      ${codeBlock(470, 240, 582, [
        'grammar Configured',
        '',
        'entry Model:',
        '  items+=Entity*;',
        '',
        'Entity:',
        '  "entity" name=ID;'
      ], { height: 308, accent: colors.green })}

      <rect x="1112" y="166" width="356" height="242" rx="28" fill="${colors.panel}" stroke="${colors.panelBorder}" />
      <text x="1142" y="214" fill="${colors.subtle}" font-size="16" font-weight="700" font-family="SF Pro Text, Inter, Arial, sans-serif">RESULT</text>
      ${pill(1142, 236, 'NON-AI', colors.green)}
      ${pill(1268, 236, 'CFG001', '#15384f', colors.blue)}
      ${multilineText(1142, 320, [
        'DSLForge validation succeeded using',
        'the user-configured validation command',
        'from dslforge.validation.command.',
        '',
        '1 error(s), 0 warning(s).'
      ], { size: 21, fill: colors.text })}

      <rect x="1112" y="430" width="356" height="170" rx="28" fill="${colors.panel}" stroke="${colors.panelBorder}" />
      <text x="1142" y="474" fill="${colors.subtle}" font-size="16" font-weight="700" font-family="SF Pro Text, Inter, Arial, sans-serif">QUICK ACTIONS</text>
      ${pill(1142, 500, 'Show Problems', '#14304d', colors.blue)}
      ${pill(1288, 500, 'Show Output', '#14304d', colors.blue)}
      ${pill(1142, 552, 'Open Validation Settings', '#17273a', colors.text)}

      <rect x="438" y="624" width="1030" height="262" rx="28" fill="${colors.panel}" stroke="${colors.panelBorder}" />
      <text x="474" y="668" fill="${colors.subtle}" font-size="16" font-weight="700" font-family="SF Pro Text, Inter, Arial, sans-serif">OUTPUT • DSLForge</text>
      ${multilineText(474, 718, [
        'DSLForge Validation Report',
        'source: user-configured',
        'detail: Using the user-configured validation command from dslforge.validation.command.',
        'rationale: Validation source priority matched the workspace setting first.',
        'src/language/configured.langium:5:3 error CFG001: Configured command path selected by DSLForge'
      ], { size: 20, family: 'SFMono-Regular, Menlo, Consolas, monospace', fill: '#d7e5ff' })}
    `
  });
}

function screenshotValidationGuidance() {
  return windowFrame({
    title: 'Validation Setup Guidance',
    subtitle: 'When no command exists, DSLForge stops and points to the real workspace fix.',
    accent: colors.amber,
    body: `
      ${sidebar(
        [
          { label: 'src/language/missing.langium', active: true, dot: colors.amber },
          { label: 'package.json' },
          { label: 'Problems (1)' },
          { label: 'Output: DSLForge' }
        ],
        'No fake fallback validator is invented'
      )}

      <rect x="438" y="166" width="1030" height="180" rx="28" fill="#231a0d" stroke="#5a4320" />
      <text x="474" y="214" fill="#ffd890" font-size="16" font-weight="700" font-family="SF Pro Text, Inter, Arial, sans-serif">WARNING</text>
      ${multilineText(474, 264, [
        'DSLForge could not resolve a validation command.',
        'Configure dslforge.validation.command or add a supported package.json script.'
      ], { size: 30, fill: '#fff2d3', weight: 700 })}
      ${pill(474, 288, 'Open Validation Settings', '#ffe0a3', '#563c00')}
      ${pill(716, 288, 'Open Workspace package.json', '#ffe0a3', '#563c00')}
      ${pill(1004, 288, 'Show Problems', '#332514', '#fff2d3')}

      <rect x="438" y="372" width="480" height="514" rx="28" fill="${colors.panel}" stroke="${colors.panelBorder}" />
      <text x="474" y="416" fill="${colors.subtle}" font-size="16" font-weight="700" font-family="SF Pro Text, Inter, Arial, sans-serif">PACKAGE.JSON</text>
      ${codeBlock(470, 440, 416, [
        '{',
        '  \"name\": \"dslforge-fixture-missing\",',
        '  \"private\": true,',
        '  \"scripts\": {',
        '    \"build\": \"echo build only\"',
        '  }',
        '}'
      ], { height: 378, accent: colors.amber })}

      <rect x="944" y="372" width="524" height="514" rx="28" fill="${colors.panel}" stroke="${colors.panelBorder}" />
      <text x="980" y="416" fill="${colors.subtle}" font-size="16" font-weight="700" font-family="SF Pro Text, Inter, Arial, sans-serif">PROBLEMS / GUIDANCE</text>
      ${multilineText(980, 474, [
        'dslforge.validation.missing',
        '',
        'No preferred validation script was found in package.json.',
        'Checked: validate, langium:generate, build.',
        '',
        'Quick Fix',
        '• Open Validation Settings',
        '• Open Workspace package.json'
      ], { size: 21, fill: colors.text })}
      ${pill(980, 730, 'SETUP REQUIRED', '#4a3518', '#ffe0a3')}
    `
  });
}

function screenshotAiGateBlocked() {
  return windowFrame({
    title: 'Explain Current Grammar',
    subtitle: 'AI commands stop immediately when no supported VS Code model environment is available.',
    accent: colors.red,
    body: `
      ${sidebar(
        [
          { label: 'src/language/main.langium', active: true, dot: colors.red },
          { label: 'src/language/shared.langium' },
          { label: 'src/language/tokens.langium' },
          { label: 'langium-config.json' },
          { label: 'Output: DSLForge' }
        ],
        'AI commands never fake a fallback result'
      )}

      <rect x="438" y="166" width="1030" height="214" rx="28" fill="#251116" stroke="#60303d" />
      <text x="474" y="214" fill="#ffb8c1" font-size="16" font-weight="700" font-family="SF Pro Text, Inter, Arial, sans-serif">AI GATE</text>
      ${multilineText(474, 264, [
        'DSLForge requires GitHub Copilot or another supported',
        'VS Code model environment to run Explain Current Grammar.',
        'No chat models are currently available.'
      ], { size: 30, fill: '#fff0f3', weight: 700 })}
      ${pill(474, 314, 'Open Settings', '#ffd3da', '#5f1220')}
      ${pill(632, 314, 'Show Output', '#381821', '#fff0f3')}

      <rect x="438" y="406" width="508" height="480" rx="28" fill="${colors.panel}" stroke="${colors.panelBorder}" />
      <text x="474" y="450" fill="${colors.subtle}" font-size="16" font-weight="700" font-family="SF Pro Text, Inter, Arial, sans-serif">OUTPUT • DSLForge AI Gate</text>
      ${multilineText(474, 502, [
        'status: missing_model',
        'available models: 0',
        'selected model: none',
        '',
        'message: DSLForge requires GitHub Copilot or another',
        'supported VS Code model environment to run',
        'Explain Current Grammar. No chat models are',
        'currently available.'
      ], { size: 20, family: 'SFMono-Regular, Menlo, Consolas, monospace', fill: '#d7e5ff' })}

      <rect x="972" y="406" width="496" height="480" rx="28" fill="${colors.panel}" stroke="${colors.panelBorder}" />
      <text x="1008" y="450" fill="${colors.subtle}" font-size="16" font-weight="700" font-family="SF Pro Text, Inter, Arial, sans-serif">WHY THIS MATTERS</text>
      ${multilineText(1008, 510, [
        '• No markdown preview opens when access is unavailable.',
        '• No placeholder explanation is fabricated.',
        '• The user sees setup or sign-in guidance instead.',
        '',
        'AI-backed commands',
        '• Explain Current Grammar',
        '• Create DSL Scaffold',
        '• Generate Sample DSL'
      ], { size: 22, fill: colors.text })}
      ${pill(1008, 768, 'NO FAKE FALLBACK', '#4a1922', '#ffd3da')}
    `
  });
}

function screenshotImportContext() {
  return windowFrame({
    title: 'Import-Aware Context Selection',
    subtitle: 'DSLForge follows the active grammar import chain before validation or AI-scoped work.',
    accent: colors.teal,
    body: `
      ${sidebar(
        [
          { label: 'src/language/main.langium', active: true, dot: colors.teal },
          { label: 'src/language/shared.langium', dot: colors.teal },
          { label: 'src/language/tokens.langium', dot: colors.teal },
          { label: 'langium-config.json' },
          { label: 'package.json' }
        ],
        'Context is selected from the real workspace'
      )}

      <rect x="438" y="166" width="436" height="340" rx="28" fill="${colors.panel}" stroke="${colors.panelBorder}" />
      <text x="474" y="214" fill="${colors.subtle}" font-size="16" font-weight="700" font-family="SF Pro Text, Inter, Arial, sans-serif">ACTIVE FILE</text>
      ${codeBlock(470, 240, 372, [
        'grammar ImportContext',
        '',
        'import \"./shared.langium\"',
        '',
        'entry Main:',
        '  \"main\" name=ID;'
      ], { height: 232, accent: colors.teal })}

      <rect x="900" y="166" width="568" height="340" rx="28" fill="${colors.panel}" stroke="${colors.panelBorder}" />
      <text x="936" y="214" fill="${colors.subtle}" font-size="16" font-weight="700" font-family="SF Pro Text, Inter, Arial, sans-serif">SELECTED CONTEXT FILES</text>
      ${multilineText(936, 272, [
        '1. src/language/main.langium',
        '2. src/language/shared.langium',
        '3. src/language/tokens.langium',
        '4. langium-config.json',
        '5. package.json'
      ], { size: 25, fill: colors.text })}
      ${pill(936, 398, 'TRANSITIVE IMPORTS INCLUDED', '#17363a', '#a9f4f6')}

      <rect x="438" y="532" width="1030" height="354" rx="28" fill="${colors.panel}" stroke="${colors.panelBorder}" />
      <text x="474" y="576" fill="${colors.subtle}" font-size="16" font-weight="700" font-family="SF Pro Text, Inter, Arial, sans-serif">OUTPUT • VALIDATION REPORT</text>
      ${multilineText(474, 632, [
        'source: package-script',
        'detail: Using package.json script \"validate\" via npm.',
        'Context Notes',
        '• shared.langium selected because it is imported by main.langium',
        '• tokens.langium selected because it is transitively imported',
        'src/language/main.langium:5:3 error IMP001: Import-aware validation path selected by DSLForge'
      ], { size: 21, family: 'SFMono-Regular, Menlo, Consolas, monospace', fill: '#d7e5ff' })}
    `
  });
}

const screenshots = [
  ['validation-configured.svg', screenshotValidationConfigured()],
  ['validation-guidance.svg', screenshotValidationGuidance()],
  ['ai-gate-blocked.svg', screenshotAiGateBlocked()],
  ['import-context-selection.svg', screenshotImportContext()]
];

for (const [fileName, contents] of screenshots) {
  fs.writeFileSync(path.join(outputDir, fileName), contents, 'utf8');
}

console.log(`Generated ${screenshots.length} SVG marketplace screenshots in ${outputDir}`);
