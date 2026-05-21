export const placesUnavailableMessage =
  "Looks like autocomplete for addresses isn't available right now. We'll look into it.";

export type PlaceAutocompleteSuggestion = {
  placeId: string;
  text: string;
};

export type PlaceDetailsResult = {
  googleMapsUri: string;
  placeId: string;
  placeName: string;
  formattedAddress: string;
  nationalPhoneNumber: string;
};

export type FavoriteLocation = {
  id: string;
  care_circle_id: string;
  nickname: string;
  place_name: string | null;
  address: string | null;
  phone: string | null;
  google_place_id: string | null;
  google_maps_uri: string | null;
  source: string;
  usage_count: number;
  last_used_at: string | null;
};

export type IntegrationErrorKey = "quota_exceeded" | "rate_limited" | "unavailable";

export function isGooglePlacesLimitError(status: number, responseText: string) {
  const normalizedText = responseText.toLowerCase();

  return (
    status === 429 ||
    normalizedText.includes("quota") ||
    normalizedText.includes("rate limit") ||
    normalizedText.includes("resource_exhausted")
  );
}

export function googlePlacesErrorKey(
  status: number,
  responseText: string
): IntegrationErrorKey {
  if (isGooglePlacesLimitError(status, responseText)) {
    return status === 429 ? "rate_limited" : "quota_exceeded";
  }

  return "unavailable";
}

export function favoriteLocationLabel(location: FavoriteLocation) {
  return location.nickname || location.place_name || location.address || "Favorite location";
}
