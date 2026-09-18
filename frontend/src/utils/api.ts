// ─── Type Definitions ────────────────────────────────────────────────────────

export interface CaseSource {
  id: number;
  name: string;
  citation: string;
  date: string;
  snippet: string;
  absolute_url?: string;
}

export type AnalysisStatus =
  | 'success'
  | 'no_results'
  | 'data_error'
  | 'complete'
  | 'streaming'
  | 'error'
  | string;

export interface AnalysisResponse {
  answer: string;
  citations: string[];
  sources: CaseSource[];
  processing_time_ms: number;
  status: AnalysisStatus;
}

export interface ApiError {
  detail: string;
}

interface StreamPayload {
  chunk?: string;
  sources?: CaseSource[];
  result?: AnalysisResponse;
  error?: string;
}

// ─── Configuration ───────────────────────────────────────────────────────────

const DEFAULT_API_BASE_URL = 'http://localhost:8000/api';

const getBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;

  if (!envUrl) {
    console.warn(
      `API URL environment variable is missing. Defaulting to ${DEFAULT_API_BASE_URL}`
    );
    return DEFAULT_API_BASE_URL;
  }

  const cleanUrl = envUrl.replace(/\/+$/, '');
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
};

const API_BASE_URL = getBaseUrl();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getErrorMessage = async (
  response: Response,
  fallback: string
): Promise<string> => {
  const errorData = (await response.json().catch(() => null)) as ApiError | null;

  if (errorData?.detail) {
    return errorData.detail;
  }

  return `${fallback} (${response.status} ${response.statusText})`;
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw new DOMException('Request aborted.', 'AbortError');
  }
};

// ─── API Client ──────────────────────────────────────────────────────────────

/**
 * Performs deep analysis using the LLM with token streaming.
 * Delivers source metadata before yielding accumulated answer text.
 */
export const analyzeQuestionStream = async (
  query: string,
  onChunk: (text: string) => void,
  onSources: (sources: CaseSource[]) => void,
  signal?: AbortSignal
): Promise<AnalysisResponse> => {
  throwIfAborted(signal);

  const response = await fetch(`${API_BASE_URL}/analysis/stream`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
    signal,
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, 'Failed to analyze question')
    );
  }

  if (!response.body) {
    throw new Error('Streaming is not supported by this browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');

  let finalData: AnalysisResponse | null = null;
  let streamError: string | null = null;
  let streamedText = '';
  let buffer = '';

  const processLine = (line: string) => {
    const trimmedLine = line.trim();

    if (!trimmedLine || !trimmedLine.startsWith('data: ')) {
      return;
    }

    const dataStr = trimmedLine.slice(6).trim();

    if (!dataStr || dataStr === '[DONE]') {
      return;
    }

    try {
      const data = JSON.parse(dataStr) as StreamPayload;

      if (typeof data.error === 'string' && data.error.trim()) {
        streamError = data.error;
        return;
      }

      if (typeof data.chunk === 'string') {
        streamedText += data.chunk;
        onChunk(streamedText);
      }

      if (Array.isArray(data.sources)) {
        onSources(data.sources);
      }

      if (data.result) {
        finalData = data.result;
      }
    } catch (error) {
      console.error('Error parsing stream event.', error);
    }
  };

  try {
    while (true) {
      throwIfAborted(signal);

      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        processLine(line);
      }

      if (streamError) {
        throw new Error(streamError);
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      processLine(buffer);
    }

    if (streamError) {
      throw new Error(streamError);
    }

    if (!finalData) {
      throw new Error('Stream completed but no final result was received.');
    }

    return finalData;
  } finally {
    reader.releaseLock();
  }
};
