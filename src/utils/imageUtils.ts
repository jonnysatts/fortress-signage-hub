/**
 * Utility functions for working with images
 */

/**
 * Get dimensions of an image file
 * @param file - Image file to measure
 * @returns Promise resolving to {width, height}
 */
export async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Get dimensions from an image URL
 * @param url - Image URL to measure
 * @returns Promise resolving to {width, height}
 */
export async function getImageDimensionsFromUrl(
  url: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };

    img.onerror = () => {
      reject(new Error('Failed to load image from URL'));
    };

    // Handle CORS if needed
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}
