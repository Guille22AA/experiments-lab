// Prepares a receipt file (photo or PDF) to send to the backend as base64.

const MAX_IMAGE_SIDE_PX = 2400; // enough to read a long receipt, much smaller than a raw phone photo
const JPEG_QUALITY = 0.85;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]); // drop "data:...;base64,"
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Shrinks a photo and converts it to JPEG. */
async function shrinkImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
}

/**
 * @returns {Promise<{ mimeType: string, base64: string, source: 'ticket_pdf' | 'ticket_image' }>}
 */
export async function prepareTicketFile(file) {
  if (file.type === 'application/pdf') {
    return { mimeType: file.type, base64: await blobToBase64(file), source: 'ticket_pdf' };
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Ese archivo no es una foto ni un PDF.');
  }
  try {
    const jpeg = await shrinkImage(file);
    return { mimeType: 'image/jpeg', base64: await blobToBase64(jpeg), source: 'ticket_image' };
  } catch {
    throw new Error('No he podido abrir la foto. Prueba con otra en formato JPG o PNG.');
  }
}
