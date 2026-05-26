const path = require('path');

const { compressImage, compressVideo } = require('../../utils/mediaCompression');

async function compressMedia(req, res, next) {

    try {

        if (!req.file) {
            return next();
        }

        const mime = req.file.mimetype;
        let finalPath = req.file.path;

        // IMAGE
        if (mime.startsWith('image/')) { finalPath = await compressImage(req.file.path); }

        // VIDEO
        else if (mime.startsWith('video/')) { finalPath = await compressVideo(req.file.path); }

        req.file.path = finalPath;
        req.file.filename = path.basename(finalPath);

        next();

    } catch (err) {
        console.error('[compressMedia]', err);
        next(err);
    }
}

module.exports = compressMedia;