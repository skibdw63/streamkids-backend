require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { google } = require('googleapis');
const fs = require('fs');

const app = express();
app.use(cors());

// Increase Multer limit to 2GB videos
const upload = multer({
  dest: '/tmp/',
  limits: { fileSize: 2000 * 1024 * 1024 } 
});

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  'http://localhost:3000/oauth2callback'
);

oauth2Client.setCredentials({
  refresh_token: process.env.YOUTUBE_REFRESH_TOKEN
});

const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

app.get('/', (req, res) => {
  res.send('StreamKids Upload Service is Running!');
});

app.post('/upload', upload.single('video'), async (req, res) => {
  // Disable socket timeout on long uploads
  req.setTimeout(0);

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file provided' });
    }

    const filePath = req.file.path;
    const title = req.body.title || 'StreamKids Video';
    const description = req.body.description || 'Uploaded on StreamKids';

    const response = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title: title,
          description: description,
          categoryId: '20'
        },
        status: {
          privacyStatus: 'unlisted',
          embeddable: true
        }
      },
      media: {
        body: fs.createReadStream(filePath)
      }
    });

    // Cleanup temp file
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({
      success: true,
      videoId: response.data.id
    });

  } catch (error) {
    console.error('YouTube Upload Error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// Keep connection alive for large files
server.timeout = 0;
server.keepAliveTimeout = 600000;