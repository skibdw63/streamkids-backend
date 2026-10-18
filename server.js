require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
app.use(cors());
app.use(express.json());

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  'http://localhost:3000/oauth2callback'
);

oauth2Client.setCredentials({
  refresh_token: process.env.YOUTUBE_REFRESH_TOKEN
});

// Store latest uploaded video ID in memory
let lastUploadedVideoId = null;

app.get('/', (req, res) => {
  res.send('StreamKids Upload Service is Running!');
});

// Endpoint to request a direct resumable upload URL from YouTube
app.post('/get-upload-url', async (req, res) => {
  try {
    const { title, description } = req.body;
    const tokens = await oauth2Client.getAccessToken();

    // 1. Create Video Container on YouTube first using official client
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    // Request initial resumable session directly
    const ytResponse = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.token}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/*'
      },
      body: JSON.stringify({
        snippet: {
          title: title || 'StreamKids Video',
          description: description || 'Uploaded on StreamKids',
          categoryId: '20'
        },
        status: {
          privacyStatus: 'unlisted',
          embeddable: true
        }
      })
    });

    if (!ytResponse.ok) {
      const errText = await ytResponse.text();
      throw new Error(`YouTube API Error: ${errText}`);
    }

    const locationUrl = ytResponse.headers.get('location');

    res.json({
      success: true,
      uploadUrl: locationUrl
    });

  } catch (error) {
    console.error('Error getting upload URL:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint to register the Video ID sent from frontend upon complete
app.post('/register-video-id', (req, res) => {
  const { videoId } = req.body;
  if (videoId) {
    lastUploadedVideoId = videoId;
    return res.json({ success: true, videoId });
  }
  res.status(400).json({ success: false, error: 'No videoId provided' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));