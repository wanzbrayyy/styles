const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const useragent = require('express-useragent');

const app = express();
const PORT = 3000;

const CLOUDFLARE_ZONE = "8986c21d4df43f0d1708b8f9f6ab4dcd";
const CLOUDFLARE_API_TOKEN = "FUKXUphvvUDKUQW8v8JIWXBQekynFNOV1ltmT4eE";
const CLOUDFLARE_TLD = "wanzofc.us.kg";

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 248 * 1024 * 1024 }
});

app.use(express.static(__dirname));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(useragent.express());

async function subDomain1(host, ip) {
    const apiUrl = `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE}/dns_records`;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
    };
    const data = {
        type: 'A',
        name: `${host}.${CLOUDFLARE_TLD}`,
        content: ip,
        ttl: 120,
        proxied: true
    };

    try {
        const response = await axios.post(apiUrl, data, { headers });
        if (response.data.success) {
            return { success: true, name: `${host}.${CLOUDFLARE_TLD}` };
        } else {
            console.error("Cloudflare API Error:", response.data.errors);
            return { success: false, error: response.data.errors };
        }
    } catch (error) {
        console.error("Error creating subdomain:", error.response ? error.response.data : error.message);
        return { success: false, error: error.message };
    }
}

app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Tidak ada file yang diunggah.' });
        }

        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        formData.append('fileToUpload', req.file.buffer, { filename: req.file.originalname });

        const uploadURL = 'https://catbox.moe/user/api.php';
        const response = await fetch(uploadURL, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Upload failed with status:", response.status, "and message:", errorText);
            return res.status(response.status).json({ error: errorText || 'Gagal mengunggah ke layanan eksternal.' });
        }

        const resultUrl = await response.text();

        if (resultUrl && resultUrl.startsWith('http')) {
            try {
                const subdomainName = req.body.subdomain || `wanz-${uuidv4()}`;
                const ipAddress = req.body.ip || "103.226.128.118";
                const subdomainResult = await subDomain1(subdomainName, ipAddress);
                if (subdomainResult.success) {
                    res.json({ src: resultUrl, subdomain: subdomainResult.name });
                } else {
                    return res.status(500).json({ error: 'Upload berhasil, tetapi gagal membuat subdomain: ' + subdomainResult.error });
                }
            } catch (cloudflareError) {
                console.error("Gagal membuat subdomain Cloudflare:", cloudflareError);
                return res.status(500).json({ error: 'Upload berhasil, tetapi gagal membuat subdomain Cloudflare.' });
            }
        } else {
            res.status(500).json({ error: 'Format respons tidak valid dari layanan unggah: ' + resultUrl });
        }
    } catch (error) {
        console.error("Error saat mengunggah:", error);
        res.status(500).json({ error: 'Terjadi kesalahan internal pada server.' });
    }
});

app.get('/api/data', (req, res) => {
    res.json({
        message: 'Ini adalah data dari server Anda!',
        timestamp: new Date()
    });
});

app.post('/api/data', (req, res) => {
    const receivedData = req.body;
    if (!receivedData) {
        return res.status(400).json({ error: 'Tidak ada data yang diterima.' });
    }
    console.log('Data yang diterima dari permintaan POST:', receivedData);
    res.json({
        message: 'Data diterima dan diproses!',
        receivedData: receivedData
    });
});

app.get('/', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const source = req.useragent;
    console.log('------------------------------');
    console.log('Pengguna mengakses halaman web:');
    console.log('IP:', ip);
    if (source) {
        console.log('Browser:', source.browser, 'Versi:', source.version);
        console.log('OS:', source.os, 'Platform:', source.platform);
    }
    try {
        const response = await axios.get(`http://ip-api.com/json/${ip}`);
        const location = response.data;
        console.log('Lokasi:', location.city, ',', location.country);
        console.log('ISP:', location.isp);
    } catch (error) {
        console.error('Gagal mendapatkan lokasi:', error.message);
    }
    console.log('------------------------------');
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
