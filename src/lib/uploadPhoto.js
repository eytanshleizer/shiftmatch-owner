// Uploads an owner-chosen restaurant cover photo to Supabase Storage and returns
// its public URL. Replaces the old auto-search (which only ever returned generic
// stock photos by cuisine type) — owners now upload a real photo of their place.

import { supabase } from "./supabase";

const BUCKET = "restaurant-photos";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB (matches the bucket limit)

/**
 * @param {File}   file    image File from an <input type="file">
 * @param {string} prefix  folder prefix (restaurant id, or user id during signup)
 * @returns {Promise<string>} public URL of the uploaded image
 */
export async function uploadRestaurantPhoto(file, prefix = "misc") {
  if (!file) throw new Error("לא נבחר קובץ");
  if (!file.type?.startsWith("image/")) throw new Error("הקובץ שנבחר אינו תמונה");
  if (file.size > MAX_BYTES) throw new Error("התמונה גדולה מדי — עד 8MB");

  const ext = (file.name.split(".").pop() || "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type,
  });
  if (error) throw new Error(error.message || "ההעלאה נכשלה, נסו שוב");

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
