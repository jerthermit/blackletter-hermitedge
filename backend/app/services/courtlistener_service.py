import logging
import httpx
import re
from collections import OrderedDict
from html import unescape
from typing import List, Optional, Dict, Any, Set
from datetime import datetime

from app.core.config import settings

logger = logging.getLogger(__name__)

COURTLISTENER_API_URL = "https://www.courtlistener.com/api/rest/v4/search/"
COURTLISTENER_OPINION_URL = "https://www.courtlistener.com/api/rest/v4/opinions/"
MAX_CASE_LOOKUP_ENTRIES = 128
MAX_TEXT_CACHE_ENTRIES = 16
MAX_OPINION_TEXT_CHARS = 100_000

GENERIC_QUERY_TERMS = {
    "a",
    "an",
    "and",
    "any",
    "case",
    "cases",
    "current",
    "decision",
    "decisions",
    "federal",
    "find",
    "for",
    "in",
    "law",
    "latest",
    "legal",
    "new",
    "newest",
    "opinion",
    "opinions",
    "precedent",
    "recent",
    "ruling",
    "rulings",
    "show",
    "the",
    "under",
    "us",
    "u",
    "s",
}

RECENCY_QUERY_TERMS = {
    "latest",
    "newest",
    "recent",
    "current",
}

CASE_NAME_STOPWORDS = {
    "and",
    "association",
    "board",
    "city",
    "company",
    "corp",
    "corporation",
    "county",
    "department",
    "district",
    "estate",
    "inc",
    "incorporated",
    "llc",
    "ltd",
    "matter",
    "national",
    "people",
    "plaintiff",
    "re",
    "state",
    "the",
    "united",
    "university",
}


class CourtListenerService:
    """
    Handles interactions with the CourtListener API.

    Search-stage responsibility:
    - Normalize broad user queries into CourtListener-friendly search terms.
    - Return a defensible candidate pool.
    - Avoid misleading preview copy.

    Analysis-stage responsibility:
    - Fetch usable opinion text.
    - Prefer the public CourtListener opinion page when search results point to it.
    - Reject obviously mismatched opinion text before it reaches the LLM.
    """

    def __init__(self):
        self.api_key = settings.COURTLISTENER_API_KEY
        self.headers = {
            "User-Agent": "LegalResearchAssistant/1.0 (Educational/Demo Purpose)",
            "Authorization": f"Token {self.api_key}",
        } if self.api_key else {
            "User-Agent": "LegalResearchAssistant/1.0 (Educational/Demo Purpose)",
        }
        self.public_headers = {
            "User-Agent": "LegalResearchAssistant/1.0 (Educational/Demo Purpose)",
        }
        self._case_lookup: OrderedDict[str, Dict[str, str]] = OrderedDict()
        self._text_cache: OrderedDict[str, str] = OrderedDict()

    def _remember_case(self, case_id: str, metadata: Dict[str, str]) -> None:
        self._case_lookup[case_id] = metadata
        self._case_lookup.move_to_end(case_id)
        while len(self._case_lookup) > MAX_CASE_LOOKUP_ENTRIES:
            self._case_lookup.popitem(last=False)

    def _remember_text(self, case_id: str, text: str) -> None:
        self._text_cache[case_id] = text
        self._text_cache.move_to_end(case_id)
        while len(self._text_cache) > MAX_TEXT_CACHE_ENTRIES:
            self._text_cache.popitem(last=False)

    def _clean_text(self, text: str) -> str:
        """
        Cleans court opinion/search text to save tokens and improve display.
        """
        if not text:
            return ""

        text = unescape(text)
        text = re.sub(r"<[^>]+>", "", text)
        text = re.sub(r"\s+", " ", text).strip()

        return text

    def _clean_public_page_html(self, html: str) -> str:
        """
        Extracts readable text from a public CourtListener opinion page.

        This is intentionally simple and dependency-free. It removes page chrome
        before stripping tags so the LLM receives opinion-like text rather than
        navigation, scripts, and footer content.
        """
        if not html:
            return ""

        page = re.sub(r"(?is)<script[^>]*>.*?</script>", " ", html)
        page = re.sub(r"(?is)<style[^>]*>.*?</style>", " ", page)
        page = re.sub(r"(?is)<noscript[^>]*>.*?</noscript>", " ", page)
        page = re.sub(r"(?is)<nav[^>]*>.*?</nav>", " ", page)
        page = re.sub(r"(?is)<footer[^>]*>.*?</footer>", " ", page)
        page = re.sub(r"(?is)<header[^>]*>.*?</header>", " ", page)

        opinion_match = re.search(
            r'(?is)<div[^>]+class="[^"]*(?:opinion|cluster-content|document)[^"]*"[^>]*>(.*?)</div>',
            page,
        )
        if opinion_match:
            page = opinion_match.group(1)

        return self._clean_text(page)

    def _parse_date(self, date_str: str) -> datetime:
        """
        Safely parses a CourtListener date string.
        """
        if not date_str:
            return datetime.min

        try:
            return datetime.strptime(date_str[:10], "%Y-%m-%d")
        except (ValueError, TypeError):
            return datetime.min

    def _query_terms(self, query: str) -> Set[str]:
        """
        Extracts meaningful search terms from a natural-language legal query.

        Generic intent words are removed so queries like "latest theft case"
        search for "theft" instead of broad case metadata.
        """
        terms = {
            term.lower()
            for term in re.findall(r"[a-zA-Z][a-zA-Z0-9'-]{2,}", query)
        }

        return {
            term
            for term in terms
            if term not in GENERIC_QUERY_TERMS
        }

    def _case_name_terms(self, case_name: str) -> Set[str]:
        """
        Extracts meaningful party/title terms for fetched-text validation.

        This is not a legal relevance filter. It only protects against a bad
        source integrity failure where an opinion endpoint returns text that
        clearly belongs to a different case.
        """
        terms = {
            term.lower()
            for term in re.findall(r"[a-zA-Z][a-zA-Z0-9'-]{2,}", case_name)
        }

        return {
            term
            for term in terms
            if term not in CASE_NAME_STOPWORDS and len(term) >= 4
        }

    def _text_matches_case_name(self, text: str, case_name: str) -> bool:
        """
        Checks that fetched opinion text appears to belong to the displayed case.

        Requires only one distinctive case-name term so short captions like
        "State v. Walsh" still pass if "Walsh" appears in the opinion text.
        """
        if not text or not case_name:
            return False

        terms = self._case_name_terms(case_name)

        if not terms:
            return True

        normalized_text = text.lower()

        return any(term in normalized_text for term in terms)

    def _validated_case_text(
        self,
        case_id: str,
        text: str,
        source_label: str,
    ) -> Optional[str]:
        clean_text = self._clean_text(text)
        case_meta = self._case_lookup.get(str(case_id))

        if not clean_text:
            return None

        if case_meta:
            case_name = case_meta.get("name", "")

            if not self._text_matches_case_name(clean_text, case_name):
                logger.warning(
                    "Rejected mismatched %s text for id=%s expected_case=%s",
                    source_label,
                    case_id,
                    case_name,
                )
                return None

        return clean_text[:MAX_OPINION_TEXT_CHARS]

    def _build_search_query(self, query: str) -> str:
        substantive_terms = self._query_terms(query)

        if not substantive_terms:
            return query.strip()

        return " ".join(sorted(substantive_terms))

    def _is_recency_query(self, query: str) -> bool:
        query_terms = {
            term.lower()
            for term in re.findall(r"[a-zA-Z][a-zA-Z0-9'-]{2,}", query)
        }

        return bool(query_terms.intersection(RECENCY_QUERY_TERMS))

    def _fallback_snippet(
        self,
        court: str,
        date_filed_str: str,
        citation: str,
    ) -> str:
        """
        Neutral fallback for records where the search index does not return a
        meaningful text preview.
        """
        return (
            f"**DECISION FROM {court.upper()}**\n"
            f"**Date:** {date_filed_str} | **Citation:** {citation}\n"
            "Search preview unavailable from the CourtListener index. "
            "Open the source record to review the full opinion text."
        )

    async def search_cases(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Searches for opinions and returns candidate source records for the app.

        Ranking strategy:
        1. Strip generic intent words from user queries.
        2. Ask CourtListener for a larger candidate pool.
        3. Preserve candidates for downstream full-text handling.
        4. Sort recent-intent searches by date, otherwise by authority signal.
        """
        if not self.api_key:
            logger.warning("CourtListener API Key missing. Returning empty results.")
            return []

        fetch_limit = min(limit * 6, 40)
        normalized_query = self._build_search_query(query)
        is_recency_query = self._is_recency_query(query)

        params = {
            "q": normalized_query,
            "type": "o",
            "order_by": "dateFiled desc" if is_recency_query else "score desc",
            "stat_Precedential": "on",
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    COURTLISTENER_API_URL,
                    params=params,
                    headers=self.headers,
                    timeout=15.0,
                )
                response.raise_for_status()
                data = response.json()

                raw_hits = data.get("results", [])
                logger.info(
                    "CourtListener returned %s raw hits (query_chars=%s).",
                    len(raw_hits),
                    len(query),
                )

                processed_results = []

                for idx, hit in enumerate(raw_hits[:fetch_limit]):
                    try:
                        case_id = hit.get("id")
                        absolute_url = hit.get("absolute_url")

                        if not case_id and absolute_url:
                            match = re.search(r"/opinion/(\d+)/", absolute_url)
                            if match:
                                case_id = int(match.group(1))

                        if not case_id:
                            continue

                        case_name = hit.get("caseName", "Unknown Case")
                        date_filed_str = hit.get("dateFiled", "")[:10] if hit.get("dateFiled") else "Unknown Date"
                        date_obj = self._parse_date(date_filed_str)
                        court = hit.get("court") or "Court not specified"

                        citation = "No Citation"
                        if hit.get("citation") and len(hit["citation"]) > 0:
                            citation = hit["citation"][0]
                        elif hit.get("caseName"):
                            citation = "Unreported"

                        raw_snippet = hit.get("snippet", "")
                        clean_snippet = self._clean_text(raw_snippet)

                        if not clean_snippet or len(clean_snippet) < 20:
                            clean_snippet = self._fallback_snippet(
                                court=court,
                                date_filed_str=date_filed_str,
                                citation=citation,
                            )

                        if isinstance(absolute_url, str) and absolute_url.startswith("/"):
                            absolute_url_full = f"https://www.courtlistener.com{absolute_url}"
                        else:
                            absolute_url_full = f"https://www.courtlistener.com/opinion/{case_id}/"

                        result = {
                            "id": int(case_id),
                            "name": case_name,
                            "citation": citation,
                            "date": date_filed_str,
                            "date_obj": date_obj,
                            "court": court,
                            "snippet": clean_snippet,
                            "score": hit.get("score", 0),
                            "citation_count": hit.get("citation_count", 0),
                            "absolute_url": absolute_url_full,
                        }

                        self._remember_case(
                            str(case_id),
                            {
                                "name": case_name,
                                "citation": citation,
                                "date": date_filed_str,
                                "court": court,
                                "absolute_url": absolute_url_full,
                            },
                        )

                        processed_results.append(result)
                    except Exception as e:
                        logger.warning(f"Error parsing hit {idx}: {e}")
                        continue

                if not processed_results:
                    logger.info(
                        "No CourtListener candidates (query_chars=%s).",
                        len(query),
                    )
                    return []

                max_score = max(result["score"] for result in processed_results) if processed_results else 0
                score_threshold = max_score * 0.75

                landmarks = []
                others = []

                for result in processed_results:
                    is_landmark = (
                        result["score"] >= score_threshold
                        or result["citation_count"] > 50
                    )

                    if is_landmark:
                        landmarks.append(result)
                    else:
                        others.append(result)

                if is_recency_query:
                    landmarks.sort(key=lambda x: x["date_obj"], reverse=True)
                    others.sort(key=lambda x: x["date_obj"], reverse=True)
                else:
                    landmarks.sort(
                        key=lambda x: (x["citation_count"], x["score"], x["date_obj"]),
                        reverse=True,
                    )
                    others.sort(
                        key=lambda x: (x["score"], x["date_obj"]),
                        reverse=True,
                    )

                final_results = landmarks + others

                for result in final_results:
                    del result["date_obj"]

                return final_results[:limit]

            except httpx.HTTPStatusError as exc:
                logger.error(
                    "CourtListener search failed (status=%s).",
                    exc.response.status_code,
                )
                raise
            except httpx.HTTPError as exc:
                logger.error(
                    "CourtListener search failed (%s).",
                    type(exc).__name__,
                )
                raise

    async def _get_public_opinion_page_text(
        self,
        case_id: str,
        absolute_url: Optional[str],
    ) -> Optional[str]:
        if not absolute_url:
            return None

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    absolute_url,
                    headers=self.public_headers,
                    timeout=15.0,
                    follow_redirects=True,
                )
                response.raise_for_status()

                text = self._clean_public_page_html(response.text)
                return self._validated_case_text(case_id, text, "public page")

            except httpx.HTTPError as e:
                logger.warning(
                    "CourtListener public-page fetch failed (id=%s, error=%s).",
                    case_id,
                    type(e).__name__,
                )
                return None

    async def _get_api_opinion_text(self, case_id: str) -> Optional[str]:
        url = f"{COURTLISTENER_OPINION_URL}{case_id}/"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers, timeout=15.0)
                if response.status_code == 404:
                    return None

                response.raise_for_status()
                data = response.json()

                text = (
                    data.get("plain_text")
                    or data.get("html_with_citations")
                    or data.get("html")
                    or data.get("html_lawbox")
                    or ""
                )

                return self._validated_case_text(case_id, text, "API opinion")

            except httpx.HTTPError as e:
                logger.error(
                    "CourtListener opinion fetch failed (id=%s, error=%s).",
                    case_id,
                    type(e).__name__,
                )
                return None

    async def get_case_text(self, case_id: str) -> Optional[str]:
        """
        Fetches usable opinion text for a search result.

        Important: CourtListener search result IDs and public opinion pages are
        more reliable for this demo than assuming every search ID maps cleanly to
        /api/rest/v4/opinions/{id}. We therefore try the public opinion page first
        when the search result supplied an absolute URL, then fall back to the API.
        """
        if not self.api_key:
            return None

        normalized_case_id = str(case_id)

        if normalized_case_id in self._text_cache:
            self._text_cache.move_to_end(normalized_case_id)
            return self._text_cache[normalized_case_id]

        case_meta = self._case_lookup.get(normalized_case_id, {})
        absolute_url = case_meta.get("absolute_url")

        public_text = await self._get_public_opinion_page_text(
            normalized_case_id,
            absolute_url,
        )
        if public_text:
            self._remember_text(normalized_case_id, public_text)
            return public_text

        api_text = await self._get_api_opinion_text(normalized_case_id)
        if api_text:
            self._remember_text(normalized_case_id, api_text)
            return api_text

        return None


courtlistener_service = CourtListenerService()
