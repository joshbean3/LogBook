import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ writeFile: vi.fn(), deleteFile: vi.fn() }));
const share = vi.hoisted(() => ({ share: vi.fn() }));
vi.mock('@/lib/native', () => ({ isNative: true }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: fs, Directory: { Cache: 'CACHE' }, Encoding: { UTF8: 'utf8' } }));
vi.mock('@capacitor/share', () => ({ Share: share }));

import { deliverExport } from './exportFile';

describe('export in the iPhone app', () => {
  beforeEach(() => {
    fs.writeFile.mockReset().mockResolvedValue({ uri: 'file:///cache/logbook-2026-11-10.json' });
    fs.deleteFile.mockReset().mockResolvedValue(undefined);
    share.share.mockReset();
  });
  it('writes the JSON to the cache folder and opens the share sheet on that file', async () => {
    share.share.mockResolvedValue({ activityType: 'com.apple.DocumentManagerUICore.SaveToFiles' });
    await expect(deliverExport({ app: 'Logbook', version: 2 }, 'logbook-2026-11-10.json')).resolves.toBe('shared');
    expect(fs.writeFile).toHaveBeenCalledWith({ path: 'logbook-2026-11-10.json', data: JSON.stringify({ app: 'Logbook', version: 2 }, null, 2), directory: 'CACHE', encoding: 'utf8' });
    expect(share.share).toHaveBeenCalledWith({ title: 'logbook-2026-11-10.json', files: ['file:///cache/logbook-2026-11-10.json'] });
    // the whole log is not left in a temporary folder
    expect(fs.deleteFile).toHaveBeenCalledWith({ path: 'logbook-2026-11-10.json', directory: 'CACHE' });
  });
  it('answers canceled, not shared, when the share sheet is closed', async () => {
    share.share.mockRejectedValue(new Error('Share canceled'));
    await expect(deliverExport({}, 'x.json')).resolves.toBe('canceled');
    expect(fs.deleteFile).toHaveBeenCalled();
  });
  it('fails when the file cannot be written or shared', async () => {
    share.share.mockRejectedValue(new Error('No app can open this'));
    await expect(deliverExport({}, 'x.json')).rejects.toThrow('No app can open this');
    fs.writeFile.mockRejectedValue(new Error('disk full'));
    await expect(deliverExport({}, 'x.json')).rejects.toThrow('disk full');
  });
});
