import { useEffect, useRef, useState } from "react";

import {
  placesUnavailableMessage,
  type PlaceAddressResult,
  type PlaceAutocompleteSuggestion,
  type PlaceDetailsResult,
} from "../../../lib/platform/integrations/places";

type AddressAutocompleteFieldProps = {
  className?: string;
  getAuthHeaders: () => Promise<Record<string, string>>;
  label?: string;
  onApplyAddress: (address: PlaceAddressResult) => void;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
};

function newPlacesSessionToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

export function AddressAutocompleteField({
  className = "",
  getAuthHeaders,
  label = "Address line 1",
  onApplyAddress,
  onChange,
  placeholder = "Start typing your address",
  value,
}: AddressAutocompleteFieldProps) {
  const [suggestions, setSuggestions] = useState<PlaceAutocompleteSuggestion[]>(
    []
  );
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState("");
  const lastAppliedAddressRef = useRef("");
  const requestSequenceRef = useRef(0);
  const sessionTokenRef = useRef("");
  const suppressSuggestionsForRef = useRef("");

  useEffect(() => {
    const query = value.trim();

    if (
      !searchEnabled ||
      query.length < 3 ||
      query === lastAppliedAddressRef.current ||
      query === suppressSuggestionsForRef.current
    ) {
      setSuggestions([]);
      setStatus("");
      return;
    }

    let cancelled = false;
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        setStatus("");

        try {
          const nextSessionToken =
            sessionTokenRef.current || newPlacesSessionToken();

          if (!sessionTokenRef.current) {
            sessionTokenRef.current = nextSessionToken;
          }

          const response = await fetch("/api/places/autocomplete", {
            body: JSON.stringify({
              input: query,
              sessionToken: nextSessionToken,
            }),
            headers: {
              ...(await getAuthHeaders()),
              "Content-Type": "application/json",
            },
            method: "POST",
          });
          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error ?? placesUnavailableMessage);
          }

          if (
            !cancelled &&
            requestSequence === requestSequenceRef.current &&
            value.trim() !== suppressSuggestionsForRef.current
          ) {
            setSuggestions(
              Array.isArray(result.suggestions) ? result.suggestions : []
            );
          }
        } catch (error) {
          if (!cancelled) {
            setSuggestions([]);
            setStatus(
              error instanceof Error ? error.message : placesUnavailableMessage
            );
          }
        } finally {
          if (!cancelled) {
            setSearching(false);
          }
        }
      })();
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [getAuthHeaders, searchEnabled, value]);

  async function applySuggestion(suggestion: PlaceAutocompleteSuggestion) {
    setSearching(true);
    setStatus("");
    requestSequenceRef.current += 1;

    try {
      const response = await fetch("/api/places/details", {
        body: JSON.stringify({
          placeId: suggestion.placeId,
          sessionToken: sessionTokenRef.current,
        }),
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? placesUnavailableMessage);
      }

      const place = result.place as PlaceDetailsResult;

      if (!place.address) {
        throw new Error("Choose a U.S. address suggestion.");
      }

      lastAppliedAddressRef.current = place.address.addressLine1;
      suppressSuggestionsForRef.current = place.address.addressLine1;
      setSearchEnabled(false);
      setSuggestions([]);
      onApplyAddress(place.address);
      sessionTokenRef.current = "";
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : placesUnavailableMessage
      );
    } finally {
      setSearching(false);
    }
  }

  return (
    <label className={`relative block text-sm font-medium text-slate-700 ${className}`}>
      {label}
      <input
        autoComplete="address-line1"
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
        onChange={(event) => {
          lastAppliedAddressRef.current = "";
          suppressSuggestionsForRef.current = "";
          setSearchEnabled(true);
          onChange(event.target.value);
          setStatus("");
        }}
        placeholder={placeholder}
        value={value}
      />
      {suggestions.length > 0 ? (
        <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Address suggestions</span>
            <span>Google</span>
          </div>
          {suggestions.map((suggestion) => (
            <button
              className="block w-full px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-900"
              key={suggestion.placeId}
              onClick={() => void applySuggestion(suggestion)}
              type="button"
            >
              {suggestion.text}
            </button>
          ))}
        </div>
      ) : null}
      {searching ? (
        <p className="mt-2 text-xs font-semibold text-[#2B6198]">
          Searching addresses...
        </p>
      ) : null}
      {status ? (
        <p className="mt-2 text-xs font-semibold text-slate-500">{status}</p>
      ) : null}
    </label>
  );
}
