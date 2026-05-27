// const admin = require('firebase-admin');

// const serviceAccount = require('../../firebase-service-account.json');

// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
// });

// module.exports = admin;

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let credential;

if (process.env.FIREBASE_PRIVATE_KEY) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim();

    // Strip surrounding quotes if pasted accidentally into Render/Vercel
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
    }
    if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
        privateKey = privateKey.slice(1, -1);
    }

    privateKey = privateKey.replace(/\\n/g, '\n');

    credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: privateKey,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    });
    console.log('[Firebase] Initialized with environment variables.');
} else {
    // Local fallback to json file
    const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        credential = admin.credential.cert(serviceAccount);
        console.log('[Firebase] Initialized with local service account JSON.');
    } else {
        console.error('[Firebase] Error: Missing Firebase credentials environment variables or service account JSON file.');
    }
}

if (credential) {
    admin.initializeApp({
        credential
    });
}

module.exports = admin;