import { useState, useCallback, useRef, useEffect } from 'react';
import {
  analyzeQuestionStream,
  CaseSource,
  AnalysisResponse,
} from '../utils/api';

interface UseLegalResearchReturn {
  results: CaseSource[];
  analysis: AnalysisResponse | null;
  isSearching: boolean;
  isAnalyzing: boolean;
  error: string | null;
  isBudgetExceeded: boolean;
  currentQuery: string;
  searchWithQuery: (query: string) => void;
  stopSearch: () => void;
}

const isAbortError = (error: unknown): boolean => {
  return (
    error instanceof DOMException ||
    (typeof error === 'object' && error !== null && 'name' in error)
  )
    ? (error as { name?: string }).name === 'AbortError'
    : false;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred during research.';
};

const isBudgetError = (message: string): boolean => {
  const normalized = message.toLowerCase();

  return (
    normalized.includes('429') ||
    normalized.includes('quota') ||
    normalized.includes('budget') ||
    normalized.includes('rate limit')
  );
};

export const useLegalResearch = (): UseLegalResearchReturn => {
  const [currentQuery, setCurrentQuery] = useState<string>('');
  const [results, setResults] = useState<CaseSource[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBudgetExceeded, setIsBudgetExceeded] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const stopSearch = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    setIsSearching(false);
    setIsAnalyzing(false);
  }, []);

  const searchWithQuery = useCallback(
    async (query: string) => {
      const normalizedQuery = query.trim();

      if (!normalizedQuery) {
        return;
      }

      stopSearch();

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const { signal } = controller;

      const isStaleRequest = () => signal.aborted || abortControllerRef.current !== controller;

      setIsSearching(true);
      setIsAnalyzing(true);
      setError(null);
      setIsBudgetExceeded(false);
      setResults([]);
      setAnalysis(null);
      setCurrentQuery(normalizedQuery);

      try {
        const analysisResult = await analyzeQuestionStream(
          normalizedQuery,
          (text: string) => {
            if (isStaleRequest()) {
              return;
            }

            setAnalysis((previousAnalysis) => ({
              answer: text,
              citations: previousAnalysis?.citations || [],
              sources: previousAnalysis?.sources || [],
              processing_time_ms: previousAnalysis?.processing_time_ms || 0,
              status: 'streaming',
            }));
          },
          (caseResults: CaseSource[]) => {
            if (isStaleRequest()) {
              return;
            }

            setResults(caseResults);
            setIsSearching(false);
          },
          signal
        );

        if (!isStaleRequest()) {
          setAnalysis(analysisResult);
          setIsAnalyzing(false);
        }

      } catch (researchError) {
        if (isAbortError(researchError) || signal.aborted) {
          return;
        }

        console.error('Research failed:', researchError);

        const message = getErrorMessage(researchError);

        if (isBudgetError(message)) {
          setIsBudgetExceeded(true);
          setError('Demo budget exceeded. Access paused.');
        } else {
          setError(message);
        }
      } finally {
        if (abortControllerRef.current === controller) {
          setIsSearching(false);
          setIsAnalyzing(false);
          abortControllerRef.current = null;
        }
      }
    },
    [stopSearch]
  );

  return {
    results,
    analysis,
    isSearching,
    isAnalyzing,
    error,
    isBudgetExceeded,
    currentQuery,
    searchWithQuery,
    stopSearch,
  };
};
