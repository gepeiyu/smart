import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

interface CheckboxChoice {
  name: string;
  value: string;
  checked?: boolean;
  disabled?: boolean;
}

interface CheckboxConfig {
  message: string;
  choices: CheckboxChoice[];
  pageSize?: number;
  searchable?: boolean;
  validate?: (items: string[]) => boolean | string;
}

function eraseLines(count: number): void {
  for (let i = 0; i < count; i++) {
    process.stdout.write('\x1b[1A\x1b[2K');
  }
}

export async function platformSelectPrompt(config: CheckboxConfig): Promise<string[]> {
  const { message, choices } = config;
  const selected = new Set(choices.filter(c => c.checked && !c.disabled).map(c => c.value));
  let filterText = '';
  let cursorPos = 0;
  let currentPage = 0;
  let renderedLineCount = 0;
  const pageSize = config.pageSize || 10;

  const filtered = (): CheckboxChoice[] => {
    if (!filterText) return choices;
    const lower = filterText.toLowerCase();
    return choices.filter(c => c.name.toLowerCase().includes(lower) || c.value.toLowerCase().includes(lower));
  };

  const displayItems = (): CheckboxChoice[] => {
    const all = filtered();
    const start = currentPage * pageSize;
    return all.slice(start, start + pageSize);
  };

  const render = (): void => {
    const items = displayItems();
    const all = filtered();
    const totalPages = Math.ceil(all.length / pageSize) || 1;

    const lines: string[] = [
      `? ${message}`,
      `> ${filterText ? `Search: ${filterText}` : 'Type to search...'}`,
    ];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const idx = all.indexOf(item);
      const checked = selected.has(item.value) ? '◉' : '○';
      const pointer = idx === cursorPos ? '❯' : ' ';
      const disabled = item.disabled ? ' (disabled)' : '';
      lines.push(`  ${pointer} ${checked} ${item.name}${disabled}`);
    }

    if (all.length > pageSize) {
      lines.push(`  (Page ${currentPage + 1}/${totalPages})`);
    }

    lines.push('  (a) Select All  (i) Invert  (Enter) Confirm');
    process.stdout.write(lines.join('\n') + '\n');
    renderedLineCount = lines.length;
  };

  const cleanup = (result: string[]): void => {
    eraseLines(renderedLineCount);
    renderedLineCount = 0;
    const selectedNames = result.map(v => choices.find(c => c.value === v)?.name || v).join(', ');
    process.stdout.write(`? ${message} ${selectedNames || '(none)'}\n`);
  };

  render();

  const rl = createInterface({ input, output });
  rl.on('SIGINT', () => {
    cleanup([]);
    rl.close();
    process.exit(0);
  });

  const readKey = async (): Promise<string> => {
    return new Promise(resolve => {
      const onData = (key: Buffer) => {
        const str = key.toString();
        process.stdin.removeListener('data', onData);
        resolve(str);
      };
      process.stdin.on('data', onData);
    });
  };

  process.stdin.setRawMode(true);
  process.stdin.resume();

  while (true) {
    const key = await readKey();

    if (key === '\r' || key === '\n') {
      break;
    }

    if (key === '\x03') {
      cleanup([]);
      process.stdin.setRawMode(false);
      rl.close();
      process.exit(0);
    }

    if (key === '\x1b[A') {
      cursorPos = Math.max(0, cursorPos - 1);
    } else if (key === '\x1b[B') {
      cursorPos = Math.min(filtered().length - 1, cursorPos + 1);
    } else if (key === ' ') {
      const all = filtered();
      const item = all[cursorPos];
      if (item && !item.disabled) {
        if (selected.has(item.value)) {
          selected.delete(item.value);
        } else {
          selected.add(item.value);
        }
      }
    } else if (key === 'a' || key === 'A') {
      const all = filtered();
      const allSelected = all.every(c => selected.has(c.value) || c.disabled);
      for (const c of all) {
        if (c.disabled) continue;
        if (allSelected) {
          selected.delete(c.value);
        } else {
          selected.add(c.value);
        }
      }
    } else if (key === 'i' || key === 'I') {
      const all = filtered();
      for (const c of all) {
        if (c.disabled) continue;
        if (selected.has(c.value)) {
          selected.delete(c.value);
        } else {
          selected.add(c.value);
        }
      }
    } else if (key === '\x1b[5~') {
      currentPage = Math.max(0, currentPage - 1);
      cursorPos = currentPage * pageSize;
    } else if (key === '\x1b[6~') {
      const totalPages = Math.ceil(filtered().length / pageSize);
      currentPage = Math.min(totalPages - 1, currentPage + 1);
      cursorPos = currentPage * pageSize;
    } else if (key === '\x7f' || key === '\b') {
      filterText = filterText.slice(0, -1);
      cursorPos = 0;
      currentPage = 0;
    } else if (key.length === 1 && key.charCodeAt(0) >= 32) {
      filterText += key;
      cursorPos = 0;
      currentPage = 0;
    }

    eraseLines(renderedLineCount);
    render();
  }

  process.stdin.setRawMode(false);

  const result = Array.from(selected);
  cleanup(result);
  rl.close();
  return result;
}
