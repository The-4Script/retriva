import { compressImage } from './imageCompression';

// VERCEL CONFIG: Add these to Environment Variables in Vercel Dashboard
// Direct access ensures Vite replaces them at build time.
const CLOUD_NAME = (import.meta as any).env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = (import.meta as any).env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const uploadImage = async (file: File): Promise<string> => {
  if (!file) throw new Error("No file selected");

  // 1. Attempt Cloudinary Upload
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Cloudinary upload failed');
    }

    const data = await response.json();
    return data.secure_url; // Success: Return the HTTPS URL
  } catch (error) {
    console.error("Cloudinary upload failed.", error);
    throw new Error("Image upload failed. Please try again.");
  }
};