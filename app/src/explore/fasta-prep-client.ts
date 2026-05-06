const FASTA_EXT_PATTERN = /\.(fa|fasta|fna)$/i;

export function isFastaFile(file: File): boolean {
  return FASTA_EXT_PATTERN.test(file.name);
}

/** @public */
export type FastaPrepStage = 'queued' | 'embedding' | 'projecting' | 'annotating' | 'bundling';

/** @public */
export interface FastaPrepOptions {
  baseUrl?: string;
  onProgress?: (stage: FastaPrepStage, payload: Record<string, unknown>) => void;
  signal?: AbortSignal;
}

export async function prepareFastaBundle(
  file: File,
  options: FastaPrepOptions = {},
): Promise<File> {
  const baseUrl = options.baseUrl ?? '';
  const formData = new FormData();
  formData.append('file', file);

  const submitResponse = await fetch(`${baseUrl}/api/prepare`, {
    method: 'POST',
    body: formData,
    signal: options.signal,
  });

  if (!submitResponse.ok) {
    let message = `Upload failed (${submitResponse.status}).`;
    try {
      const body = await submitResponse.json();
      if (body?.error) message = String(body.error);
    } catch {
      /* swallow */
    }
    throw new Error(message);
  }

  const { job_id: jobId } = (await submitResponse.json()) as { job_id: string };

  const downloadUrl = await new Promise<string>((resolve, reject) => {
    const es = new EventSource(`${baseUrl}/api/prepare/${jobId}/events`);
    const cleanup = () => es.close();

    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }

    const handleProgress = (stage: FastaPrepStage, payload: Record<string, unknown>) => {
      try {
        options.onProgress?.(stage, payload);
      } catch (err) {
        console.error('fasta-prep onProgress threw:', err);
      }
    };

    es.addEventListener('queued', (ev) => {
      const payload = JSON.parse((ev as MessageEvent).data) as Record<string, unknown>;
      handleProgress('queued', payload);
    });

    es.addEventListener('progress', (ev) => {
      const payload = JSON.parse((ev as MessageEvent).data) as Record<string, unknown>;
      const stage = (payload.stage as FastaPrepStage) ?? 'embedding';
      handleProgress(stage, payload);
    });

    es.addEventListener('done', (ev) => {
      const payload = JSON.parse((ev as MessageEvent).data) as { download_url: string };
      cleanup();
      resolve(payload.download_url);
    });

    es.addEventListener('error', (ev) => {
      let message = 'Bundle preparation failed.';
      const data = (ev as MessageEvent).data;
      if (typeof data === 'string' && data) {
        try {
          const parsed = JSON.parse(data) as { message?: string };
          if (parsed?.message) message = parsed.message;
        } catch {
          /* connection error, no payload */
        }
      }
      cleanup();
      reject(new Error(message));
    });
  });

  const bundleResponse = await fetch(`${baseUrl}${downloadUrl}`, { signal: options.signal });
  if (!bundleResponse.ok) {
    throw new Error(`Bundle download failed (${bundleResponse.status}).`);
  }
  const blob = await bundleResponse.blob();
  const stem = file.name.replace(FASTA_EXT_PATTERN, '');
  return new File([blob], `${stem}.parquetbundle`, { type: 'application/octet-stream' });
}
