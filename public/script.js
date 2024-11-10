const form = document.getElementById('video-upload-form');
const videoContainer = document.getElementById('video-container');
const progressBar = document.getElementById('upload-progress');
const videoLinkContainer = document.getElementById('video-link-container');
const videoLinkElement = document.getElementById('video-link');
const copyLinkButton = document.getElementById('copy-link');

fetch('/api/videos')
  .then(response => response.json())
  .then(videos => {
    videos.forEach(video => {
      const videoLink = document.createElement('a');
      videoLink.href = `video.html?filename=${video.filename}`;
      videoLink.classList.add('video-thumbnail');

      const thumbnailImg = document.createElement('img');
      thumbnailImg.src = `/videos/thumbnails/${video.thumbnail}`;
      videoLink.appendChild(thumbnailImg);

      const videoTitle = document.createElement('div');
      videoTitle.classList.add('video-title');
      videoTitle.textContent = video.title;
      videoLink.appendChild(videoTitle);

      videoContainer.appendChild(videoLink);
    });
  });

form.addEventListener('submit', function(event) {
  event.preventDefault();
  const fileInput = document.getElementById('video-file');
  const titleInput = document.getElementById('video-title');
  const formData = new FormData();
  formData.append('video', fileInput.files[0]);
  formData.append('title', titleInput.value);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload', true);

  xhr.upload.onprogress = function(event) {
    if (event.lengthComputable) {
      const percentComplete = (event.loaded / event.total) * 100;
      progressBar.value = percentComplete;
      progressBar.style.display = 'block';
    }
  };

  xhr.onload = function() {
    progressBar.style.display = 'none';
    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);
      if (data.success) {
        const videoUrl = `http://localhost:3000/video.html?filename=${data.filename}`;
        videoLinkElement.href = videoUrl;
        videoLinkElement.textContent = videoUrl;
        videoLinkContainer.style.display = 'block';

        const videoLink = document.createElement('a');
        videoLink.href = `video.html?filename=${data.filename}`;
        videoLink.classList.add('video-thumbnail');

        const thumbnailImg = document.createElement('img');
        thumbnailImg.src = `/videos/thumbnails/${data.thumbnail}`;
        videoLink.appendChild(thumbnailImg);

        const videoTitle = document.createElement('div');
        videoTitle.classList.add('video-title');
        videoTitle.textContent = data.title;
        videoLink.appendChild(videoTitle);

        videoContainer.appendChild(videoLink);
      } else {
        alert('Upload failed: ' + data.error);
      }
    } else {
      alert('Upload failed. Server error.');
    }
  };

  xhr.onerror = function() {
    alert('Upload failed. Unable to connect to server.');
  };

  xhr.send(formData);
});

copyLinkButton.addEventListener('click', () => {
  const link = videoLinkElement.href;
  navigator.clipboard.writeText(link).then(() => {
    alert('Video link copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy: ', err);
  });
});