import { MAX_IMAGE_CHARS } from '../../shared/visuals';
import { showToast } from '../toast';

/**
 * Somewhere to drop a crosshair or hitmarker image.
 *
 * The file is read here and kept as its own bytes, which is the fix this
 * whole feature exists for: what Krunker stores is a URL, and a URL to
 * somewhere like Discord stops resolving without warning, so the crosshair
 * you have been using for a month is gone in the middle of a match. Nothing
 * that is dropped here is ever fetched again.
 *
 * Same shape as the userscripts drop zone, including the trap it found: the
 * picker's `files` is a live list that setting `value = ''` empties, so the
 * copy has to be taken before the clear.
 */

export interface ImageDropSpec {
  readonly label: string;
  readonly hint: string;
  readonly onPick: (dataUrl: string) => void;
}

const TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export function imageDrop(spec: ImageDropSpec): HTMLElement {
  const zone = document.createElement('div');
  zone.className = 'drop';

  const big = document.createElement('span');
  big.className = 'big';
  big.textContent = spec.label;
  const small = document.createElement('span');
  small.className = 'small';
  small.textContent = spec.hint;

  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = TYPES.join(',');
  picker.hidden = true;
  picker.addEventListener('change', () => {
    const chosen = [...(picker.files ?? [])];
    picker.value = '';
    void take(chosen[0], spec.onPick);
  });

  zone.append(big, small, picker);
  zone.addEventListener('click', () => picker.click());

  const over = (event: DragEvent): void => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    // Refusing the drag here hands the file to Chromium, which navigates the
    // page to it, and in a client that is the whole session.
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    zone.classList.add('over');
  };
  zone.addEventListener('dragenter', over);
  zone.addEventListener('dragover', over);
  zone.addEventListener('dragleave', (event) => {
    const to = event.relatedTarget;
    if (to instanceof Node && zone.contains(to)) return;
    zone.classList.remove('over');
  });
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('over');
    void take([...(event.dataTransfer?.files ?? [])][0], spec.onPick);
  });

  return zone;
}

async function take(file: File | undefined, onPick: (dataUrl: string) => void): Promise<void> {
  if (!file) return;

  if (!TYPES.includes(file.type)) {
    showToast('That has to be a PNG, JPEG, GIF or WebP');
    return;
  }

  let url: string;
  try {
    url = await read(file);
  } catch {
    showToast(`Could not read "${file.name}"`);
    return;
  }

  if (url.length > MAX_IMAGE_CHARS) {
    // The file is kept in config.json, which is read at startup and rewritten
    // on every settings change. A crosshair does not need to be a megabyte.
    showToast('That image is too big. Around 190KB is the limit');
    return;
  }

  onPick(url);
}

function read(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => reject(new Error('unreadable'));
    reader.readAsDataURL(file);
  });
}
