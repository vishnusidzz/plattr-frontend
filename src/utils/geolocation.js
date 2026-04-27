// src/utils/geolocation.js
export function getCurrentPosition(options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    let called = false;
    const timer = setTimeout(() => {
      if (!called) {
        called = true;
        reject(new Error('Geolocation timed out'));
      }
    }, (options.timeout || 10000) + 2000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (called) return;
        called = true;
        clearTimeout(timer);
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
      },
      (err) => {
        if (called) return;
        called = true;
        clearTimeout(timer);
        reject(err);
      },
      options
    );
  });
}