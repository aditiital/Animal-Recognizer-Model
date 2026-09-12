/**
 * video-classifier.js
 * Extracts a single frame from an uploaded video (client-side, via <canvas>)
 * and sends it to the same backend image-classification endpoint.
 *
 * Uses 'loadedmetadata' (not 'loadeddata') to read duration, since on some
 * browsers/platforms 'loadeddata' can fire before duration is known, which
 * previously caused the frame grab to hang indefinitely (NaN currentTime
 * never fires 'seeked'). A timeout guards against any remaining stalls.
 */

function extractVideoFrame(videoEl) {
  return new Promise((resolve, reject) => {
    const canvas = document.getElementById('videoCanvas');
    let settled = false;

    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      videoEl.onseeked = null;
      videoEl.onloadedmetadata = null;
      videoEl.onerror = null;
      fn(arg);
    };

    const timeoutId = setTimeout(() => {
      finish(reject, new Error('Timed out extracting a frame from this video (it may be an unsupported format).'));
    }, 15000);

    const grabFrame = () => {
      try {
        canvas.width = videoEl.videoWidth || 640;
        canvas.height = videoEl.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          clearTimeout(timeoutId);
          if (!blob) { finish(reject, new Error('Could not extract a frame from this video.')); return; }
          finish(resolve, blob);
        }, 'image/jpeg', 0.92);
      } catch (e) {
        clearTimeout(timeoutId);
        finish(reject, e);
      }
    };

    const seekAndGrab = () => {
      const duration = videoEl.duration;
      if (!isFinite(duration) || duration <= 0) {
        grabFrame();
        return;
      }
      const target = Math.min(duration * 0.1, 1);
      videoEl.onseeked = grabFrame;
      videoEl.currentTime = target;
    };

    videoEl.onerror = () => {
      clearTimeout(timeoutId);
      finish(reject, new Error('This video file could not be loaded by the browser (unsupported codec/format).'));
    };

    if (videoEl.readyState >= 1) {
      seekAndGrab();
    } else {
      videoEl.onloadedmetadata = seekAndGrab;
    }
  });
}

async function classifyVideoFrame(videoEl) {
  const frameBlob = await extractVideoFrame(videoEl);
  const frameFile = new File([frameBlob], 'frame.jpg', { type: 'image/jpeg' });
  return classifyImage(frameFile);
}