// Deterministic color-block placeholders standing in for real car photography,
// matching the .carphoto treatment in glovebox-dashboard-design.html.
const GRADIENTS = [
  "linear-gradient(135deg,#2F6BFF 0%, #0c1226 80%)",
  "linear-gradient(135deg,#7C5CFF 0%, #150f26 80%)",
  "linear-gradient(135deg,#1FA9C9 0%, #0a1a1e 80%)",
  "linear-gradient(135deg,#3B4A63 0%, #0d1420 80%)",
  "linear-gradient(135deg,#D6552F 0%, #221008 80%)",
  "linear-gradient(135deg,#4C7A4E 0%, #0e1710 80%)",
  "linear-gradient(135deg,#5C7A99 0%, #0f151d 80%)",
  "linear-gradient(135deg,#8A6A3A 0%, #1a130a 80%)",
];

export function carGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}
