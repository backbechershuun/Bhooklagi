import cloudinary from "../config/cloudinary.js";


export const deleteCloudinaryImage = async (imageUrl) => {
  if (!imageUrl || !imageUrl.includes("res.cloudinary.com")) return;

  try {
    
    const parts = imageUrl.split("/");
    const fileName = parts.pop();
    const folder = parts.pop();
    const publicId = `${folder}/${fileName.split(".")[0]}`;

    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary delete error:", error);
  }
};