require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

// Configure Multer temporary storage
const upload = multer({ dest: '/tmp/' });

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  'http://localhost:3000/oauth2callback'
);

oauth2Client.setCredentials({
  refresh_token: process.env.YOUTUBE_REFRESH_TOKEN
});

const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

// Health Check Endpoint
app.get('/', (req, res) => {
  res.send('StreamKids Upload Service is Running!');
});

// Video Upload Endpoint
app.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file provided' });
    }

    const filePath = req.file.path;
    const title = req.body.title || 'StreamKids Video';
    const description = req.body.description || 'Uploaded on StreamKids';

    // Stream video directly to YouTube as Unlisted
    const response = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title: title,
          description: description,
          categoryId: '20' // Gaming / Entertainment category
        },
        status: {
          privacyStatus: 'unlisted', // Unlisted so it won't clutter public YouTube searches
          embeddable: true
        }
      },
      media: {
        body: fs.createReadStream(filePath)
      }
    });

    // Remove local temp file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      videoId: response.data.id
    });

  } catch (error) {
    console.error('YouTube Upload Error:', error);
    // Cleanup file if error occurred
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));