// Turns a sensitivity level into the message shown on the Monitor page.
export function getRelevanceMessage(level) {
  switch (level) {
    case "high":
      return "This sound is marked as highly relevant in your sound profile.";
    case "medium":
      return "This sound is marked as moderately relevant in your sound profile.";
    case "low":
      return "This sound is marked as minimally relevant in your sound profile.";
    default:
      return "You marked this sound as not relevant, so no alert is shown.";
  }
}