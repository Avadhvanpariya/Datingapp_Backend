const { cloudinary, isCloudinaryConfigured } = require('../src/config/cloudinary');
const fs = require('fs');
const path = require('path');

/**
 * Uploads a local file to Cloudinary and returns the secure URL.
 * Automatically deletes the temporary local file after upload.
 * 
 * @param {string} localFilePath - Absolute path of the local file.
 * @param {string} folderName - Subfolder in Cloudinary (e.g., 'posts', 'chats').
 * @returns {Promise<string|null>} - Secure URL or null if failed/not configured.
 */
async function uploadToCloudinary(localFilePath, folderName) {
    if (!isCloudinaryConfigured) {
        console.warn('[Cloudinary] Upload bypassed: Cloudinary is not configured. Using local file.');
        return null;
    }

    try {
        const filename = path.basename(localFilePath);
        console.log(`[Cloudinary] Uploading ${filename} to folder: click-cupid/${folderName}...`);

        const result = await cloudinary.uploader.upload(localFilePath, {
            folder: `click-cupid/${folderName}`,
            resource_type: 'auto' // Detects images, videos, and raw files automatically
        });

        console.log(`[Cloudinary] Upload successful! Secure URL: ${result.secure_url}`);

        // Clean up the local temp file
        try {
            if (fs.existsSync(localFilePath)) {
                fs.unlinkSync(localFilePath);
                console.log(`[Cloudinary] Cleaned up temporary local file: ${localFilePath}`);
            }
        } catch (unlinkErr) {
            console.error('[Cloudinary] Failed to delete local temp file:', unlinkErr);
        }

        return result.secure_url;
    } catch (err) {
        console.error('[Cloudinary] Upload error:', err);
        return null;
    }
}

/**
 * Deletes an asset from Cloudinary based on its secure URL.
 * 
 * @param {string} secureUrl - The secure URL of the asset.
 * @returns {Promise<boolean>} - True if successfully deleted, false otherwise.
 */
async function deleteFromCloudinary(secureUrl) {
    if (!secureUrl || !secureUrl.includes('cloudinary.com')) {
        return false;
    }

    if (!isCloudinaryConfigured) {
        console.warn('[Cloudinary] Delete bypassed: Cloudinary is not configured.');
        return false;
    }

    try {
        const urlParts = secureUrl.split('/');
        const uploadIndex = urlParts.indexOf('upload');
        if (uploadIndex === -1) return false;

        // Resource type is right before 'upload' (e.g. image, video)
        const resourceType = urlParts[uploadIndex - 1] || 'image';

        // Identify and bypass the version segment (e.g. 'v1570534720')
        const versionSegment = urlParts[uploadIndex + 1];
        let publicIdParts;
        if (versionSegment && versionSegment.startsWith('v')) {
            publicIdParts = urlParts.slice(uploadIndex + 2);
        } else {
            publicIdParts = urlParts.slice(uploadIndex + 1);
        }

        const publicIdWithExt = publicIdParts.join('/');
        // Extract public ID by stripping the file extension
        const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.')) || publicIdWithExt;

        console.log(`[Cloudinary] Deleting asset from cloud: publicId=${publicId}, resourceType=${resourceType}`);
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType
        });

        console.log('[Cloudinary] Delete response:', result);
        return result.result === 'ok';
    } catch (err) {
        console.error('[Cloudinary] Delete error:', err);
        return false;
    }
}

module.exports = {
    uploadToCloudinary,
    deleteFromCloudinary
};
