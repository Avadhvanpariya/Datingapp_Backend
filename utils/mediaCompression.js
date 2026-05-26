const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

async function compressImage(inputPath, mimeType) {
    const ext = path.extname(inputPath).toLowerCase();
    const outputPath = inputPath.replace(ext, `-compressed${ext}`);
    let transformer = sharp(inputPath).resize({
        width: 1280,
        withoutEnlargement: true
    });

    // JPEG
    if (mimeType === 'image/jpeg') { transformer = transformer.jpeg({ quality: 75 }); }

    // PNG
    else if (mimeType === 'image/png') { transformer = transformer.png({ compressionLevel: 9 }); }

    // WEBP
    else if (mimeType === 'image/webp') { transformer = transformer.webp({ quality: 75 }); }

    await transformer.toFile(outputPath);

    fs.unlinkSync(inputPath);
    return outputPath;
}

function compressVideo(inputPath) {
    return new Promise((resolve, reject) => {
        const ext = path.extname(inputPath);
        const outputPath = inputPath.replace(ext, `-compressed${ext}`);

        ffmpeg(inputPath)
            .outputOptions([
                '-vcodec libx264',
                '-crf 28',
                '-preset fast',
                '-movflags +faststart'
            ])
            .size('?x720')
            .save(outputPath)
            .on('end', () => {
                fs.unlinkSync(inputPath);
                resolve(outputPath);
            })
            .on('error', reject);
    });
}

module.exports = {
    compressImage,
    compressVideo
};