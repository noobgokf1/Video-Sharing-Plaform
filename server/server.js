const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const app = express();
const port = 3000;

const publicDir = path.join(process.cwd(), 'public');
const videosDir = path.join(publicDir, 'videos');
const thumbnailsDir = path.join(videosDir, 'thumbnails');

const maxVideoSize = 100 * 1024 * 1024; // 100 MB
const MAX_UPLOADS_PER_HOUR = 6; // Limit of uploads per hour
const ONE_HOUR = 60 * 60 * 1000; // One hour

if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, videosDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: maxVideoSize }
});

app.use(express.static(publicDir));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const metadataPath = path.join(publicDir, 'videoMetadata.json');

let videoMetadata = {};
if (fs.existsSync(metadataPath)) {
  videoMetadata = JSON.parse(fs.readFileSync(metadataPath));
}

const uploadRecords = {};

app.post('/api/upload', upload.single('video'), (req, res) => {
  const videoFile = req.file;
  const title = req.body.title;
  const ip = req.ip;
  let responseSent = false;

  if (!uploadRecords[ip]) {
    uploadRecords[ip] = [];
  }

  const currentTime = Date.now();
  uploadRecords[ip] = uploadRecords[ip].filter(uploadTime => currentTime - uploadTime < ONE_HOUR);

  if (uploadRecords[ip].length >= MAX_UPLOADS_PER_HOUR) {
    return res.json({ success: false, error: 'Upload limit reached. Please try again later.' });
  }

  if (videoFile) {
    const filename = videoFile.filename;
    const videoPath = path.join(videosDir, filename);

    if (videoMetadata[filename]) {
      return res.json({ success: false, error: 'This video has already been uploaded.' });
    }

    const thumbnailFilename = filename.replace(path.extname(filename), '.jpg');

    ffmpeg(videoPath)
      .screenshots({
        count: 1,
        folder: thumbnailsDir,
        filename: thumbnailFilename
      })
      .on('end', () => {
        if (!responseSent) {
          responseSent = true;

          videoMetadata[filename] = title;
          fs.writeFileSync(metadataPath, JSON.stringify(videoMetadata, null, 2));

          uploadRecords[ip].push(currentTime);

          res.json({
            success: true,
            filename: filename,
            title: title,
            thumbnail: thumbnailFilename
          });
        }
      })
      .on('error', (err) => {
        console.error('Thumbnail generation error:', err);
        if (!responseSent) {
          responseSent = true;
          res.json({ success: false, error: 'Thumbnail generation failed' });
        }
      });
  } else {
    res.json({ success: false, error: 'Video upload failed' });
  }
});

app.get('/api/videos', (req, res) => {
  fs.readdir(videosDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read video directory' });
    }

    let videoMetadata = {};
    if (fs.existsSync(metadataPath)) {
      videoMetadata = JSON.parse(fs.readFileSync(metadataPath));
    }
    
    const videos = files
      .filter(file => file.endsWith('.mp4'))
      .map(video => {
        const title = videoMetadata[video] || path.basename(video, path.extname(video));
        const thumbnail = video.replace(path.extname(video), '.jpg'); 
        return { filename: video, title: title, thumbnail: thumbnail };
      });

    console.log("Videos:", videos); 
    res.json(videos);
  });
});

app.get('/video/:filename', (req, res) => {
    const filename = req.params.filename;
    const videoPath = path.join(videosDir, filename);

    fs.access(videoPath, fs.constants.F_OK, (err) => {
      if (err) {
        console.error('Video not found:', err);
        return res.status(404).json({ error: 'Video not found' });
      }
  
      res.sendFile(videoPath, (err) => {
        if (err) {
          if (err.code === 'ECONNABORTED' || err.message.includes('Request aborted')) {
            console.warn('Request aborted by the client');
          } else {
            console.error('Error sending video file:', err);
          }
  
          if (!res.headersSent) {
            res.status(500).json({ error: 'Error serving video file' });
          }
        }
      });
    });
  });
  
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
