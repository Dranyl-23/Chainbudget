const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const pinataJWT = process.env.PINATA_JWT;

/**
 * Uploads a file buffer to Pinata IPFS.
 * @param {Buffer} fileBuffer - The file buffer to upload.
 * @param {string} originalname - The original name of the file.
 * @returns {Promise<{ cid: string, url: string }>} - Returns the IPFS CID and Gateway URL.
 */
const uploadToPinata = async (fileBuffer, originalname) => {
    if (!pinataJWT) {
        throw new Error('PINATA_JWT is not set in environment variables');
    }

    try {
        const formData = new FormData();
        formData.append('file', fileBuffer, {
            filename: originalname
        });

        const pinataMetadata = JSON.stringify({
            name: originalname
        });
        formData.append('pinataMetadata', pinataMetadata);

        const pinataOptions = JSON.stringify({
            cidVersion: 1
        });
        formData.append('pinataOptions', pinataOptions);

        const res = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
            headers: {
                ...formData.getHeaders(),
                Authorization: `Bearer ${pinataJWT}`
            }
        });

        const cid = res.data.IpfsHash;
        // Using Pinata's public gateway (or a dedicated gateway if you have one, but public works for testing)
        // Alternatively, dweb.link or ipfs.io could be used as fallback gateways.
        const url = `https://gateway.pinata.cloud/ipfs/${cid}`;

        return { cid, url };
    } catch (error) {
        console.error('Error uploading file to Pinata:', error?.response?.data || error.message);
        throw new Error('Failed to upload file to IPFS via Pinata');
    }
};

module.exports = {
    uploadToPinata
};
