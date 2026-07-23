import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const globalStyles = readFileSync('src/styles/global.css', 'utf8');
const editorStyles = readFileSync('src/features/service-records/ServiceRecordEditor.module.css', 'utf8');
const detailStyles = readFileSync('src/features/service-records/ServiceRecordDetail.module.css', 'utf8');
const historyStyles = readFileSync('src/features/service-records/ServiceRecordHistory.module.css', 'utf8');

function desktopStyles(styles) {
  return styles.split('@media (max-width: 39.99rem)')[0] ?? '';
}

function mobileStyles(styles) {
  return styles.split('@media (max-width: 39.99rem)')[1] ?? '';
}

describe('Service Record responsive style contracts', () => {
  it('uses the shared 48 px control token for Service Record actions', () => {
    expect(globalStyles).toContain('--control-height: 3rem;');
    expect(editorStyles).toContain('height: var(--control-height);');
    expect(editorStyles).toContain('width: var(--control-height);');
    expect(detailStyles).toContain('.confirm { align-items: center; display: flex; gap: var(--space-xxs); min-height: var(--control-height); }');
    expect(detailStyles).toContain('.textAction { min-height: var(--control-height); }');
    expect(historyStyles).toContain('min-height: var(--control-height);');
  });

  it('stacks editor controls on narrow screens while retaining the desktop grid', () => {
    expect(desktopStyles(editorStyles)).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(desktopStyles(editorStyles)).toContain('.sectionActions, .itemActions { align-items: center; display: flex; flex-wrap: wrap;');
    expect(mobileStyles(editorStyles)).toContain('.sectionHeader { align-items: stretch; flex-direction: column; }');
    expect(mobileStyles(editorStyles)).toContain('.sectionActions .add { flex: 1 1 10rem; justify-content: center; }');
    expect(mobileStyles(editorStyles)).toContain('.grid { grid-template-columns: minmax(0, 1fr); }');
    expect(mobileStyles(editorStyles)).toContain('.dateControl { align-items: stretch; flex-direction: column; }');
  });

  it('stacks completion, export, and historical controls on narrow screens while retaining desktop layout', () => {
    expect(desktopStyles(detailStyles)).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(desktopStyles(detailStyles)).toContain('.header, .identity, .sectionHeading, .exportActions, .headerActions, .item, .snapshotList li { align-items: center; display: flex;');
    expect(mobileStyles(detailStyles)).toContain('.header, .identity, .sectionHeading, .exportActions, .headerActions, .item, .snapshotList li, .error { align-items: stretch; display: grid; }');
    expect(mobileStyles(detailStyles)).toContain('.back, .primaryAction, .secondaryAction, .textAction, .error button { width: 100%; }');
    expect(mobileStyles(detailStyles)).toContain('.details { grid-template-columns: 1fr; }');
    expect(mobileStyles(detailStyles)).toContain('.preview { height: 28rem; }');
  });

  it('stacks Service History rows on narrow screens while retaining desktop navigation layout', () => {
    expect(desktopStyles(historyStyles)).toContain('.sectionHeader {\n  align-items: end;\n  display: flex;');
    expect(desktopStyles(historyStyles)).toContain('.recordLink {\n  align-items: start;\n  color: var(--color-ink);\n  display: flex;');
    expect(mobileStyles(historyStyles)).toContain('.sectionHeader,\n  .recordLink {\n    align-items: stretch;\n    display: grid;');
    expect(mobileStyles(historyStyles)).toContain('.createLink {\n    width: 100%;');
  });
});
