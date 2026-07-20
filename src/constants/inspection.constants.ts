// Confidence score below this % triggers a warning notification
export const CONFIDENCE_THRESHOLD = Number(
  import.meta.env.VITE_CONFIDENCE_THRESHOLD ?? 50
)

// Severity thresholds derived from MVI confidence score
export const SEVERITY_HIGH_BELOW = 40   // confidence < 40% → high severity defect risk
export const SEVERITY_MEDIUM_BELOW = 70 // confidence 40–70% → medium severity

// Max images per inspection submission
export const MAX_IMAGES = 5

// Max image file size in bytes (10 MB)
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

// Accepted image MIME types
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
